import * as vscode from "vscode";
import type {
  PreviewSyncBlock,
  PreviewSyncPosition,
} from "../lib/previewSync";

export type PreviewStatus = "ready" | "starting" | "timeout";

export interface ExamPreviewTarget {
  readonly workspaceFolder: vscode.WorkspaceFolder;
  readonly examName: string;
  readonly routePath: string;
  readonly fileUri: vscode.Uri;
}

export interface PreviewPanelSyncState {
  readonly blocks: readonly PreviewSyncBlock[];
  readonly position: PreviewSyncPosition | null;
}

export interface PreviewPanelState {
  readonly examName: string;
  readonly previewUrl: string;
  readonly routePath: string;
  readonly serverOrigin: string;
  readonly status: PreviewStatus;
  readonly statusDetail: string;
  readonly syncState: PreviewPanelSyncState | null;
  readonly terminalName: string;
}

export interface PreviewPanelMessage {
  readonly type: "reload" | "openExternal";
}

export interface PreviewPanelOpenSourceLocationMessage {
  readonly type: "openSourceLocation";
  readonly position: PreviewSyncPosition;
}

export interface PreviewPanelSyncUpdateMessage {
  readonly type: "updateSyncState";
  readonly state: PreviewPanelSyncState | null;
}
