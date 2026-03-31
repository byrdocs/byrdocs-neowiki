// @ts-check
import { defineConfig } from 'astro/config';
import remarkBlank from "./src/plugins/remark-blank.mts";
import remarkDirective from "remark-directive";
import rehypeKatex from "rehype-katex";
import rehypeBlank from "./src/plugins/rehype-blank.mts";
import remarkMath from "remark-math";

// https://astro.build/config
export default defineConfig({
	site:"https://wiki.byrdocs.org",
	markdown:{
		remarkPlugins:[
			remarkBlank,
			remarkDirective,
			remarkMath,
		],
		rehypePlugins:[
			rehypeBlank,
			rehypeKatex,
		],
	}
});
