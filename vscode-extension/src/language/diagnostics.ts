import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { getDocumentState } from "../documentState";
import type { ParsedAttribute } from "../lib/parser";
import { buildRange } from "../utils/vscode";
import { getUriExtension } from "../workspace";
import { getExamPreviewTarget, isRelativeFigureSource } from "../preview/targets";

export function refreshAllOpenFigureDiagnostics(
  collection: vscode.DiagnosticCollection,
): void {
  for (const document of vscode.workspace.textDocuments) {
    updateFigureDiagnostics(collection, document);
  }
}

export function updateFigureDiagnostics(
  collection: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
): void {
  if (document.uri.scheme !== "file" || getUriExtension(document.uri) !== ".mdx") {
    collection.delete(document.uri);
    return;
  }

  const examTarget = getExamPreviewTarget(document.uri);
  if (!examTarget) {
    collection.delete(document.uri);
    return;
  }

  const documentState = getDocumentState(document);
  const diagnostics: vscode.Diagnostic[] = [];

  for (const tag of documentState.tags) {
    if (tag.isClosing || tag.name !== "Figure") {
      continue;
    }

    const srcAttribute = tag.attributes.find((attribute) => attribute.name === "src");
    const srcValue = getStaticFigureSource(srcAttribute);
    if (!srcAttribute || !srcValue || !isRelativeFigureSource(srcValue)) {
      continue;
    }

    const targetPath = path.resolve(
      path.dirname(document.uri.fsPath),
      srcValue.split(/[?#]/u, 1)[0] || srcValue,
    );
    if (fs.existsSync(targetPath)) {
      continue;
    }

    const diagnostic = new vscode.Diagnostic(
      buildRange(document, srcAttribute.start, srcAttribute.end),
      `Figure src 引用的文件不存在：${srcValue}`,
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = "BYR Docs Wiki";
    diagnostics.push(diagnostic);
  }

  collection.set(document.uri, diagnostics);
}

function getStaticFigureSource(
  attribute: ParsedAttribute | undefined,
): string | null {
  if (!attribute?.value) {
    return null;
  }

  const value = attribute.value.trim();
  if (attribute.valueKind === "string") {
    return value;
  }

  if (attribute.valueKind !== "expression") {
    return null;
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/\\([\\'])/gu, "$1");
  }

  return null;
}
