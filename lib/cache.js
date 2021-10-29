import { mkdir, readFile, writeFile } from "fs/promises";

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
   * @param {string} key
   * @param {string} version
   * @param {any} value
   */
  async set(key, version, value) {
    const cache = await this._readCache();
    cache[key] = { version, value };
  }

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
