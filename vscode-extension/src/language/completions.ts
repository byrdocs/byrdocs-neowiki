import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  COMPONENTS,
  type ComponentName,
  type ComponentPropMetadata,
  isComponentName,
} from "../lib/metadata";
import {
  getOpenComponentStack,
  getEnclosingChoicesBlock,
  type ParsedDocumentSyntax,
} from "../lib/parser";
import type {
  AttributeNameCompletionContext,
  AttributeValueCompletionContext,
  ClosingTagCompletionContext,
  CompletionContext,
  OpeningTagCompletionContext,
  RelativePathCompletionEntry,
} from "./types";
import { getWikiWorkspaceFolderForUri } from "../workspace";

export function buildClosingTagCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  documentState: ParsedDocumentSyntax,
  completionContext: ClosingTagCompletionContext,
): vscode.CompletionItem[] {
  const offset = document.offsetAt(position);
  const openStack = getOpenComponentStack(documentState.tags, offset);
  const uniqueNames: ComponentName[] = [];

  for (let index = openStack.length - 1; index >= 0; index -= 1) {
    const name = openStack[index]?.name;
    if (name && !uniqueNames.includes(name)) {
      uniqueNames.push(name);
    }
  }

  const replaceRange = buildTagCompletionReplaceRange(
    document,
    completionContext.replaceStart,
    position,
  );

  return uniqueNames
    .filter((name) =>
      name.toLowerCase().startsWith(completionContext.prefix.toLowerCase()),
    )
    .map((name, index) => {
      const item = new vscode.CompletionItem(
        `</${name}>`,
        vscode.CompletionItemKind.Class,
      );
      item.range = replaceRange;
      item.insertText = `${name}>`;
      item.detail = "补全结束标签";
      item.sortText = String(index).padStart(2, "0");
      return item;
    });
}

export function buildOpeningTagCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  documentState: ParsedDocumentSyntax,
  completionContext: OpeningTagCompletionContext,
): vscode.CompletionItem[] {
  const replaceRange = buildTagCompletionReplaceRange(
    document,
    completionContext.replaceStart,
    position,
  );
  const insideChoices = Boolean(
    getEnclosingChoicesBlock(documentState.pairs, document.offsetAt(position)),
  );
  const items: vscode.CompletionItem[] = [];

  for (const [componentName, component] of Object.entries(COMPONENTS) as [
    ComponentName,
    (typeof COMPONENTS)[ComponentName],
  ][]) {
    if (
      completionContext.prefix &&
      !componentName
        .toLowerCase()
        .startsWith(completionContext.prefix.toLowerCase())
    ) {
      continue;
    }

    component.snippets.forEach((snippet, snippetIndex) => {
      const item = new vscode.CompletionItem(
        snippet.label,
        vscode.CompletionItemKind.Class,
      );
      item.range = replaceRange;
      item.insertText = new vscode.SnippetString(snippet.body);
      item.detail = snippet.description;
      item.documentation = buildComponentHoverMarkdown(document, componentName);
      item.sortText = `${insideChoices && componentName === "Option" ? "00" : "10"}-${componentName}-${snippetIndex}`;
      items.push(item);
    });
  }

  return items;
}

export function buildAttributeNameCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  completionContext: AttributeNameCompletionContext,
): vscode.CompletionItem[] {
  const component = COMPONENTS[completionContext.componentName];
  const replaceRange = new vscode.Range(
    document.positionAt(completionContext.replaceStart),
    position,
  );
  const existingAttributes = new Set(completionContext.existingAttributes);
  const items: vscode.CompletionItem[] = [];

  for (const [attributeName, metadata] of Object.entries(component.props)) {
    if (
      completionContext.prefix &&
      !attributeName
        .toLowerCase()
        .startsWith(completionContext.prefix.toLowerCase())
    ) {
      continue;
    }

    if (
      existingAttributes.has(attributeName) &&
      attributeName !== completionContext.prefix
    ) {
      continue;
    }

    const item = new vscode.CompletionItem(
      attributeName,
      vscode.CompletionItemKind.Property,
    );
    item.range = replaceRange;
    item.documentation = buildAttributeHoverMarkdown(
      completionContext.componentName,
      attributeName,
    );
    item.insertText =
      metadata.valueKind === "boolean-attr"
        ? attributeName
        : new vscode.SnippetString(
            `${attributeName}="${metadata.values?.[0] || defaultAttributeValue(attributeName)}"`,
          );
    item.detail = metadata.description;
    items.push(item);
  }

  return items;
}

