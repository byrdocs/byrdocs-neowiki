Review this pull request and submit a GitHub PR review.

Write all review summaries, findings, suggestions, and comments in Chinese.

## Review Scope

Treat `src/others/guide.mdx` as the source of truth for content rules, and use `src/others/test.mdx` as a concrete example of valid exam MDX usage.

### Exam files (`exams/`)

- Every exam must use the directory layout `exams/<试卷名>/index.mdx`. Related image or audio assets must live as sibling files in that same directory, not under `public/`.
- Directory names must follow the `学年开始-学年结束-学期-科目-阶段（备注）` naming convention.
- Frontmatter must be complete and normalized:
  - `时间`: use `xxxx-yyyy学年第[一/二]学期` format
  - `科目`: official Chinese full course name
  - `阶段`: `期中` or `期末`
  - `类型`: `本科` or `研究生`
  - Optional fields (`学院`, `来源`, `答案完成度`) must follow the guide if present
- Body must use standard Markdown and the repository's supported MDX components (`Blank`, `Slot`, `Choices`, `Option`, `Solution`, `Figure`, `Audio`). No custom JSX, scripts, or inline styles.
- Heading structure: major questions use `##`, subquestions use `###` only when appropriate. Choice/blank/judgment questions should use lists instead of overusing headings.
- `Figure` / `Audio` references must use local file names within the same exam directory.
- Prefer actionable comments tied to rendering or editorial correctness. Avoid low-value wording suggestions unless wording creates ambiguity.
- **Answer correctness**: For exams that contain answers (marked with `+` in `<Choices>`, content inside `<Blank>...</Blank>`, or content inside `<Solution>...</Solution>`), verify the correctness of the provided answers. This applies to all subjects. If an answer is wrong, point out the specific question, explain why it is incorrect, and provide the correct answer.

### Site code (`src/`, `astro.config.mts`, config files)

- Review as an Astro + TypeScript project.
- Focus on regressions, broken routes, invalid MDX integration, content rendering issues, or build/check failures.
- Avoid subjective refactoring suggestions.

### General principles

- If a PR only updates exam content, avoid requesting engineering-heavy refactors. Focus on whether the content is renderable, follows the editing guide, and will pass `pnpm lint`, `pnpm check`, and `pnpm build`.
- Before suggesting major structural changes, verify compatibility with the existing editor workflow for non-programmer contributors. Changes that make exam editing harder should be treated as a risk.
- Prefer findings only when the change breaks the guide or likely harms reader experience.

## Review Decision

- If everything looks good, **APPROVE** the PR.
- If there are issues that must be fixed, **REQUEST CHANGES** and clearly explain each problem.

## Your Comment Formatting (for your own review comments, NOT for checking contributor code)

When writing your review comments, you must follow these rules so GitHub renders them correctly:

- **LaTeX spacing**: GitHub renders LaTeX only when dollar signs have spaces on both sides. In YOUR comments, inline math must always have a space immediately outside each `$`, regardless of surrounding punctuation or brackets. Examples:
  - Correct: ` $E=mc^2$ `, `( $E=mc^2$ )`, ` $E=mc^2$ .`, ` $E=mc^2$ ，`
  - Wrong: `$E=mc^2$`, `($E=mc^2$)`, ` $E=mc^2$.`, ` $E=mc^2$，`
  - Display math `$$` blocks must also have surrounding blank lines or spaces.
- Do NOT flag contributors' LaTeX for spacing issues — their code is rendered by MDX/KaTeX which handles spacing differently from GitHub Markdown.
