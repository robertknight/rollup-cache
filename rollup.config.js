/**
 * @type {import("rollup").RollupOptions}
 */
export default {
	input: "index.js",
	output: {
		file: "index-cjs.js",
		format: "cjs",
		exports: "auto",
	},
};
