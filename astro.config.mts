// @ts-check
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import {defineConfig} from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkChoices from "./src/plugins/remarkChoices";

// https://astro.build/config
export default defineConfig({
	site:"https://wiki.byrdocs.org",
	integrations:[mdx()],
	markdown:{
		remarkPlugins:[remarkMath,remarkChoices],
		rehypePlugins:[rehypeKatex],
	},
	vite:{
		plugins:[tailwindcss()],
	},
});
