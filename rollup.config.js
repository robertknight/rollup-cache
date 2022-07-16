/**
 * @type {import("rollup").RollupOptions}
 */
export default {
	input: "index.js",
	output: {
		file: "index.cjs",
		format: "cjs",
		exports: "auto",
	},
};
