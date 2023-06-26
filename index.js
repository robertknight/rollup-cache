import { addPluginCachingToConfig } from "./lib/plugin.js";
import { addPrebuildingToConfig } from "./lib/prebuild.js";

/**
 * @typedef CacheConfig
 * @prop {string} name - Cache key for the current build. This should be an
 *   identifier that is unique for the Rollup configuration, such as its file path.
 * @prop {string} [cacheDir] - Location to write cache data to. Defaults to
 *   "node_modules/.cache/rollup-cache".
 * @prop {string[]} [dependencies] - A list of file paths to be checked before
 *   using existing cache data. If any of these files have changed since the
 *   previous build, the existing cache data will be discarded.
 * @prop {string[]} [cachePlugins] - A list of plugins name to cache. Defaults
 * to ["babel", "commonjs", "node-resolve"].
 * @prop {boolean} [enabled] - Whether to enable caching. By default this setting
 *   is true unless this is a production build, signalled by
 *   `process.env.NODE_ENV` being set to `production`.
 * @prop {string} [prebuildDir] - Directory in which to write pre-generated
 *   bundles for npm dependencies. Defaults to "./npm".
 * @prop {string[]} [prebuild] - List of npm dependencies to prebuild. Packages
 *   listed here will be bundled into ES modules and written to `prebuildDir`.
 *   References to these dependencies in other code will be replaced with
 *   imports using Rollup's `externals` config setting.
 */

/**
 * Wrap a Rollup configuration to enable caching and (optionally) prebuilding.
 *
 * @param {CacheConfig} cacheConfig
 * @param {import("rollup").RollupOptions} buildConfig
 * @return {import("rollup").RollupOptions}
 */
export function cacheBuild(cacheConfig, buildConfig) {
  const {
    name,
    cacheDir = "node_modules/.cache/rollup-cache",
    dependencies = [],
    cachePlugins = ["babel", "commonjs", "node-resolve"],
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
    cachePlugins,
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
