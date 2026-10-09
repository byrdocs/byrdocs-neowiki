import {
  COMPONENTS,
  COMPONENT_NAMES,
  type ComponentName,
} from "./metadata";

export interface IgnoredRange {
  readonly start: number;
  readonly end: number;
}

export interface ParsedAttribute {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly fullEnd: number;
  readonly value: string | null;
  readonly valueKind: "boolean" | "string" | "expression";
}

export interface ParsedTag {
  readonly attributes: readonly ParsedAttribute[];
  readonly end: number;
  readonly isClosing: boolean;
  readonly name: ComponentName;
  readonly nameEnd: number;
  readonly nameStart: number;
  readonly selfClosing: boolean;
  readonly start: number;
}

export interface TagPair {
  readonly name: ComponentName;
  readonly open: ParsedTag;
  readonly close: ParsedTag;
}

export interface ChoiceMarker {
  readonly end: number;
  readonly lineEnd: number;
  readonly lineStart: number;
  readonly marker: "+" | "-";
  readonly start: number;
}

export interface ParsedDocumentSyntax {
  readonly choiceMarkers: readonly ChoiceMarker[];
  readonly ignoredRanges: readonly IgnoredRange[];
  readonly pairs: readonly TagPair[];
  readonly tags: readonly ParsedTag[];
}

const COMPONENT_PATTERN = COMPONENT_NAMES.join("|");
const TAG_REGEX = new RegExp(`<(/?)(${COMPONENT_PATTERN})(?=[\\s/>])`, "g");

// JSX attribute values can contain >, nested objects, strings and templates.
// Stop only at a delimiter outside the value; incomplete input is not editable.
function skipQuotedValue(text: string, start: number, expression = true): number {
  const quote = text[start];
  for (let cursor = start + 1; cursor < text.length; cursor++) {
    if (expression && text[cursor] === "\\") {
      cursor++;
    } else if (text[cursor] === quote) {
      return cursor + 1;
    } else if (expression && quote === "`" && text.startsWith("${", cursor)) {
      const end = skipExpression(text, cursor + 1);
      if (end < 0) return -1;
      cursor = end - 1;
    }
  }
  return -1;
}

function skipExpression(text: string, start: number): number {
  let depth = 1;
  let canStartRegex = true;
  for (let cursor = start + 1; cursor < text.length; cursor++) {
    const character = text[cursor]!;
    if (/\s/.test(character)) continue;
    if (character === '"' || character === "'" || character === "`") {
      const end = skipQuotedValue(text, cursor);
      if (end < 0) return -1;
      cursor = end - 1;
      canStartRegex = false;
      continue;
    }
    if (text.startsWith("//", cursor)) {
      const end = text.indexOf("\n", cursor + 2);
      if (end < 0) return -1;
      cursor = end;
      continue;
    }
    if (text.startsWith("/*", cursor)) {
      const end = text.indexOf("*/", cursor + 2);
      if (end < 0) return -1;
      cursor = end + 1;
      continue;
    }
    if (character === "/" && canStartRegex) {
      let inClass = false;
      let closed = false;
      for (cursor++; cursor < text.length; cursor++) {
        const part = text[cursor];
        if (part === "\\") cursor++;
        else if (part === "[") inClass = true;
        else if (part === "]") inClass = false;
        else if (part === "/" && !inClass) {
          closed = true;
          break;
        }
        else if (part === "\n" || part === "\r") return -1;
      }
      if (!closed) return -1;
      while (/[a-z]/i.test(text[cursor + 1] || "")) cursor++;
      canStartRegex = false;
      continue;
    }
    if (character === "{") depth++;
    if (character === "}") {
      depth--;
      if (depth === 0) return cursor + 1;
    }
    if (/[\p{L}\p{N}_$]/u.test(character)) {
      const wordStart = cursor;
      while (/[\p{L}\p{N}_$]/u.test(text[cursor + 1] || "")) cursor++;
      canStartRegex =
        /^(?:return|throw|case|delete|void|typeof|new|in|instanceof|yield|await)$/.test(
          text.slice(wordStart, cursor + 1),
        );
    } else {
      canStartRegex = !/[)}\]]/.test(character);
    }
  }
  return -1;
}

