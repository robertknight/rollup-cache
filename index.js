import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";

import { cachingPlugin, pluginCacheConfig } from "./lib/plugin.js";

/**
 * @param {string[]} files
 */
function createVersionHash(files) {
  const hash = createHash("md5");
  for (let file of files) {
    const data = readFileSync(file);
    hash.update(data);
  }
  return hash.digest("hex");
}

/**
 * @typedef CacheConfig
 * @prop {string} name
 * @prop {string} [cacheDir]
 * @prop {string[]} [dependencies]
 * @prop {boolean} [enabled]
 */

const defaultDependencies = ["package.json", "package-lock.json", "yarn.lock"];

/**
 * @param {CacheConfig} cacheConfig
 * @param {import("rollup").InputOptions} buildConfig
 */
export function cacheBuild(cacheConfig, buildConfig) {
  const {
    name,
    cacheDir = "node_modules/.cache/rollup-cache",
    dependencies = [],
    enabled = process.env.NODE_ENV !== "production",
  } = cacheConfig;

  if (!enabled) {
    return buildConfig;
  }

  const cacheRoot = `${cacheDir}/${name}`;

  const versionHash = createVersionHash([
    ...defaultDependencies.filter((path) => existsSync(path)),
    ...dependencies,
  ]);

  return {
    ...buildConfig,
    plugins: buildConfig.plugins?.map((plugin) => {
      if (!plugin) {
        return plugin;
      }
      const config = pluginCacheConfig(plugin);
      if (!config) {
        return plugin;
      }
      return cachingPlugin(plugin, {
        cacheDir: cacheRoot,
        // TODO - Add plugin-specific files (eg. Babel config) to version hash.
        versionHash,
        ...config,
      });
    }),
  };
}
