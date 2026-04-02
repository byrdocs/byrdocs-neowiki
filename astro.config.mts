// @ts-check
import { defineConfig } from 'astro/config';
import {remarkBlank,rehypeBlank} from "./src/plugins/blank.mts";
import remarkDirective from "remark-directive";
import {remarkFigure,rehypeFigure} from "./src/plugins/figure.mts";
import remarkMath from "remark-math";
import {remarkSlot} from "./src/plugins/slot.mts";
import {remarkSolution,rehypeSolution} from "./src/plugins/solution.mts";
import rehypeKatex from "rehype-katex";

// https://astro.build/config
export default defineConfig({
	site:"https://wiki.byrdocs.org",
	markdown:{
		remarkPlugins:[
			remarkBlank,
			remarkDirective,
			remarkFigure,
			remarkMath,
			remarkSlot,
			remarkSolution,
		],
		rehypePlugins:[
			rehypeBlank,
			rehypeKatex,
			rehypeFigure,
			rehypeSolution,
		],
	}
});
