import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { SUPPORTED_EXTENSIONS } from "./constants";
import { isRecord } from "./utils/common";

export function ensureEnabledWorkspace(): boolean {
  if (hasWikiWorkspace()) {
    return true;
  }

  void vscode.window.showWarningMessage(
    "当前工作区未检测到 `package.json` 的 `name: byrdocs-wiki`，扩展功能不会启用。",
  );
  return false;
}

export function getCommandTargetUri(resource: unknown): vscode.Uri | null {
  if (resource instanceof vscode.Uri) {
    return resource;
  }

  if (isRecord(resource) && resource.resourceUri instanceof vscode.Uri) {
    return resource.resourceUri;
  }

  return vscode.window.activeTextEditor?.document.uri || null;
}

export function getDocumentExtension(document: vscode.TextDocument): string {
  return path.extname(document.fileName || document.uri.path);
}

export function getUriExtension(uri: vscode.Uri): string {
  return path.extname(uri.fsPath || uri.path);
}

export function getWikiWorkspaceFolderForUri(
  uri?: vscode.Uri,
): vscode.WorkspaceFolder | null {
  if (uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder && isWikiWorkspaceFolder(workspaceFolder)) {
      return workspaceFolder;
    }
  }

  return getWikiWorkspaceFolders()[0] || null;
}

export function getWikiWorkspaceFolders(): vscode.WorkspaceFolder[] {
  return (vscode.workspace.workspaceFolders || []).filter((workspaceFolder) =>
    isWikiWorkspaceFolder(workspaceFolder),
  );
}

export function hasWikiWorkspace(): boolean {
  return getWikiWorkspaceFolders().length > 0;
}

export function isSupportedDocument(document: vscode.TextDocument): boolean {
  return (
    SUPPORTED_EXTENSIONS.has(getDocumentExtension(document)) &&
    Boolean(getWikiWorkspaceFolderForUri(document.uri))
  );
}

export function isWikiWorkspaceFolder(
  workspaceFolder: vscode.WorkspaceFolder,
): boolean {
  if (workspaceFolder.uri.scheme !== "file") {
    return false;
  }

  const packagePath = path.join(workspaceFolder.uri.fsPath, "package.json");
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as {
      readonly name?: string;
    };
    return packageJson.name === "byrdocs-wiki";
  } catch {
    return false;
  }
}

export async function refreshEnabledContext(): Promise<void> {
  await vscode.commands.executeCommand(
    "setContext",
    "byrdocsWiki.enabled",
    hasWikiWorkspace(),
  );
}
