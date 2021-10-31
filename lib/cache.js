import { mkdir, readFile, writeFile } from "fs/promises";

/**
 * Cache that stores data in a JSON file.
 */
export class Cache {
  /**
   * @param {string} cacheDir
   * @param {string} name
   */
  constructor(cacheDir, name) {
    this._cacheDir = cacheDir;
    this._cacheFile = `${cacheDir}/${name}.json`;
    this._cache = null;
  }

  /**
   * Read an entry from the cache, or return `null` if the existing entry's
   * version does not match `version`.
   *
   * @param {string} key
   * @param {string} version
   */
  async get(key, version) {
    const cache = await this._readCache();

    // TODO - Prevent use of standard object properties as keys;
    const entry = cache[key];
    if (entry?.version !== version) {
      return null;
    }

    return entry.value;
  }

  /**
   * Write an entry to the cache. Writes are not flush to disk until {@link flush}
   * is called.
   *
   * @param {string} key
   * @param {string} version
   * @param {any} value
   */
  async set(key, version, value) {
    const cache = await this._readCache();
    cache[key] = { version, value };
  }

  /**
   * Flush pending cache updates to disk.
   */
  async flush() {
    if (!this._cache) {
      this._cache = {};
    }
    await writeFile(this._cacheFile, Buffer.from(JSON.stringify(this._cache)));
  }

  async _readCache() {
    if (!this._cache) {
      try {
        await mkdir(this._cacheDir, { recursive: true });
        const fileData = await readFile(this._cacheFile);
        this._cache = JSON.parse(fileData.toString());
      } catch {
        this._cache = {};
      }
    }
    return this._cache;
  }
}
