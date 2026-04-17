export type PreviewSyncBlockKind =
  | "audio"
  | "blank"
  | "blockquote"
  | "choiceOption"
  | "choices"
  | "code"
  | "figure"
  | "heading"
  | "listItem"
  | "math"
  | "paragraph"
  | "slot"
  | "solution"
  | "table";

export interface PreviewSyncBlock {
  readonly endCharacter: number;
  readonly endLine: number;
  readonly id: string;
  readonly kind: PreviewSyncBlockKind;
  readonly priority: number;
  readonly signature: string;
  readonly startCharacter: number;
  readonly startLine: number;
  readonly text: string;
}

export interface PreviewSyncPosition {
  readonly character: number;
  readonly line: number;
}
