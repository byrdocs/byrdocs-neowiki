import * as vscode from "vscode";

export function pickClosestViewColumn(
  viewColumns: readonly vscode.ViewColumn[],
  targetViewColumn: vscode.ViewColumn,
): vscode.ViewColumn {
  return [...viewColumns].sort((left, right) => {
    const leftDistance = Math.abs(left - targetViewColumn);
    const rightDistance = Math.abs(right - targetViewColumn);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return left - right;
  })[0] || vscode.ViewColumn.One;
}

export function getAdjacentPreviewViewColumn(
  sourceViewColumn: vscode.ViewColumn,
  preferredPreviewViewColumn?: vscode.ViewColumn,
): vscode.ViewColumn {
  if (
    preferredPreviewViewColumn &&
    Math.abs(preferredPreviewViewColumn - sourceViewColumn) === 1
  ) {
    return preferredPreviewViewColumn;
  }

  if (sourceViewColumn < vscode.ViewColumn.Nine) {
    return (sourceViewColumn + 1) as vscode.ViewColumn;
  }

  return Math.max(sourceViewColumn - 1, vscode.ViewColumn.One) as vscode.ViewColumn;
}

export function getAdjacentSourceViewColumn(
  previewViewColumn: vscode.ViewColumn,
): vscode.ViewColumn {
  if (previewViewColumn > vscode.ViewColumn.One) {
    return (previewViewColumn - 1) as vscode.ViewColumn;
  }

  return getAdjacentPreviewViewColumn(previewViewColumn);
}

export function appendPathToUri(
  baseUri: vscode.Uri,
  extraPath: string,
): vscode.Uri {
  const normalizedBasePath = baseUri.path.endsWith("/")
    ? baseUri.path.slice(0, -1)
    : baseUri.path;
  return baseUri.with({
    path: `${normalizedBasePath}${extraPath.startsWith("/") ? extraPath : `/${extraPath}`}`,
  });
}
