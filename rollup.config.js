import pkg from "./package.json";

const OUTPUT_COMMON_JS_FILE = pkg.exports.require;

/**
 * @type {import("rollup").RollupOptions}
 */
export default {
  input: "index.js",
  output: {
    file: OUTPUT_COMMON_JS_FILE,
    format: "cjs",
    exports: "auto",
  },
  external: [
    // Node standard library
    "crypto",
    "fs",
    "fs/promises",
    "module",
    "path",

    // Rollup and plugins
    "rollup",
    /@rollup\/.*/,
  ],
};
