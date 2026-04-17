import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  COMPONENTS,
  MARKER_DOCS,
  type ComponentName,
  type ComponentPropMetadata,
} from "../lib/metadata";
import {
  findAttributeAtOffset,
  findChoiceMarkerAtOffset,
  findTagAtOffset,
  findTagNameAtOffset,
  getEnclosingChoicesBlock,
  isOffsetIgnored,
} from "../lib/parser";
import { getDocumentState, clearDocumentState } from "../documentState";
import { SEMANTIC_LEGEND } from "../constants";
import {
  buildAttributeHoverMarkdown,
  buildAttributeNameCompletionItems,
  buildAttributeValueCompletionItems,
  buildClosingTagCompletionItems,
  buildComponentHoverMarkdown,
  buildOpeningTagCompletionItems,
  getCompletionContext,
} from "./completions";
import type { ToggleTarget, ToggleTargetPayload } from "./types";
import { buildRange, positionIntersectsRange, reviveUri } from "../utils/vscode";
import { asRecord } from "../utils/common";
import { getWikiWorkspaceFolderForUri, isSupportedDocument } from "../workspace";

export function createCompletionProvider(): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(document, position) {
      if (!isSupportedDocument(document)) {
        return [];
      }

      const documentState = getDocumentState(document);
      const offset = document.offsetAt(position);
      if (isOffsetIgnored(offset, documentState.ignoredRanges)) {
        return [];
      }

      const completionContext = getCompletionContext(document, position);
      if (!completionContext) {
        return [];
      }

      switch (completionContext.kind) {
        case "closingTag":
          return buildClosingTagCompletionItems(
            document,
            position,
            documentState,
            completionContext,
          );
        case "openingTag":
          return buildOpeningTagCompletionItems(
            document,
            position,
            documentState,
            completionContext,
          );
        case "attributeName":
          return buildAttributeNameCompletionItems(
            document,
            position,
            completionContext,
          );
        case "attributeValue":
          return buildAttributeValueCompletionItems(
            document,
            position,
            completionContext,
          );
      }
    },
  };
}

export function createHoverProvider(): vscode.HoverProvider {
  return {
    provideHover(document, position) {
      if (!isSupportedDocument(document)) {
        return null;
      }

      const documentState = getDocumentState(document);
      const offset = document.offsetAt(position);
      if (isOffsetIgnored(offset, documentState.ignoredRanges)) {
        return null;
      }

      const componentTag = findTagNameAtOffset(documentState.tags, offset);
      if (componentTag) {
        return new vscode.Hover(
          buildComponentHoverMarkdown(document, componentTag.name),
          buildRange(document, componentTag.nameStart, componentTag.nameEnd),
        );
      }

      const tag = findTagAtOffset(documentState.tags, offset);
      const attribute = findAttributeAtOffset(tag, offset);
      if (attribute && tag) {
        return new vscode.Hover(
          buildAttributeHoverMarkdown(tag.name, attribute.name),
          buildRange(document, attribute.start, attribute.end),
        );
      }

      const marker = findChoiceMarkerAtOffset(documentState.choiceMarkers, offset);
      if (marker) {
        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(
          `${MARKER_DOCS[marker.marker] || "选择题选项语法。"}\n\n`,
        );
        markdown.appendMarkdown("点击行尾的 inlay hint 可直接切换正误。");
        return new vscode.Hover(
          markdown,
          buildRange(document, marker.start, marker.end),
        );
      }

      return null;
    },
  };
}

export function createDefinitionProvider(): vscode.DefinitionProvider {
  return {
    provideDefinition(document, position) {
      if (!isSupportedDocument(document)) {
        return null;
      }

      const documentState = getDocumentState(document);
      const offset = document.offsetAt(position);
      const componentTag = findTagNameAtOffset(documentState.tags, offset);
      if (!componentTag) {
        return null;
      }

      const workspaceFolder = getWikiWorkspaceFolderForUri(document.uri);
      if (!workspaceFolder) {
        return null;
      }

      const component = COMPONENTS[componentTag.name];
      const targetPath = path.join(workspaceFolder.uri.fsPath, component.file);
      if (!fs.existsSync(targetPath)) {
        return null;
      }

      return new vscode.Location(
        vscode.Uri.file(targetPath),
        new vscode.Position(0, 0),
      );
    },
  };
}

