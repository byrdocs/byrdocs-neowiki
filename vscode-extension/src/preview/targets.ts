import * as path from "node:path";
import * as vscode from "vscode";
import type { ExamPreviewTarget } from "./types";
import { getWikiWorkspaceFolderForUri } from "../workspace";

export function getExamPreviewTarget(
  resourceUri: vscode.Uri,
): ExamPreviewTarget | null {
  const workspaceFolder = getWikiWorkspaceFolderForUri(resourceUri);
  if (!workspaceFolder || resourceUri.scheme !== "file") {
    return null;
  }

  const relativePath = path.relative(workspaceFolder.uri.fsPath, resourceUri.fsPath);
  const parts = relativePath.split(path.sep);
  if (parts.length !== 3 || parts[0] !== "exams" || parts[2] !== "index.mdx") {
    return null;
  }

  const examName = parts[1];
  if (!examName) {
    return null;
  }

  return {
    workspaceFolder,
    examName,
    routePath: `/exam/${examName}`,
    fileUri: resourceUri,
  };
}

export function isRelativeFigureSource(srcValue: string): boolean {
  return (
    !/^(?:[a-z]+:)?\/\//i.test(srcValue) &&
    !srcValue.startsWith("/") &&
    !path.isAbsolute(srcValue)
  );
}
