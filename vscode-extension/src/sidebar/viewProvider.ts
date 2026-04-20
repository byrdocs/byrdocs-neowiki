/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from "vscode";
import { CREATE_EXAM_PAGE_CONTAINER_ID, CREATE_EXAM_PAGE_VIEW_ID } from "../constants";
import { asRecord } from "../utils/common";
import { getWikiWorkspaceFolderForUri } from "../workspace";
import type { ExamPreviewManager } from "../preview/manager";
import {
  createExamPageFromPayload,
  getDefaultCreateFormState,
  openExamPageFromList,
  readExamEntries,
  readSchoolOptions,
} from "./exams";
import type {
  CreateExamPageCancelledMessage,
  CreateExamPageErrorMessage,
  CreateExamPageFocusRemarkMessage,
  CreateExamPageOpenedExistingMessage,
  CreateExamPageSuccessMessage,
  CreateExamPageViewState,
  CreateExamPageWebviewMessage,
  ShowCreateFormMessage,
  SidebarViewMode,
} from "./types";
import { renderCreateExamPageViewHtml } from "./viewHtml";

export class CreateExamPageViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private preferredView: SidebarViewMode = "list";

  constructor(private readonly previewManagerInstance: ExamPreviewManager) {}

  refresh(): void {
    if (!this.view) {
      return;
    }

    void this.view.webview.postMessage({
      type: "replaceExamEntries",
      exams: this.getState().exams,
    });
  }

  async reveal(view: SidebarViewMode = "list"): Promise<void> {
    this.preferredView = view;
    await vscode.commands.executeCommand(
      `workbench.view.extension.${CREATE_EXAM_PAGE_CONTAINER_ID}`,
    );
    if (this.view) {
      this.view.show?.(true);
      const message: ShowCreateFormMessage | { readonly type: "showExamList" } =
        view === "create"
          ? { type: "showCreateForm" }
          : { type: "showExamList" };
      void this.view.webview.postMessage(message);
      return;
    }

    try {
      await vscode.commands.executeCommand(`${CREATE_EXAM_PAGE_VIEW_ID}.focus`);
    } catch {}
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.title = "";
    webviewView.description = "";
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.render(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isCreateExamPageWebviewMessage(message)) {
        return;
      }

      if (message.type === "openExamPage") {
        await openExamPageFromList(
          message.examName,
          this.previewManagerInstance,
        );
        return;
      }

      try {
        const result = await createExamPageFromPayload(
          message.payload,
          this.previewManagerInstance,
        );
        if (result.kind === "created") {
          this.refresh();
          const success: CreateExamPageSuccessMessage = {
            type: "created",
            examName: result.examName,
            filePath: result.fileUri.fsPath,
          };
          void webviewView.webview.postMessage(success);
          return;
        }

        if (result.kind === "openedExisting") {
          const openedExisting: CreateExamPageOpenedExistingMessage = {
            type: "openedExisting",
            examName: result.examName,
            filePath: result.fileUri.fsPath,
          };
          void webviewView.webview.postMessage(openedExisting);
          return;
        }

        if (result.kind === "focusRemark") {
          const focusRemark: CreateExamPageFocusRemarkMessage = {
            type: "focusRemark",
          };
          void webviewView.webview.postMessage(focusRemark);
          return;
        }

        if (result.kind === "cancelled") {
          const cancelled: CreateExamPageCancelledMessage = {
            type: "createCancelled",
          };
          void webviewView.webview.postMessage(cancelled);
        }
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : String(error);
        const failure: CreateExamPageErrorMessage = {
          type: "createError",
          message: messageText,
        };
        void webviewView.webview.postMessage(failure);
      }
    });

    webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = null;
      }
    });
  }

  private render(webview: vscode.Webview): string {
    const state = this.getState();
    return renderCreateExamPageViewHtml(webview, state);
  }

  private getState(): CreateExamPageViewState {
    const workspaceFolder = getWikiWorkspaceFolderForUri();
    const schools = workspaceFolder ? readSchoolOptions(workspaceFolder) : [];
    const exams = workspaceFolder ? readExamEntries(workspaceFolder) : [];
    const defaults = getDefaultCreateFormState();
    return {
      schools,
      defaults,
      exams,
      initialView: this.preferredView,
    };
  }
}

function isCreateExamPageWebviewMessage(
  value: unknown,
): value is CreateExamPageWebviewMessage {
  const record = asRecord(value);
  return (
    record.type === "createExamPage" ||
    (record.type === "openExamPage" && typeof record.examName === "string")
  );
}
