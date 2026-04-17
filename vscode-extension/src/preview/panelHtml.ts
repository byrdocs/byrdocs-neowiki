import * as vscode from "vscode";
import type { PreviewPanelState } from "./types";
import { createNonce, escapeAttribute, escapeHtml } from "../utils/common";

export function renderPreviewPanelHtml(
  _webview: vscode.Webview,
  state: PreviewPanelState,
): string {
  const nonce = createNonce();
  const previewOrigin = state.previewUrl
    ? getUriOrigin(state.previewUrl)
    : "http: https:";
  const previewTargetOrigin = state.previewUrl
    ? getUriOrigin(state.previewUrl)
    : "*";
  const serializedSyncState = JSON.stringify(state.syncState ?? null).replace(
    /</g,
    "\\u003c",
  );

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src ${previewOrigin};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: light dark;
      --accent: #0f766e;
      --muted: var(--vscode-descriptionForeground);
    }
    body {
      margin: 0;
      font: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .frame {
      width: 100%;
      height: 100vh;
      border: 0;
      background: white;
    }
    .loading {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .loading-inner {
      display: grid;
      justify-items: center;
      gap: 16px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 3px solid color-mix(in srgb, var(--accent) 20%, var(--vscode-editorWidget-border, transparent));
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }
    .status {
      font-size: 13px;
      color: var(--muted);
      letter-spacing: 0.01em;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  ${
    state.status === "ready"
      ? `<iframe id="preview-frame" class="frame" src="${escapeAttribute(state.previewUrl)}"></iframe>`
      : `<div class="loading">
          <div class="loading-inner">
            ${
              state.status === "starting"
                ? '<div class="spinner" aria-hidden="true"></div>'
                : ""
            }
            <div class="status">${escapeHtml(renderPreviewStatusText(state))}</div>
          </div>
        </div>`
  }
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const previewTargetOrigin = ${JSON.stringify(previewTargetOrigin)};
    const previewFrame = document.getElementById("preview-frame");
    let pageReady = false;
    let syncState = ${serializedSyncState};

    function isPreviewPosition(value) {
      return Boolean(
        value &&
        typeof value === "object" &&
        typeof value.line === "number" &&
        typeof value.character === "number"
      );
    }

    function postToFrame(type, payload) {
      if (!(previewFrame instanceof HTMLIFrameElement) || !previewFrame.contentWindow) {
        return;
      }

      previewFrame.contentWindow.postMessage(
        {
          source: "byrdocs-preview-shell",
          type,
          ...payload,
        },
        previewTargetOrigin,
      );
    }

    function pushSyncState() {
      if (!pageReady || !syncState) {
        return;
      }

      postToFrame("byrdocsPreviewSync:setState", {
        blocks: Array.isArray(syncState.blocks) ? syncState.blocks : [],
        position: isPreviewPosition(syncState.position) ? syncState.position : null,
        targetPathname: ${JSON.stringify(state.routePath)},
      });
    }

    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }

      if (
        previewFrame instanceof HTMLIFrameElement &&
        event.source === previewFrame.contentWindow &&
        data.source === "byrdocs-preview-page"
      ) {
        if (data.type === "byrdocsPreviewSync:ready") {
          pageReady = true;
          pushSyncState();
          return;
        }

        if (
          data.type === "byrdocsPreviewSync:openSourceLocation" &&
          data.isTargetPage === true &&
          isPreviewPosition(data.position)
        ) {
          vscode.postMessage({
            type: "openSourceLocation",
            position: data.position,
          });
        }
        return;
      }

      if (data.type === "updateSyncState") {
        syncState = data.state || null;
        pushSyncState();
      }
    });

    if (previewFrame instanceof HTMLIFrameElement) {
      previewFrame.addEventListener("load", () => {
        pageReady = false;
      });
    }
  </script>
</body>
</html>`;
}

function renderPreviewStatusText(state: PreviewPanelState): string {
  if (state.statusDetail) {
    return state.statusDetail;
  }

  if (state.status === "ready") {
    return "预览已连接";
  }

  if (state.status === "timeout") {
    return "预览连接超时";
  }

  return "正在启动预览服务";
}

function getUriOrigin(uriString: string): string {
  const url = new URL(uriString);
  return `${url.protocol}//${url.host}`;
}
