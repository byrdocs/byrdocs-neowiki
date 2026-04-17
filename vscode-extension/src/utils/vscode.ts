import * as vscode from "vscode";
import { asRecord } from "./common";

export function buildRange(
  document: vscode.TextDocument,
  startOffset: number,
  endOffset: number,
): vscode.Range {
  return new vscode.Range(
    document.positionAt(startOffset),
    document.positionAt(endOffset),
  );
}

export function positionIntersectsRange(
  position: vscode.Position,
  range: vscode.Range,
): boolean {
  return (
    position.isAfterOrEqual(range.start) && position.isBeforeOrEqual(range.end)
  );
}

export function reviveUri(value: unknown): vscode.Uri | null {
  if (value instanceof vscode.Uri) {
    return value;
  }

  const record = asRecord(value);
  if (typeof record.scheme === "string" && typeof record.path === "string") {
    return vscode.Uri.from({
      scheme: record.scheme,
      authority: typeof record.authority === "string" ? record.authority : "",
      path: record.path,
      query: typeof record.query === "string" ? record.query : "",
      fragment: typeof record.fragment === "string" ? record.fragment : "",
    });
  }

  return null;
}
