import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { getDocumentState } from "../documentState";
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
    const srcValue = srcAttribute?.value?.trim();
    if (!srcAttribute || !srcValue || !isRelativeFigureSource(srcValue)) {
      continue;
    }

    const targetPath = path.resolve(path.dirname(document.uri.fsPath), srcValue);
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
