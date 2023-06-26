import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";

import { Cache } from "./cache.js";

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
 * @param {*} plugin
 * @return {Function}
 */
function getHandler(plugin) {
  return plugin.handler || plugin;
}

/**
 * @typedef PluginCacheConfig
 * @prop {string} cacheDir - Directory to write cache files to
 * @prop {string} versionHash - A version identifier for dependencies of the
 *   plugin's output. This is used together with item-specific data to determine
 *   whether existing cache entries are valid.
 */

/**
 * Wrap a Rollup plugin to add caching to various hooks.
 *
 * @param {import("rollup").Plugin} plugin
 * @param {PluginCacheConfig} config
 * @return {import("rollup").Plugin}
 */
function cachingPlugin(plugin, { cacheDir, versionHash }) {
  const cache = new Cache(cacheDir, plugin.name);

  /** @param {Buffer|string} data */
  const getCacheVersion = (data) => {
    const hash = createHash("md5");
    hash.update(versionHash);
    hash.update(data);
    return hash.digest("hex");
  };

  /** @type {import("rollup").Plugin} */
  const cachedPlugin = {
    ...plugin,

    name: `cached(${plugin.name})`,

    async buildStart(options) {
      if (plugin.buildStart) {
        await getHandler(plugin.buildStart).call(this, options);
      }
    },

    async buildEnd(error) {
      await cache.flush();
      if (plugin.buildEnd) {
        await getHandler(plugin.buildEnd).call(this, error);
      }
    },

    async resolveId(id, importer, options) {
      if (!plugin.resolveId) {
        return null;
      }

      const cacheKey = `resolveId:${id},${importer}`;
      const version = "default";
      const cachedResult = await cache.get(cacheKey, version);
      if (cachedResult !== null) {
        return cachedResult;
      }
      const result = await getHandler(plugin.resolveId).call(
        this,
        id,
        importer,
        options
      );
      await cache.set(cacheKey, version, result);
      return result;
    },

    async load(id) {
      if (!plugin.load) {
        return null;
      }

      const cacheKey = `load:${id}`;
      const version = "default";
      const cachedResult = await cache.get(cacheKey, version);
      if (cachedResult !== null) {
        return cachedResult;
      }
      const result = await getHandler(plugin.load).call(this, id);
      await cache.set(cacheKey, version, result);
      return result;
    },

    async transform(code, id) {
      if (!plugin.transform) {
        return null;
      }
      const version = getCacheVersion(code);
      const cacheKey = `transform:${id}`;
      const cachedResult = await cache.get(cacheKey, version);
      if (cachedResult !== null) {
        return cachedResult;
      }
      const result = await getHandler(plugin.transform).call(this, code, id);
      await cache.set(cacheKey, version, result);
      return result;
    },
  };

  return cachedPlugin;
}

const defaultDependencies = ["package.json", "package-lock.json", "yarn.lock"];

/**
 * Wrap a Rollup bundle configuration to enable selective caching of plugin build hooks.
 *
 * @param {import("rollup").RollupOptions} buildConfig
 * @param {object} options
 *   @param {string} options.cacheRoot
 *   @param {string[]} options.dependencies
 *   @param {string[]} options.cachePlugins
 */
export function addPluginCachingToConfig(
  buildConfig,
  { cacheRoot, dependencies, cachePlugins }
) {
  const versionHash = createVersionHash([
    ...defaultDependencies.filter((path) => existsSync(path)),
    ...dependencies,
  ]);

  const cachingPlugins =
    // @ts-ignore
    buildConfig.plugins?.map((plugin) => {
      if (!plugin) {
        return plugin;
      }
      const config = cachePlugins.includes(plugin.name) ? {} : null;
      if (!config) {
        return plugin;
      }
      return cachingPlugin(plugin, {
        cacheDir: cacheRoot,
        // TODO - Add plugin-specific files (eg. Babel config) to version hash.
        versionHash,
        ...config,
      });
    }) ?? [];

  return {
    ...buildConfig,
    plugins: [...cachingPlugins],
  };
}