export function createFoldingRangeProvider(): vscode.FoldingRangeProvider {
  return {
    provideFoldingRanges(document) {
      if (!isSupportedDocument(document)) {
        return [];
      }

      const ranges: vscode.FoldingRange[] = [];
      const frontmatterMatch = document
        .getText()
        .match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
      if (frontmatterMatch) {
        const endLine = document.positionAt(frontmatterMatch[0].length).line;
        if (endLine > 0) {
          ranges.push(
            new vscode.FoldingRange(
              0,
              Math.max(0, endLine - 1),
              vscode.FoldingRangeKind.Region,
            ),
          );
        }
      }

      const documentState = getDocumentState(document);
      for (const pair of documentState.pairs) {
        const startLine = document.positionAt(pair.open.start).line;
        const endLine = document.positionAt(pair.close.end).line;
        if (endLine > startLine) {
          ranges.push(
            new vscode.FoldingRange(
              startLine,
              endLine,
              vscode.FoldingRangeKind.Region,
            ),
          );
        }
      }

      return ranges;
    },
  };
}

export function createInlayHintsProvider(): vscode.InlayHintsProvider {
  return {
    provideInlayHints(document, visibleRange) {
      if (!isSupportedDocument(document)) {
        return [];
      }

      const documentState = getDocumentState(document);
      const hints: vscode.InlayHint[] = [];

      for (const marker of documentState.choiceMarkers) {
        const choicesBlock = getEnclosingChoicesBlock(
          documentState.pairs,
          marker.start,
        );
        const hasExplicitAnswers =
          choicesBlock !== null &&
          hasExplicitAnswersInChoicesBlock(documentState, choicesBlock);
        if (marker.marker === "-" && !hasExplicitAnswers) {
          continue;
        }

        const position = getChoiceMarkerHintPosition(document, marker);
        if (!positionIntersectsRange(position, visibleRange)) {
          continue;
        }

        hints.push(
          createToggleInlayHint(
            document.uri,
            position,
            {
              kind: "marker",
              line: document.positionAt(marker.start).line,
            },
            marker.marker === "+" ? "正确答案" : "错误答案",
            {
              paddingRight: true,
            },
          ),
        );
      }

      for (const tag of documentState.tags) {
        if (tag.isClosing || tag.name !== "Option") {
          continue;
        }

        const choicesBlock = getEnclosingChoicesBlock(
          documentState.pairs,
          tag.start,
        );
        if (!choicesBlock) {
          continue;
        }

        const isCorrect = tag.attributes.some(
          (attribute) => attribute.name === "correct",
        );
        if (
          !isCorrect &&
          !hasExplicitAnswersInChoicesBlock(documentState, choicesBlock)
        ) {
          continue;
        }

        const position = document.positionAt(tag.end);
        if (!positionIntersectsRange(position, visibleRange)) {
          continue;
        }

        const label = isCorrect ? "正确答案" : "错误答案";

        hints.push(
          createToggleInlayHint(
            document.uri,
            position,
            {
              kind: "optionTag",
              line: document.positionAt(tag.start).line,
              character: document.positionAt(tag.nameStart).character,
            },
            label,
            {
              paddingLeft: true,
              paddingRight: true,
            },
          ),
        );
      }

      return hints;
    },
  };
}

export function createSemanticTokensProvider(): vscode.DocumentSemanticTokensProvider {
  return {
    provideDocumentSemanticTokens(document) {
      const builder = new vscode.SemanticTokensBuilder(SEMANTIC_LEGEND);
      if (!isSupportedDocument(document)) {
        return builder.build();
      }

      const documentState = getDocumentState(document);
      for (const tag of documentState.tags) {
        builder.push(buildRange(document, tag.nameStart, tag.nameEnd), "class");

        for (const attribute of tag.attributes) {
          builder.push(
            buildRange(document, attribute.start, attribute.end),
            isBooleanAttribute(tag.name, attribute.name) ? "keyword" : "property",
          );
        }
      }

      for (const marker of documentState.choiceMarkers) {
        builder.push(buildRange(document, marker.start, marker.end), "operator");
      }

      return builder.build();
    },
  };
}