export function buildAttributeValueCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  completionContext: AttributeValueCompletionContext,
): vscode.CompletionItem[] {
  const component = COMPONENTS[completionContext.componentName];
  const props = component.props as Readonly<
    Record<string, ComponentPropMetadata>
  >;
  const attribute = props[completionContext.attributeName];
  if (!attribute) {
    return [];
  }

  const replaceRange = new vscode.Range(
    document.positionAt(completionContext.replaceStart),
    position,
  );
  const values = new Set<string>();
  const relativePathEntries =
    completionContext.attributeName === "src"
      ? collectRelativePathCompletions(
          document,
          completionContext.componentName,
          completionContext.prefix,
        )
      : [];

  for (const value of attribute.values || []) {
    values.add(value);
  }

  if (completionContext.attributeName === "item") {
    ["1", "2", "3", "4"].forEach((value) => values.add(value));
  }

  if (completionContext.attributeName === "src") {
    for (const entry of relativePathEntries) {
      values.add(entry.value);
    }
  }

  return [...values]
    .filter((value) =>
      value.toLowerCase().startsWith(completionContext.prefix.toLowerCase()),
    )
    .map((value) => {
      const relativeEntry = relativePathEntries.find(
        (entry) => entry.value === value,
      );
      const item = new vscode.CompletionItem(
        value,
        relativeEntry?.kind ||
          (completionContext.attributeName === "src"
            ? vscode.CompletionItemKind.File
            : vscode.CompletionItemKind.Value),
      );
      item.range = replaceRange;
      item.insertText = value;
      item.documentation = buildAttributeHoverMarkdown(
        completionContext.componentName,
        completionContext.attributeName,
      );
      return item;
    });
}

export function buildComponentHoverMarkdown(
  document: vscode.TextDocument,
  componentName: ComponentName,
): vscode.MarkdownString {
  const component = COMPONENTS[componentName];
  const markdown = new vscode.MarkdownString();
  markdown.appendMarkdown(`**<${componentName}>**\n\n${component.description}`);

  const props = Object.entries(component.props);
  if (props.length > 0) {
    markdown.appendMarkdown("\n\n**属性**\n");
    for (const [attributeName, metadata] of props) {
      const valueInfo = metadata.values?.length
        ? ` 可选值：\`${metadata.values.join("` `")}\`。`
        : "";
      markdown.appendMarkdown(
        `\n- \`${attributeName}\`：${metadata.description}${valueInfo}`,
      );
    }
  }

  const workspaceFolder = getWikiWorkspaceFolderForUri(document.uri);
  if (workspaceFolder) {
    const targetPath = path.join(workspaceFolder.uri.fsPath, component.file);
    markdown.appendMarkdown(
      `\n\n实现文件：\`${path.relative(workspaceFolder.uri.fsPath, targetPath)}\``,
    );
  }

  return markdown;
}

export function buildAttributeHoverMarkdown(
  componentName: ComponentName,
  attributeName: string,
): vscode.MarkdownString {
  const props = COMPONENTS[componentName].props as Readonly<
    Record<string, ComponentPropMetadata>
  >;
  const metadata = props[attributeName];
  const markdown = new vscode.MarkdownString();
  if (!metadata) {
    markdown.appendMarkdown(`\`${attributeName}\``);
    return markdown;
  }

  markdown.appendMarkdown(
    `**${componentName}.${attributeName}**\n\n${metadata.description}`,
  );
  if (metadata.values?.length) {
    markdown.appendMarkdown(
      `\n\n可选值：\`${metadata.values.join("` `")}\``,
    );
  }

  return markdown;
}

