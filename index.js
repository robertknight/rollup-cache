import { addPluginCachingToConfig } from "./lib/plugin.js";
import { addPrebuildingToConfig } from "./lib/prebuild.js";

/**
 * @typedef CacheConfig
 * @prop {string} name
 * @prop {string} [cacheDir]
 * @prop {string[]} [dependencies]
 * @prop {boolean} [enabled]
 * @prop {string} [prebuildDir]
 * @prop {string[]} [prebuild]
 */

/**
 * @param {CacheConfig} cacheConfig
 * @param {import("rollup").RollupOptions} buildConfig
 */
export function cacheBuild(cacheConfig, buildConfig) {
  const {
    name,
    cacheDir = "node_modules/.cache/rollup-cache",
    dependencies = [],
    enabled = process.env.NODE_ENV !== "production",
    prebuild = [],
    prebuildDir = "./npm",
  } = cacheConfig;

  if (!enabled) {
    return buildConfig;
  }

  const cacheRoot = `${cacheDir}/${name}`;

  let wrappedConfig = addPluginCachingToConfig(buildConfig, {
    cacheRoot,
    dependencies,
  });

  if (prebuild.length > 0) {
    wrappedConfig = addPrebuildingToConfig(wrappedConfig, {
      cacheRoot,
      prebuildDir,
      prebuild,
    });
  }

  return wrappedConfig;
}