export async function toggleChoiceCorrectness(rawTarget: unknown): Promise<void> {
  const target = normalizeToggleTarget(rawTarget);
  if (!target) {
    return;
  }

  const document = await vscode.workspace.openTextDocument(target.uri);
  if (!isSupportedDocument(document)) {
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  if (target.kind === "marker") {
    const line = document.lineAt(target.line);
    const match = /^(\s*)([+-])(?=\s+)/.exec(line.text);
    if (!match) {
      return;
    }

    const markerStart = match[1]?.length ?? 0;
    const nextMarker = match[2] === "+" ? "-" : "+";
    edit.replace(
      document.uri,
      new vscode.Range(
        new vscode.Position(target.line, markerStart),
        new vscode.Position(target.line, markerStart + 1),
      ),
      nextMarker,
    );
  } else {
    const documentState = getDocumentState(document);
    const tag = documentState.tags.find((candidate) => {
      return (
        !candidate.isClosing &&
        candidate.name === "Option" &&
        document.positionAt(candidate.nameStart).line === target.line &&
        document.positionAt(candidate.nameStart).character === target.character
      );
    });

    if (!tag) {
      return;
    }

    const correctAttribute = tag.attributes.find(
      (attribute) => attribute.name === "correct",
    );
    if (correctAttribute) {
      const source = document.getText();
      let removeStart = correctAttribute.start;
      while (
        removeStart > tag.nameEnd &&
        /\s/.test(source.charAt(removeStart - 1))
      ) {
        removeStart -= 1;
      }

      edit.delete(
        document.uri,
        buildRange(document, removeStart, correctAttribute.end),
      );
    } else {
      const insertOffset = tag.end - (tag.selfClosing ? 2 : 1);
      edit.insert(document.uri, document.positionAt(insertOffset), " correct");
    }
  }

  await vscode.workspace.applyEdit(edit);
  clearDocumentState(document.uri);
}

function getChoiceMarkerHintPosition(
  document: vscode.TextDocument,
  marker: ReturnType<typeof getDocumentState>["choiceMarkers"][number],
): vscode.Position {
  const source = document.getText();
  let offset = marker.end;

  while (
    offset < marker.lineEnd &&
    (source.charAt(offset) === " " || source.charAt(offset) === "\t")
  ) {
    offset += 1;
  }

  return document.positionAt(offset);
}

function hasExplicitAnswersInChoicesBlock(
  documentState: ReturnType<typeof getDocumentState>,
  choicesBlock: NonNullable<ReturnType<typeof getEnclosingChoicesBlock>>,
): boolean {
  const contentStart = choicesBlock.open.end;
  const contentEnd = choicesBlock.close.start;

  const hasCorrectMarker = documentState.choiceMarkers.some(
    (marker) =>
      marker.marker === "+" &&
      marker.start >= contentStart &&
      marker.start < contentEnd,
  );
  if (hasCorrectMarker) {
    return true;
  }

  return documentState.tags.some(
    (tag) =>
      !tag.isClosing &&
      tag.name === "Option" &&
      tag.start >= contentStart &&
      tag.start < contentEnd &&
      tag.attributes.some((attribute) => attribute.name === "correct"),
  );
}

function createToggleInlayHint(
  uri: vscode.Uri,
  position: vscode.Position,
  target: ToggleTargetPayload,
  label: string,
  spacing: {
    readonly paddingLeft?: boolean;
    readonly paddingRight?: boolean;
  } = {},
): vscode.InlayHint {
  const labelParts: vscode.InlayHintLabelPart[] = [
    {
      value: ` ${label} `,
      tooltip: "单击切换正误状态",
      command: {
        command: "byrdocsWiki.toggleChoiceCorrectness",
        title: "切换选项正误",
        arguments: [{ ...target, uri }],
      },
    },
  ];
  const hint = new vscode.InlayHint(position, labelParts, vscode.InlayHintKind.Type);
  if (spacing.paddingLeft !== undefined) {
    hint.paddingLeft = spacing.paddingLeft;
  }
  if (spacing.paddingRight !== undefined) {
    hint.paddingRight = spacing.paddingRight;
  }
  return hint;
}

function isBooleanAttribute(
  componentName: ComponentName,
  attributeName: string,
): boolean {
  const props = COMPONENTS[componentName].props as Readonly<
    Record<string, ComponentPropMetadata>
  >;
  return props[attributeName]?.valueKind === "boolean-attr";
}

function normalizeToggleTarget(rawTarget: unknown): ToggleTarget | null {
  const record = asRecord(rawTarget);
  const revivedUri = reviveUri(record.uri);
  if (!revivedUri) {
    return null;
  }

  if (record.kind === "marker" && typeof record.line === "number") {
    return {
      kind: "marker",
      uri: revivedUri,
      line: record.line,
    };
  }

  if (
    record.kind === "optionTag" &&
    typeof record.line === "number" &&
    typeof record.character === "number"
  ) {
    return {
      kind: "optionTag",
      uri: revivedUri,
      line: record.line,
      character: record.character,
    };
  }

  return null;
}
