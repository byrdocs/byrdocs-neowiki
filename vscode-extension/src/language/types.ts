import * as vscode from "vscode";
import type { ComponentName } from "../lib/metadata";

export interface MarkerToggleTarget {
  readonly kind: "marker";
  readonly uri: vscode.Uri;
  readonly line: number;
}

export interface OptionTagToggleTarget {
  readonly kind: "optionTag";
  readonly uri: vscode.Uri;
  readonly line: number;
  readonly character: number;
}

export type ToggleTarget = MarkerToggleTarget | OptionTagToggleTarget;
export type ToggleTargetPayload =
  | Omit<MarkerToggleTarget, "uri">
  | Omit<OptionTagToggleTarget, "uri">;

export interface OpeningTagCompletionContext {
  readonly kind: "openingTag";
  readonly prefix: string;
  readonly replaceStart: number;
}

export interface ClosingTagCompletionContext {
  readonly kind: "closingTag";
  readonly prefix: string;
  readonly replaceStart: number;
}

export interface AttributeNameCompletionContext {
  readonly kind: "attributeName";
  readonly componentName: ComponentName;
  readonly prefix: string;
  readonly replaceStart: number;
  readonly existingAttributes: readonly string[];
}

export interface AttributeValueCompletionContext {
  readonly kind: "attributeValue";
  readonly componentName: ComponentName;
  readonly attributeName: string;
  readonly prefix: string;
  readonly replaceStart: number;
}

export type CompletionContext =
  | OpeningTagCompletionContext
  | ClosingTagCompletionContext
  | AttributeNameCompletionContext
  | AttributeValueCompletionContext;

export interface RelativePathCompletionEntry {
  readonly value: string;
  readonly kind: vscode.CompletionItemKind;
}
