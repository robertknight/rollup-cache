# rollup-cache

This package provides tools to speed up repeated [Rollup](https://rollupjs.org)
bundle builds by caching steps of the build process to disk.

## Comparison to Rollup's built-in caching

Rollup has a built-in cache used to speed up incremental builds in `watch`
mode. This is an in-memory cache that is lost each time Rollup is restarted
however. `rollup-cache` speeds up the initial build and builds which do not
use `watch` mode by using a disk cache.

## How it works

This package implements two kinds of caching: **plugin caching** and **prebuilding**.

### Plugin caching

The package adds caching for the loading and transforming of code done by
Rollup plugins. By default it is enabled only for official Rollup plugins with
which it is compatible and where it can significantly speed up builds:

- @rollup/plugin-commonjs
- @rollup/plugin-node-resolve
- @rollup/plugin-babel

For other plugins, caching is not supported at the moment. See
[this issue](https://github.com/robertknight/rollup-cache/issues/7) to learn
more.

### Prebuilding

For every JavaScript module included in a bundle, Rollup has to do work to
parse the code, analyze the result and write the contents to the output.

For npm dependencies which do not change between most builds, this
can be avoided by building the npm package into a bundle which is then referenced
from your application bundle. Conceptually this is similar to shared libraries
(aka DLLs) in native applications.

For example, supposing you have a Rollup config that builds `output/app.bundle.js`
from the following entry module:

```js
import { doComplexThing } from 'big-library';

doComplexThing(...);
```

Enabling prebuilding of `big-library` would result in the following in the
output bundle:

```js
import { doComplexThing } from './npm/big-library.bundle.js';

doComplexThing(...);
```

The `big-library` package would be bundled as an ES module in `output/npm/big-library.bundle.js`.
Each time your Rollup build runs, the timestamp of `big-library`'s package.json
file will be checked and the `big-library.bundle.js` bundle will be rebuilt if
it has changed.

In order to use this feature, your application or library bundle must be built
as an ES module (set `output.format` to `es` in the bundle config) and loaded
using `<script type="module" …>` in your HTML. You will also need to make sure
that the tool you are using to serve your assets allows the prebuilt bundles
to be fetched.

## Installation

If you are using npm:

```sh
npm install --save-dev rollup-cache
```

Or for Yarn:

```sh
yarn add --dev rollup-cache
```

## Usage

To enable caching for a bundle, wrap its configuration in a call to `cacheBuild`.
For example, given a Rollup config file `rollup.config.js`:

```js
export default {
  input: { ... },
  output: { ... },
  plugins: [...],
}
```

Caching can be added using:

```js
import { cacheBuild } from 'rollup-cache';

const cacheConfig = {
  name: 'my-app',
  dependencies: ['rollup.config.js'],
  prebuild: ['big-library'],
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

`prebuild` specifies a list of npm packages to prebuild as separate npm bundles.
If omitted, prebuilding will be disabled.

## Configuration

### General options

- `name` specifies a unique name for the cache data. This should be different
  for each bundle.

- `enabled` specifies whether caching should be used for the current build.
  By default this is false for production builds, indicated by the `NODE_ENV`
  environment variable being set to `production`, or true otherwise. It is
  recommended to **disable caching for production builds** to reduce the risk
  of stale cache data being used.

### Plugin caching options

- `cacheDir` specifies a location to write cache files to. _Default: "node_modules/.cache/rollup-cache"_

- `dependencies` is a list of file paths whose contents should be used to
  determine whether to reuse cached results from previous builds. If any of these
  files have changed since the previous build, cached data will be ignored. In
  addition to the files listed here, the following files are automatically
  included:

  - Package metadata: `package.json`
  - Lockfiles: `package-lock.json`, `yarn.lock`

### Prebuild options

- `prebuildDir` specifies a directory to create pre-built npm dependencies in,
  relative to the output directory of the bundle. _Default: "./npm"_

- `prebuild` is a list of npm dependencies or patterns that should be prebuilt
  if they are used by the bundle. For various reasons prebuilding may not work
  with all dependencies, and is generally only valuable for large dependencies.
  Therefore the dependencies to consider for prebuilding have to be listed explicitly.

  The recommended approach to using this option is to start with an empty
  `prebuild` list and then incrementally add your largest dependencies to it.
  If you encounter an error building the bundle or loading your application,
  skip that dependency.

## Clearing the cache

Cache data is written to `node_modules/.cache/rollup-cache` by default, or
the location specified by the `cacheDir` option otherwise.

To clear the cache explicitly, remove all files in this directory. If your build
scripts have a `clean` task that remove all existing build assets etc, you may
want to add the cache directory to it.
