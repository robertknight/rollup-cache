import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";

import { Cache } from "./lib/cache.js";

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
 * @typedef PluginCacheConfig
 * @prop {string} cacheDir
 * @prop {string} versionHash
 */

/**
 * @param {any} plugin
 * @param {PluginCacheConfig} config
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

  /** @type {import("rollup").PluginHooks} */
  const cachedPlugin = {
    ...plugin,

    name: `cached(${plugin.name})`,

    async buildStart(options) {
      if (plugin.buildStart) {
        await plugin.buildStart.call(this, options);
      }
    },

    async buildEnd(error) {
      await cache.flush();
      if (plugin.buildEnd) {
        await plugin.buildEnd.call(this, error);
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
      const result = await plugin.resolveId.call(this, id, importer, options);
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
      const result = await plugin.load.call(this, id);
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
      const result = await plugin.transform.call(this, code, id);
      await cache.set(cacheKey, version, result);
      return result;
    },
  };

  return cachedPlugin;
}

/**
 * @param {{ name: string }} plugin
 */
function pluginCacheConfig(plugin) {
  switch (plugin.name) {
    case "babel":
    case "commonjs":
    case "node-resolve":
      return {};
    default:
      return null;
  }
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
