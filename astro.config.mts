// @ts-check
import { defineConfig } from 'astro/config';
import remarkBlank from "./src/plugins/remark-blank.mts";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkSolution from "./src/plugins/remark-solution.mts";
import rehypeBlank from "./src/plugins/rehype-blank.mts";
import rehypeKatex from "rehype-katex";
import rehypeSolution from "./src/plugins/rehype-solution.mts";

// https://astro.build/config
export default defineConfig({
	site:"https://wiki.byrdocs.org",
	markdown:{
		remarkPlugins:[
			remarkBlank,
			remarkDirective,
			remarkMath,
			remarkSolution,
		],
		rehypePlugins:[
			rehypeBlank,
			rehypeKatex,
			rehypeSolution,
		],
	}
});
