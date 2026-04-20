type Position = {
    start?: {
        offset?: number;
    };
};

type Node = {
    type: string;
    children?: Node[];
    position?: Position;
    name?: string;
    ordered?: boolean | null;
    attributes?: Array<{
        type: string;
        name: string;
        value: null;
    }>;
};

type ListItemNode = Node & {
    type: "listItem";
    children: Node[];
};

type ListNode = Node & {
    type: "list";
    children: ListItemNode[];
    ordered?: boolean | null;
};

type ParagraphNode = Node & {
    type: "paragraph";
    children: Node[];
};

type MdxJsxFlowElementNode = Node & {
    type: "mdxJsxFlowElement";
    children: Node[];
    name: string;
    attributes: Array<{
        type: "mdxJsxAttribute";
        name: string;
        value: null;
    }>;
};

const isChoicesNode = (node: Node): node is MdxJsxFlowElementNode => node.type === "mdxJsxFlowElement" && node.name === "Choices";
const isUnorderedListNode = (node: Node): node is ListNode => node.type === "list" && node.ordered !== true;

const getListMarker = (node: Node, source: string) => {
    const offset = node.position?.start?.offset;
    return typeof offset === "number" ? source.slice(offset, offset + 1) : "";
};

const createOptionNode = (item: ListItemNode, source: string): MdxJsxFlowElementNode => {
    const [firstChild] = item.children;
    const children = item.children.length === 1 && firstChild?.type === "paragraph"
        ? (firstChild as ParagraphNode).children
        : item.children;
    return {
        type: "mdxJsxFlowElement",
        name: "Option",
        attributes: getListMarker(item, source) === "+" ? [
            {
                type: "mdxJsxAttribute",
                name: "correct",
                value: null,
            },
        ] : [],
        children,
        position: item.position,
    };
};

const transformNode = (node: Node, source: string) => {
    if (!Array.isArray(node.children))
        return;

    if (isChoicesNode(node)) {
        node.children = node.children.flatMap(child => isUnorderedListNode(child)
            ? child.children.map((item: ListItemNode) => createOptionNode(item, source))
            : [child]);
    }

    for (const child of node.children)
        transformNode(child, source);
};

export default function remarkChoices() {
    return (tree: any, file: { value?: unknown }) => {
        transformNode(tree as Node, String(file.value ?? ""));
    };
}
