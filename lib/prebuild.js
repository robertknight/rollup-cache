import { existsSync, readFileSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import { createRequire } from "module";
import * as path from "path";

import { buildNPMBundles } from "./build-npm-bundles.js";

const require = createRequire(import.meta.url);

/**
 * Return the path of the `package.json` file associated with a given module ID.
 *
 * The module ID may be the name of a package or a module within a package,
 * in which case the containing package's package.json is found.
 *
 * @param {string} moduleID
 */
function getPackageJSONPath(moduleID) {
  const entryPoint = require.resolve(moduleID);
  let dir = path.dirname(entryPoint);
  let relativePackagePath = "package.json";
  while (dir !== "/" && !existsSync(`${dir}/${relativePackagePath}`)) {
    dir = path.dirname(dir);
  }
  return `${dir}/${relativePackagePath}`;
}

/**
 * Get the last-modified timestamp of the package.json file associated with
 * a module.
 *
 * @param {string} moduleID
 */
function getPackageTimestamp(moduleID) {
  const packagePath = getPackageJSONPath(moduleID);
  try {
    const stats = statSync(packagePath);
    return stats.mtimeMs;
  } catch (err) {
    throw new Error(`Failed to get package version for "${moduleID}"`);
  }
}

/**
 * Wrap a Rollup bundle configuration to enable prebuilding of npm dependencies.
 *
 * @param {import("rollup").RollupOptions} buildConfig
 * @param {object} options
 *   @param {string} options.cacheRoot
 *   @param {string} options.prebuildDir
 *   @param {(string|RegExp)[]} options.prebuild
 */
export function addPrebuildingToConfig(
  buildConfig,
  { cacheRoot, prebuildDir, prebuild }
) {
  /**
   * Module IDs of npm dependencies that have been discovered in this build
   * that should be prebuilt and marked as external within the output bundle.
   *
   * @type {Set<string>}
   */
  const externalDependencies = new Set();

  /**
   * @param {string} id
   * @param {string|undefined} parentId
   * @param {boolean} isResolved
   * @return {boolean}
   */
  const shouldMakeExternal = (id, parentId, isResolved) => {
    if (
      // Is this a local (non-npm) import?
      !id.startsWith(".") &&
      !id.startsWith("/") &&
      // Is prebuilding enabled for this package?
      prebuild.some((pattern) => id.match(pattern))
    ) {
      externalDependencies.add(id);
      return true;
    }

    // Fall back to original external function.
    // See https://rollupjs.org/guide/en/#external.
    const origExternal = buildConfig.external;
    if (!origExternal) {
      return false;
    }
    if (typeof origExternal === "function") {
      return !!origExternal(id, parentId, isResolved);
    } else if (Array.isArray(origExternal)) {
      return origExternal.some((pattern) => id.match(pattern));
    } else {
      return !!id.match(origExternal);
    }
  };

  /**
   * @param {string} id
   * @param {import("rollup").OptionsPaths} [origPaths]
   */
  const getOutputPath = (id, origPaths) => {
    let origPath;
    if (typeof origPaths === "function") {
      origPath = origPaths(id);
    } else if (origPaths) {
      origPath = origPaths[id];
    }
    if (origPath) {
      return origPath;
    }
    if (externalDependencies.has(id)) {
      return `${prebuildDir}/${id}.bundle.js`;
    }
    return id;
  };

  // TODO - Handle the case where `buildConfig.output` is an array.

  /** @type {import("rollup").OutputOptions} */
  const output = {
    ...buildConfig.output,
    paths: (id) =>
      getOutputPath(
        id,
        /** @type {import("rollup").OutputOptions} */ (buildConfig.output).paths
      ),
  };

  let outputDir;
  if (output.dir) {
    outputDir = output.dir;
  } else if (output.file) {
    outputDir = path.dirname(output.file);
  } else {
    throw new Error(
      `"output.dir" or "output.file" options must be specified in Rollup config to use prebuilding`
    );
  }

  const resolvedPrebuildDir = path.resolve(outputDir, prebuildDir);

  const buildExternalDeps = {
    name: "rollup-cache:build-external-deps",

    async buildEnd() {
      /** @type {Record<string, number>} */
      const depVersions = {};
      const deps = [...externalDependencies].sort();
      for (let dependency of deps) {
        depVersions[dependency] = getPackageTimestamp(dependency);
      }
      await buildNPMBundles(depVersions, resolvedPrebuildDir);
    },
  };

  return {
    ...buildConfig,
    output,
    external: shouldMakeExternal,
    plugins: [
      .../** @type {import("rollup").Plugin[]} */ (buildConfig.plugins),
      buildExternalDeps,
    ],
  };
}
