# rollup-cache

This package provides tools to speed up repeated [Rollup](https://rollupjs.org)
bundle builds by caching certain steps in the build process to disk.

Rollup has a built-in cache used to speed up incremental builds in `watch`
mode. This is an in-memory cache that is lost each time Rollup is restarted
however. `rollup-cache` speeds up the initial build and builds which do not
use `watch` mode.

## How it works

The package adds caching for the loading and transforming of code done by
certain Rollup plugins. By default it enables caching only for official Rollup
plugins which are both frequently used and relatively slow.

## Installation

```sh
yarn add --dev rollup-cache
```

## Usage

To enable caching for a bundle, wrap the configuration for the bundle in a call
to `cacheBuild`. For example, given a Rollup config file `rollup.config.js`:

```js
export default {
  input: { ... },
  output: { ... },
  plugins: [...],
}
```

Change it as follows:

```js
import { cacheBuild } from 'rollup-cache';

const cacheConfig = {
  name: 'my-app',
  dependencies: ['rollup.config.js'],
};

export default cacheBuild(cacheConfig, {
  input: { ... },
  output: { ... },
  plugins: [...],
})
```

The `name` option specifies a name for the cache to use. This should be different
for each bundle.

If any of the files listed in the `dependencies` option have changed since the
previous build, then the existing cache will be discarded.

## Cache options

- `name` specifies a unique name for the cache data. This should be different
  for each bundle.
- `cacheDir` specifies a location to write cache files to. _Default: node_modules/.cache/rollup-cache_
- `dependencies` is a list of file paths whose contents should be used to
  determine whether existing cache entries are valid. In addition to the files
  listed here, the following files are automatically considered:

  - Package manager files listing dependencies: `package.json`, `package-lock.json`,
    `yarn.lock`

- `enabled` specifies whether caching should be used for the current build.
  By default this is false for production builds, indicated by the `NODE_ENV`
  environment variable being set to `production`, or true otherwise.

  It is recommended to disable caching for production builds to reduce the risk
  of stale cache data being used.

## Clearing the cache

Cache data is written to `node_modules/.cache/rollup-cache` by default, or
the location specified by the `cacheDir` option otherwise.

To clear the cache explicitly, remove all files in this directory. If your build
scripts have a `clean` task that remove all existing build assets etc, you may
want to add the cache directory to it.