function readTag(text: string, match: RegExpExecArray): ParsedTag | null {
  const start = match.index;
  const isClosing = match[1] === "/";
  const name = match[2] as ComponentName;
  const nameStart = start + 1 + (isClosing ? 1 : 0);
  const nameEnd = nameStart + name.length;
  const attributes: ParsedAttribute[] = [];
  let cursor = nameEnd;
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] || "")) cursor++;
    const selfClosing = text.startsWith("/>", cursor);
    if (text[cursor] === ">" || selfClosing) {
      return {
        start,
        end: cursor + (selfClosing ? 2 : 1),
        name,
        nameStart,
        nameEnd,
        isClosing,
        selfClosing,
        attributes,
      };
    }
    if (isClosing) return null;
    if (text[cursor] === "{") {
      cursor = skipExpression(text, cursor);
      if (cursor < 0) return null;
      continue;
    }
    const attributeName = /^[A-Za-z][\w:-]*/.exec(text.slice(cursor))?.[0];
    if (!attributeName) return null;
    const attributeStart = cursor;
    cursor += attributeName.length;
    const attributeEnd = cursor;
    while (/\s/.test(text[cursor] || "")) cursor++;
    let fullEnd = attributeEnd;
    let valueKind: ParsedAttribute["valueKind"] = "boolean";
    if (text[cursor] === "=") {
      cursor++;
      while (/\s/.test(text[cursor] || "")) cursor++;
      const character = text[cursor];
      valueKind = character === "{" ? "expression" : "string";
      if (character === "{") cursor = skipExpression(text, cursor);
      else if (character === '"' || character === "'") {
        // JSX quoted attributes are text; backslashes do not escape quotes.
        cursor = skipQuotedValue(text, cursor, false);
      }
      else {
        const value = /^[^\s"'=<>`{}]+/.exec(text.slice(cursor))?.[0];
        if (!value) return null;
        cursor += value.length;
      }
      if (cursor < 0) return null;
      fullEnd = cursor;
    }
    attributes.push({
      name: attributeName,
      start: attributeStart,
      end: attributeEnd,
      fullEnd,
      valueKind,
      value: readAttributeValue(text.slice(attributeStart, fullEnd)),
    });
  }
  return null;
}

export function parseDocumentSyntax(text: string): ParsedDocumentSyntax {
  const ignoredRanges = computeIgnoredRanges(text);
  const tags: ParsedTag[] = [];
  TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_REGEX.exec(text))) {
    if (isOffsetIgnored(match.index, ignoredRanges)) continue;
    const tag = readTag(text, match);
    if (!tag) break;
    tags.push(tag);
    TAG_REGEX.lastIndex = tag.end;
  }
  const pairs = pairTags(tags);
  return {
    tags,
    pairs,
    ignoredRanges,
    choiceMarkers: collectChoiceMarkers(text, pairs, ignoredRanges),
  };
}

// Match Option.astro's accepted literal values without executing author code.
// Dynamic expressions have an unknown value, but their attribute can be removed.
export function getOptionCorrectness(tag: ParsedTag): boolean | undefined {
  const attribute = tag.attributes.find((item) => item.name === "correct");
  if (!attribute) return false;
  if (attribute.valueKind === "boolean") return true;
  const value = attribute.value ?? "";
  if (attribute.valueKind === "string") return value === "" || value === "true";
  const expression = value.trim();
  if (expression === "true") return true;
  if (/^(?:false|null|undefined|[-+]?\d+(?:\.\d+)?)$/.test(expression)) return false;
  if (/^(?:"[^"\\]*"|'[^'\\]*')$/.test(expression)) {
    const literal = expression.slice(1, -1);
    return literal === "" || literal === "true";
  }
  return undefined;
}

function computeIgnoredRanges(text: string): IgnoredRange[] {
  const ranges: IgnoredRange[] = [];
  const frontmatterMatch = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (frontmatterMatch) {
    ranges.push({
      start: 0,
      end: frontmatterMatch[0].length,
    });
  }

  const fenceRegex = /^[ \t]*(`{3,}|~{3,}).*$/gm;
  const fenceRanges: IgnoredRange[] = [];
  let fenceStart: { readonly marker: string; readonly start: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text))) {
    const marker = match[1] || "";
    if (!fenceStart) {
      fenceStart = { marker, start: match.index };
      continue;
    }

    if (marker[0] === fenceStart.marker[0] && marker.length >= fenceStart.marker.length) {
      fenceRanges.push({
        start: fenceStart.start,
        end: match.index + match[0].length,
      });
      fenceStart = null;
    }
  }

  ranges.push(...fenceRanges);

  const inlineCodeRegex = /(`{1,2})(?!`)([^\n]*?)\1(?!`)/g;
  while ((match = inlineCodeRegex.exec(text))) {
    if (!isOffsetIgnored(match.index, fenceRanges)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return ranges.sort((left, right) => left.start - right.start);
}

export function isOffsetIgnored(
  offset: number,
  ignoredRanges: readonly IgnoredRange[],
): boolean {
  return ignoredRanges.some(
    (range) => offset >= range.start && offset <= range.end,
  );
}

function pairTags(tags: readonly ParsedTag[]): TagPair[] {
  const stack: ParsedTag[] = [];
  const pairs: TagPair[] = [];

  for (const tag of tags) {
    const metadata = COMPONENTS[tag.name];

    if (tag.isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index]?.name !== tag.name) {
          continue;
        }

        const open = stack.splice(index, 1)[0];
        if (open) {
          pairs.push({
            name: tag.name,
            open,
            close: tag,
          });
        }
        break;
      }
      continue;
    }

    if (tag.selfClosing || metadata.kind === "selfClosing") {
      continue;
    }

    stack.push(tag);
  }

  return pairs.sort((left, right) => left.open.start - right.open.start);
}

