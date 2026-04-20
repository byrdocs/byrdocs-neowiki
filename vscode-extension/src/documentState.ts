import * as vscode from "vscode";
import {
  parseDocumentSyntax,
  type ParsedDocumentSyntax,
} from "./lib/parser";

interface DocumentCacheEntry {
  readonly version: number;
  readonly state: ParsedDocumentSyntax;
}

const documentStateCache = new Map<string, DocumentCacheEntry>();

export function getDocumentState(
  document: vscode.TextDocument,
): ParsedDocumentSyntax {
  const cacheKey = document.uri.toString();
  const cached = documentStateCache.get(cacheKey);
  if (cached && cached.version === document.version) {
    return cached.state;
  }

  const state = parseDocumentSyntax(document.getText());
  documentStateCache.set(cacheKey, {
    version: document.version,
    state,
  });
  return state;
}

export function clearDocumentState(uri: vscode.Uri): void {
  documentStateCache.delete(uri.toString());
}
