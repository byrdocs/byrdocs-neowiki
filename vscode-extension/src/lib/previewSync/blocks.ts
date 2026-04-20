import * as vscode from "vscode";
import type { ComponentName } from "../metadata";
import type { ParsedDocumentSyntax, ParsedTag } from "../parser";
import {
  type PreviewSyncBlock,
  type PreviewSyncBlockKind,
} from "./types";
import { normalizePreviewSyncText } from "./text";

const COMPONENT_KIND_MAP: Partial<Record<ComponentName, PreviewSyncBlockKind>> = {
  Audio: "audio",
  Blank: "blank",
  Choices: "choices",
  Figure: "figure",
  Option: "choiceOption",
  Slot: "slot",
  Solution: "solution",
};

const BLOCK_PRIORITY: Readonly<Record<PreviewSyncBlockKind, number>> = {
  audio: 90,
  blank: 110,
  blockquote: 58,
  choiceOption: 105,
  choices: 82,
  code: 48,
  figure: 90,
  heading: 76,
  listItem: 72,
  math: 66,
  paragraph: 60,
  slot: 112,
  solution: 84,
  table: 50,
};

export function buildPreviewSyncBlocks(
  document: vscode.TextDocument,
  documentState: ParsedDocumentSyntax,
): PreviewSyncBlock[] {
  const text = document.getText();
  const blocks: PreviewSyncBlock[] = [];
  let mathBlockIndex = 0;
  const consumedLineKinds = buildConsumedLineKinds(document, documentState);
  const pairedTagStarts = new Set(
    documentState.pairs.map((pair) => pair.open.start),
  );
  const componentKindCounts = new Map<PreviewSyncBlockKind, number>();

  const getComponentBlockSignature = (
    componentKind: PreviewSyncBlockKind,
    openTag: ParsedTag,
    innerEndOffset?: number,
  ): string => {
    if (componentKind === "solution") {
      const nextIndex = componentKindCounts.get(componentKind) || 0;
      componentKindCounts.set(componentKind, nextIndex + 1);
      return `solution:${nextIndex}`;
    }

    return getComponentSignature(text, openTag, innerEndOffset);
  };

  for (const pair of documentState.pairs) {
    const componentKind = COMPONENT_KIND_MAP[pair.name];
    if (!componentKind) {
      continue;
    }

    blocks.push(
      createPreviewSyncBlock(
        document,
        componentKind,
        pair.open.start,
        pair.close.end,
        getComponentBlockSignature(componentKind, pair.open, pair.close.start),
      ),
    );
  }

  for (const tag of documentState.tags) {
    if (tag.isClosing || pairedTagStarts.has(tag.start)) {
      continue;
    }

    const componentKind = COMPONENT_KIND_MAP[tag.name];
    if (!componentKind) {
      continue;
    }

    blocks.push(
      createPreviewSyncBlock(
        document,
        componentKind,
        tag.start,
        tag.end,
        getComponentBlockSignature(componentKind, tag),
      ),
    );
  }

  for (const marker of documentState.choiceMarkers) {
    const line = document.lineAt(document.positionAt(marker.start).line);
    const markerOffsetInLine =
      marker.start - document.offsetAt(line.range.start);
    const contentStart = Math.min(line.text.length, markerOffsetInLine + 1);
    const signature = normalizePreviewSyncText(line.text.slice(contentStart));
    blocks.push(
      createPreviewSyncBlockFromRange(
        document,
        "choiceOption",
        new vscode.Position(line.lineNumber, markerOffsetInLine),
        line.range.end,
        signature,
      ),
    );
  }

  for (let lineIndex = 0; lineIndex < document.lineCount; ) {
    const line = document.lineAt(lineIndex);
    const raw = line.text;
    const trimmed = raw.trim();

    if (!trimmed || consumedLineKinds.get(lineIndex) === "full") {
      lineIndex += 1;
      continue;
    }

    if (isHeadingLine(raw)) {
      blocks.push(
        createPreviewSyncBlockFromRange(
          document,
          "heading",
          new vscode.Position(lineIndex, 0),
          line.range.end,
          normalizePreviewSyncText(trimmed.replace(/^#{1,6}\s+/u, "")),
        ),
      );
      lineIndex += 1;
      continue;
    }

    if (isListItemLine(raw)) {
      const content = raw.replace(/^\s*(?:\d+\.\s+|[-*+]\s+)/u, "");
      blocks.push(
        createPreviewSyncBlockFromRange(
          document,
          "listItem",
          new vscode.Position(lineIndex, 0),
          line.range.end,
          normalizePreviewSyncText(content),
        ),
      );
      lineIndex += 1;
      continue;
    }

    if (isBlockquoteLine(raw)) {
      const startLine = lineIndex;
      const parts: string[] = [];
      while (lineIndex < document.lineCount) {
        const currentLine = document.lineAt(lineIndex);
        if (
          !currentLine.text.trim() ||
          consumedLineKinds.get(lineIndex) === "full" ||
          !isBlockquoteLine(currentLine.text)
        ) {
          break;
        }
        parts.push(currentLine.text.replace(/^\s*>\s?/u, ""));
        lineIndex += 1;
      }
      const endLine = Math.max(startLine, lineIndex - 1);
      blocks.push(
        createPreviewSyncBlockFromRange(
          document,
          "blockquote",
          new vscode.Position(startLine, 0),
          document.lineAt(endLine).range.end,
          normalizePreviewSyncText(parts.join(" ")),
        ),
      );
      continue;
    }

    if (isMathBlockStartLine(raw)) {
      const startLine = lineIndex;
      let sawClosingFence = false;
      while (lineIndex < document.lineCount) {
        const currentLine = document.lineAt(lineIndex);
        const currentText = currentLine.text;
        const currentTrimmed = currentText.trim();
        if (!currentTrimmed || consumedLineKinds.get(lineIndex) === "full") {
          break;
        }
        if (lineIndex > startLine && isMathBlockStartLine(currentText)) {
          sawClosingFence = true;
          lineIndex += 1;
          break;
        }
        lineIndex += 1;
      }
      const endLine = Math.max(
        startLine,
        sawClosingFence ? lineIndex - 1 : startLine,
      );
      blocks.push(
        createPreviewSyncBlockFromRange(
          document,
          "math",
          new vscode.Position(startLine, 0),
          document.lineAt(endLine).range.end,
          `math:${mathBlockIndex++}`,
        ),
      );
      continue;
    }

    if (isTableLine(raw)) {
      const startLine = lineIndex;
      const parts: string[] = [];
      while (lineIndex < document.lineCount) {
        const currentLine = document.lineAt(lineIndex);
        if (
          !currentLine.text.trim() ||
          consumedLineKinds.get(lineIndex) === "full" ||
          !isTableLine(currentLine.text)
        ) {
          break;
        }
        parts.push(currentLine.text);
        lineIndex += 1;
      }
      const endLine = Math.max(startLine, lineIndex - 1);
      blocks.push(
        createPreviewSyncBlockFromRange(
          document,
          "table",
          new vscode.Position(startLine, 0),
          document.lineAt(endLine).range.end,
          normalizePreviewSyncText(parts.join(" ")),
        ),
      );
      continue;
    }

    if (isCodeLikeLine(raw)) {
      const startLine = lineIndex;
      const parts: string[] = [];
      while (lineIndex < document.lineCount) {
        const currentLine = document.lineAt(lineIndex);
        if (
          !currentLine.text.trim() ||
          consumedLineKinds.get(lineIndex) === "full" ||
          !isCodeLikeLine(currentLine.text)
        ) {
          break;
        }
        parts.push(currentLine.text);
        lineIndex += 1;
      }
      const endLine = Math.max(startLine, lineIndex - 1);
      blocks.push(
        createPreviewSyncBlockFromRange(
          document,
          "code",
          new vscode.Position(startLine, 0),
          document.lineAt(endLine).range.end,
          normalizePreviewSyncText(parts.join(" ")),
        ),
      );
      continue;
    }

    const startLine = lineIndex;
    const paragraphParts: string[] = [];
    while (lineIndex < document.lineCount) {
      const currentLine = document.lineAt(lineIndex);
      const currentTrimmed = currentLine.text.trim();
      if (
        !currentTrimmed ||
        consumedLineKinds.get(lineIndex) === "full" ||
        isHeadingLine(currentLine.text) ||
        isListItemLine(currentLine.text) ||
        isBlockquoteLine(currentLine.text) ||
        isTableLine(currentLine.text) ||
        isCodeLikeLine(currentLine.text) ||
        isMathBlockStartLine(currentLine.text)
      ) {
        break;
      }
      paragraphParts.push(currentTrimmed);
      lineIndex += 1;
    }

    const endLine = Math.max(startLine, lineIndex - 1);
    blocks.push(
      createPreviewSyncBlockFromRange(
        document,
        "paragraph",
        new vscode.Position(startLine, 0),
        document.lineAt(endLine).range.end,
        normalizePreviewSyncText(paragraphParts.join(" ")),
      ),
    );
  }

  return deduplicatePreviewSyncBlocks(blocks).sort(comparePreviewSyncBlocks);
}

function buildConsumedLineKinds(
  document: vscode.TextDocument,
  documentState: ParsedDocumentSyntax,
): Map<number, "full"> {
  const consumed = new Map<number, "full">();

  for (const range of documentState.ignoredRanges) {
    markFullLineRange(
      consumed,
      document.positionAt(range.start).line,
      document.positionAt(range.end).line,
    );
  }

  const pairedTagStarts = new Set(
    documentState.pairs.map((pair) => pair.open.start),
  );

  for (const pair of documentState.pairs) {
    switch (pair.name) {
      case "Audio":
      case "Choices":
      case "Figure":
      case "Option":
        markFullLineRange(
          consumed,
          document.positionAt(pair.open.start).line,
          document.positionAt(pair.close.end).line,
        );
        break;
      case "Solution":
        markFullLineRange(
          consumed,
          document.positionAt(pair.open.start).line,
          document.positionAt(pair.open.end).line,
        );
        markFullLineRange(
          consumed,
          document.positionAt(pair.close.start).line,
          document.positionAt(pair.close.end).line,
        );
        break;
      default:
        break;
    }
  }

  for (const tag of documentState.tags) {
    if (tag.isClosing || pairedTagStarts.has(tag.start)) {
      continue;
    }

    switch (tag.name) {
      case "Audio":
      case "Choices":
      case "Figure":
      case "Option":
        markFullLineRange(
          consumed,
          document.positionAt(tag.start).line,
          document.positionAt(tag.end).line,
        );
        break;
      default:
        break;
    }
  }

  return consumed;
}

function markFullLineRange(
  consumed: Map<number, "full">,
  startLine: number,
  endLine: number,
): void {
  for (let line = startLine; line <= endLine; line += 1) {
    consumed.set(line, "full");
  }
}

function createPreviewSyncBlock(
  document: vscode.TextDocument,
  kind: PreviewSyncBlockKind,
  startOffset: number,
  endOffset: number,
  signature: string,
): PreviewSyncBlock {
  return createPreviewSyncBlockFromRange(
    document,
    kind,
    document.positionAt(startOffset),
    document.positionAt(endOffset),
    signature,
  );
}

function createPreviewSyncBlockFromRange(
  document: vscode.TextDocument,
  kind: PreviewSyncBlockKind,
  start: vscode.Position,
  end: vscode.Position,
  signature: string,
): PreviewSyncBlock {
  const text =
    signature ||
    normalizePreviewSyncText(document.getText(new vscode.Range(start, end)));

  return {
    endCharacter: end.character,
    endLine: end.line,
    id: `${kind}:${start.line}:${start.character}:${end.line}:${end.character}`,
    kind,
    priority: BLOCK_PRIORITY[kind],
    signature,
    startCharacter: start.character,
    startLine: start.line,
    text,
  };
}

function getComponentSignature(
  sourceText: string,
  openTag: ParsedTag,
  innerEndOffset?: number,
): string {
  switch (openTag.name) {
    case "Figure":
    case "Audio":
      return normalizePreviewSyncText(getAttributeValue(openTag, "src") || "");
    case "Choices":
      return normalizePreviewSyncText(getAttributeValue(openTag, "item") || "");
    case "Option":
    case "Blank":
      if (typeof innerEndOffset === "number" && innerEndOffset >= openTag.end) {
        return normalizePreviewSyncText(
          sourceText.slice(openTag.end, innerEndOffset),
        );
      }
      return normalizePreviewSyncText(
        sourceText.slice(openTag.start, openTag.end),
      );
    case "Slot":
      return normalizePreviewSyncText(getAttributeValue(openTag, "item") || "");
    default:
      return normalizePreviewSyncText(
        sourceText.slice(openTag.start, openTag.end),
      );
  }
}

function getAttributeValue(tag: ParsedTag, attributeName: string): string | null {
  const attribute = tag.attributes.find((item) => item.name === attributeName);
  return attribute?.value?.trim() || null;
}

function deduplicatePreviewSyncBlocks(
  blocks: readonly PreviewSyncBlock[],
): PreviewSyncBlock[] {
  const seen = new Set<string>();
  const result: PreviewSyncBlock[] = [];

  for (const block of blocks) {
    const key = `${block.id}:${block.signature}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(block);
  }

  return result;
}

function comparePreviewSyncBlocks(
  left: PreviewSyncBlock,
  right: PreviewSyncBlock,
): number {
  if (left.startLine !== right.startLine) {
    return left.startLine - right.startLine;
  }

  if (left.startCharacter !== right.startCharacter) {
    return left.startCharacter - right.startCharacter;
  }

  if (left.endLine !== right.endLine) {
    return left.endLine - right.endLine;
  }

  if (left.endCharacter !== right.endCharacter) {
    return left.endCharacter - right.endCharacter;
  }

  return right.priority - left.priority;
}

function isHeadingLine(value: string): boolean {
  return /^\s*#{1,6}\s+/u.test(value);
}

function isListItemLine(value: string): boolean {
  return /^\s*(?:\d+\.\s+|[-*+]\s+)/u.test(value);
}

function isBlockquoteLine(value: string): boolean {
  return /^\s*>\s?/u.test(value);
}

function isTableLine(value: string): boolean {
  return /^\s*\|.*\|\s*$/u.test(value);
}

function isCodeLikeLine(value: string): boolean {
  return /^\s*\t/u.test(value);
}

function isMathBlockStartLine(value: string): boolean {
  return /^\s*\$\$\s*$/u.test(value);
}
