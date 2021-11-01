import * as path from "path";
import { readFileSync, statSync } from "fs";

import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import * as rollup from "rollup";

/**
 * @param {string} dir
 * @param {string} name
 */
function bundlePath(dir, name) {
  return `${dir}/${name}.bundle.js`;
}

/**
 * Return the relative path from one ES bundle to another, suitable for
 * use in an `import` statement.
 *
 * @param {string} from
 * @param {string} to
 */
function relativeImportPath(from, to) {
  const relativePath = path.relative(path.dirname(from), to);
  if (relativePath.startsWith(".")) {
    return relativePath;
  } else {
    return `./${relativePath}`;
  }
}

/**
 * Return Rollup configuration for bundling an NPM package as an ESM bundle.
 *
 * @param {string} name
 * @param {string} dir
 * @param {string[]} deps - List of NPM dependencies which are also being prebuilt
 *   in the current build. This is used to ensure that any common dependencies
 *   between bundles all refer to the same bundle. eg. For example if building
 *   an application which depends on React as well as a library of React components,
 *   both the application and the library must use the same copy of React.
 * @return {import("rollup").RollupOptions}
 */
function bundleConfig(name, dir, deps) {
  return {
    input: name,
    output: {
      file: bundlePath(dir, name),
      format: "es",
      sourcemap: true,
      paths: Object.fromEntries(
        deps.map((dep) => [
          dep,
          relativeImportPath(bundlePath(dir, name), bundlePath(dir, dep)),
        ])
      ),
    },
    external: deps.filter((d) => d !== name),
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
        },
      }),
      nodeResolve(),
      commonjs({ esmExternals: true }),
    ],
  };
}

/**
 * Build an NPM dependency as a bundle in `dir`.
 *
 * @param {Record<string, number>} npmBundles - Map of npm dependency names to
 *   timestamps of previous bundle build
 * @param {string} dir - Directory which bundles should be generated in
 */
export async function buildNPMBundles(npmBundles, dir) {
  const npmBundleList = Object.entries(npmBundles)
    .filter(([name, timestamp]) => {
      try {
        const outputTimestamp = statSync(bundlePath(dir, name)).mtimeMs;
        if (outputTimestamp >= timestamp) {
          return false;
        }
        return true;
      } catch (err) {
        return true;
      }
    })
    .map(([name]) => name)
    .sort();

  if (npmBundleList.length === 0) {
    return;
  }

  console.log(`Building NPM bundles: ${npmBundleList.join(", ")}`);

  const configs = npmBundleList.map((name) =>
    bundleConfig(name, dir, npmBundleList)
  );
  await Promise.all(
    configs.map(async (config) => {
      const bundle = await rollup.rollup({
        ...config,
        onwarn: console.log,
      });
      await bundle.write(
        /** @type {import("rollup").OutputOptions} */ (config.output)
      );
    })
  );
}