export function getCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position,
): CompletionContext | null {
  const offset = document.offsetAt(position);
  const contextStart = Math.max(0, offset - 500);
  const beforeCursor = document.getText(
    new vscode.Range(document.positionAt(contextStart), position),
  );
  const lastTagStart = beforeCursor.lastIndexOf("<");
  const lastTagEnd = beforeCursor.lastIndexOf(">");
  if (lastTagStart === -1 || lastTagEnd > lastTagStart) {
    return null;
  }

  const rawTag = beforeCursor.slice(lastTagStart);
  const tagStartOffset = contextStart + lastTagStart;

  const closingMatch = rawTag.match(/^<\/([A-Z][A-Za-z0-9]*)?$/);
  if (closingMatch) {
    return {
      kind: "closingTag",
      prefix: closingMatch[1] || "",
      replaceStart: offset - (closingMatch[1]?.length || 0),
    };
  }

  const openingMatch = rawTag.match(/^<([A-Z][A-Za-z0-9]*)?$/);
  if (openingMatch) {
    return {
      kind: "openingTag",
      prefix: openingMatch[1] || "",
      replaceStart: tagStartOffset + 1,
    };
  }

  const startTagMatch = rawTag.match(/^<([A-Z][A-Za-z0-9]*)([\s\S]*)$/);
  if (!startTagMatch) {
    return null;
  }

  const rawComponentName = startTagMatch[1] || "";
  const afterName = startTagMatch[2] || "";
  if (!isComponentName(rawComponentName)) {
    return {
      kind: "openingTag",
      prefix: rawComponentName,
      replaceStart: tagStartOffset + 1,
    };
  }

  const doubleQuotedValueMatch = afterName.match(
    /([A-Za-z][\w-]*)\s*=\s*"([^"]*)$/,
  );
  const singleQuotedValueMatch = afterName.match(
    /([A-Za-z][\w-]*)\s*=\s*'([^']*)$/,
  );
  const valueMatch = doubleQuotedValueMatch || singleQuotedValueMatch;
  if (valueMatch) {
    return {
      kind: "attributeValue",
      componentName: rawComponentName,
      attributeName: valueMatch[1] || "",
      prefix: valueMatch[2] || "",
      replaceStart: offset - (valueMatch[2]?.length || 0),
    };
  }

  const attributePrefixMatch = afterName.match(/(?:^|\s)([A-Za-z][\w-]*)?$/);
  if (!attributePrefixMatch) {
    return null;
  }

  return {
    kind: "attributeName",
    componentName: rawComponentName,
    prefix: attributePrefixMatch[1] || "",
    replaceStart: offset - (attributePrefixMatch[1]?.length || 0),
    existingAttributes: extractExistingAttributes(afterName),
  };
}

function buildTagCompletionReplaceRange(
  document: vscode.TextDocument,
  replaceStart: number,
  position: vscode.Position,
): vscode.Range {
  const line = document.lineAt(position.line);
  const shouldConsumeAutoClosedAngleBracket =
    position.character < line.text.length &&
    line.text.charAt(position.character) === ">";

  return new vscode.Range(
    document.positionAt(replaceStart),
    shouldConsumeAutoClosedAngleBracket
      ? position.translate(0, 1)
      : position,
  );
}

function collectRelativePathCompletions(
  document: vscode.TextDocument,
  componentName: ComponentName,
  prefix: string,
): RelativePathCompletionEntry[] {
  if (document.uri.scheme !== "file") {
    return [];
  }

  try {
    const documentDirectory = path.dirname(document.uri.fsPath);
    const normalizedPrefix = prefix.replaceAll("\\", "/");
    const hasExplicitCurrentDirectory = normalizedPrefix.startsWith("./");
    const cleanedPrefix = hasExplicitCurrentDirectory
      ? normalizedPrefix.slice(2)
      : normalizedPrefix;
    if (cleanedPrefix.startsWith("../") || cleanedPrefix === "..") {
      return [];
    }

    const slashIndex = cleanedPrefix.lastIndexOf("/");
    const relativeDirectoryPrefix =
      slashIndex >= 0 ? cleanedPrefix.slice(0, slashIndex + 1) : "";
    const completionDirectory = path.resolve(
      documentDirectory,
      relativeDirectoryPrefix || ".",
    );
    if (
      path.relative(documentDirectory, completionDirectory).startsWith("..")
    ) {
      return [];
    }

    const entries = fs.readdirSync(completionDirectory, { withFileTypes: true });
    const extensions =
      componentName === "Audio"
        ? /\.(aac|flac|m4a|mp3|ogg|wav)$/i
        : /\.(avif|gif|jpe?g|png|svg|webp)$/i;
    const prefixBase = hasExplicitCurrentDirectory ? "./" : "";

    return entries
      .flatMap((entry): RelativePathCompletionEntry[] => {
        if (entry.isDirectory()) {
          return [
            {
              value: `${prefixBase}${relativeDirectoryPrefix}${entry.name}/`,
              kind: vscode.CompletionItemKind.Folder,
            },
          ];
        }

        if (
          entry.isFile() &&
          entry.name !== "index.mdx" &&
          extensions.test(entry.name)
        ) {
          return [
            {
              value: `${prefixBase}${relativeDirectoryPrefix}${entry.name}`,
              kind: vscode.CompletionItemKind.File,
            },
          ];
        }

        return [];
      })
      .sort((left, right) =>
        left.value.localeCompare(right.value, "zh-Hans-CN"),
      );
  } catch {
    return [];
  }
}

function defaultAttributeValue(attributeName: string): string {
  if (attributeName === "src") {
    return "example";
  }

  if (attributeName === "item") {
    return "1";
  }

  return "";
}

function extractExistingAttributes(source: string): string[] {
  return [...source.matchAll(/([A-Za-z][\w-]*)(?=(?:\s*=|\s|$))/g)]
    .map((match) => match[1] || "")
    .filter(Boolean);
}
