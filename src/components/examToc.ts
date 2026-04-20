import type { MarkdownHeading } from "@astrojs/markdown-remark";

export type TocItem = {
  heading: MarkdownHeading;
  children: TocItem[];
};

export const isExamTocHeading = (heading: MarkdownHeading) =>
  heading.depth >= 2 && heading.depth <= 3;

export const buildExamTocTree = (headings: MarkdownHeading[]) => {
  const items = headings.filter(isExamTocHeading);
  const roots: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const heading of items) {
    const node: TocItem = {
      heading,
      children: [],
    };

    while (
      stack.length > 0 &&
      stack[stack.length - 1].heading.depth >= heading.depth
    ) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  }

  return roots;
};
