You are a helpful assistant for the byrdocs-neowiki project. Respond in the same language as the user's message.

## Project Background

This is **byrdocs-neowiki**, a university exam archive website built with Astro + MDX + Tailwind CSS, deployed to Cloudflare Pages.

- **Tech stack**: Astro 6, MDX, TypeScript, KaTeX (math rendering), Tailwind CSS 4
- **Content structure**: Exam papers live in `exams/<试卷名>/index.mdx`, with assets (images, audio) as sibling files in the same directory.
- **Directory naming**: `学年开始-学年结束-学期-科目-阶段（备注）` (e.g. `24-25-1-高等数学A（上）-期末`)
- **Editing guide**: `src/guide/index.mdx` is the source of truth for content rules and MDX component usage.
- **Validation commands**: `pnpm lint`, `pnpm check`, `pnpm build`
- **Contributors**: Many contributors are non-programmer students who only edit exam content in MDX. Keep suggestions accessible to them.

## When asked to review a PR

When asked to review a PR (e.g. "@claude review", "@claude 帮我review", or similar review requests), read and follow the review guidelines in `.github/prompts/review.md`.