function collectChoiceMarkers(
  text: string,
  pairs: readonly TagPair[],
  ignoredRanges: readonly IgnoredRange[],
): ChoiceMarker[] {
  const markers: ChoiceMarker[] = [];
  const blocks = pairs.filter((pair) => pair.name === "Choices");

  for (const block of blocks) {
    const contentStart = block.open.end;
    const contentEnd = block.close.start;
    const content = text.slice(contentStart, contentEnd);
    const markerRegex = /^[ \t]*([+-])(?=\s+)/gm;
    const candidates: Array<{
      readonly indent: number;
      readonly match: RegExpExecArray;
    }> = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(content))) {
      const linePrefix = match[0].slice(0, match[0].lastIndexOf(match[1] || ""));
      candidates.push({ indent: linePrefix.length, match });
    }

    const baseIndent = candidates.reduce(
      (minimum, candidate) => Math.min(minimum, candidate.indent),
      Number.POSITIVE_INFINITY,
    );
    for (const candidate of candidates) {
      if (candidate.indent !== baseIndent) {
        continue;
      }
      match = candidate.match;
      const marker = match[1] as "+" | "-";
      const markerStart =
        contentStart + match.index + match[0].lastIndexOf(marker);

      if (isOffsetIgnored(markerStart, ignoredRanges)) {
        continue;
      }

      const lineEndRelative = content.indexOf("\n", match.index);
      const lineEnd =
        lineEndRelative === -1 ? contentEnd : contentStart + lineEndRelative;
      const lineStartRelative = content.lastIndexOf("\n", match.index);

      markers.push({
        end: markerStart + 1,
        lineEnd,
        lineStart:
          lineStartRelative === -1
            ? contentStart
            : contentStart + lineStartRelative + 1,
        marker,
        start: markerStart,
      });
    }
  }

  return markers;
}

function readAttributeValue(sourceText: string): string | null {
  const equalsIndex = sourceText.indexOf("=");
  if (equalsIndex < 0) {
    return null;
  }

  const rawValue = sourceText.slice(equalsIndex + 1).trim();
  if (!rawValue) {
    return "";
  }

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }

  if (rawValue.startsWith("{") && rawValue.endsWith("}")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

export function findTagAtOffset(
  tags: readonly ParsedTag[],
  offset: number,
): ParsedTag | null {
  return tags.find((tag) => offset >= tag.start && offset <= tag.end) || null;
}

export function findTagNameAtOffset(
  tags: readonly ParsedTag[],
  offset: number,
): ParsedTag | null {
  return (
    tags.find((tag) => offset >= tag.nameStart && offset <= tag.nameEnd) || null
  );
}

export function findAttributeAtOffset(
  tag: ParsedTag | null,
  offset: number,
): ParsedAttribute | null {
  if (!tag || tag.isClosing) {
    return null;
  }

  return (
    tag.attributes.find(
      (attribute) => offset >= attribute.start && offset <= attribute.end,
    ) || null
  );
}

export function findChoiceMarkerAtOffset(
  choiceMarkers: readonly ChoiceMarker[],
  offset: number,
): ChoiceMarker | null {
  return (
    choiceMarkers.find(
      (marker) => offset >= marker.start && offset <= marker.end,
    ) || null
  );
}

export function getOpenComponentStack(
  tags: readonly ParsedTag[],
  offset: number,
): ParsedTag[] {
  const stack: ParsedTag[] = [];

  for (const tag of tags) {
    if (tag.start >= offset) {
      break;
    }

    const metadata = COMPONENTS[tag.name];
    if (tag.isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index]?.name === tag.name) {
          stack.splice(index, 1);
          break;
        }
      }
      continue;
    }

    if (tag.selfClosing || metadata.kind === "selfClosing") {
      continue;
    }

    stack.push(tag);
  }

  return stack;
}

export function getEnclosingChoicesBlock(
  pairs: readonly TagPair[],
  offset: number,
): TagPair | null {
  return (
    pairs.find(
      (pair) =>
        pair.name === "Choices" &&
        offset >= pair.open.end &&
        offset <= pair.close.start,
    ) || null
  );
}
