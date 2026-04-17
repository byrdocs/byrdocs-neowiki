import * as path from "node:path";
import * as vscode from "vscode";
import { clearDocumentState } from "./documentState";
import {
  DOCUMENT_SELECTOR,
  CREATE_EXAM_PAGE_VIEW_ID,
  SEMANTIC_LEGEND,
} from "./constants";
import {
  createCompletionProvider,
  createDefinitionProvider,
  createFoldingRangeProvider,
  createHoverProvider,
  createInlayHintsProvider,
  createSemanticTokensProvider,
  toggleChoiceCorrectness,
} from "./language/providers";
import {
  refreshAllOpenFigureDiagnostics,
  updateFigureDiagnostics,
} from "./language/diagnostics";
import { CreateExamPageViewProvider } from "./sidebar/viewProvider";
import { ExamPreviewManager } from "./preview/manager";
import {
  ensureEnabledWorkspace,
  getCommandTargetUri,
  refreshEnabledContext,
} from "./workspace";

let previewManager: ExamPreviewManager;
let createExamPageViewProvider: CreateExamPageViewProvider;
let figureDiagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext): void {
  previewManager = new ExamPreviewManager();
  createExamPageViewProvider = new CreateExamPageViewProvider(previewManager);
  figureDiagnosticCollection =
    vscode.languages.createDiagnosticCollection("byrdocsWikiFigure");
  const examFileWatcher = vscode.workspace.createFileSystemWatcher("exams/**");

  context.subscriptions.push(
    figureDiagnosticCollection,
    examFileWatcher,
    vscode.commands.registerCommand(
      "byrdocsWiki.previewExamPage",
      async (resource: unknown) => {
        await refreshEnabledContext();
        if (!ensureEnabledWorkspace()) {
          return;
        }

        const targetUri = getCommandTargetUri(resource);
        await previewManager.preview(targetUri);
      },
    ),
    vscode.commands.registerCommand(
      "byrdocsWiki.showCreateExamPage",
      async () => {
        await refreshEnabledContext();
        if (!ensureEnabledWorkspace()) {
          return;
        }

        await createExamPageViewProvider.reveal("create");
      },
    ),
    vscode.commands.registerCommand(
      "byrdocsWiki.toggleChoiceCorrectness",
      async (target: unknown) => {
        await toggleChoiceCorrectness(target);
      },
    ),
    vscode.window.registerWebviewViewProvider(
      CREATE_EXAM_PAGE_VIEW_ID,
      createExamPageViewProvider,
    ),
    vscode.languages.registerCompletionItemProvider(
      DOCUMENT_SELECTOR,
      createCompletionProvider(),
      "<",
      "/",
      " ",
      '"',
      "'",
    ),
    vscode.languages.registerHoverProvider(
      DOCUMENT_SELECTOR,
      createHoverProvider(),
    ),
    vscode.languages.registerDefinitionProvider(
      DOCUMENT_SELECTOR,
      createDefinitionProvider(),
    ),
    vscode.languages.registerFoldingRangeProvider(
      DOCUMENT_SELECTOR,
      createFoldingRangeProvider(),
    ),
    vscode.languages.registerInlayHintsProvider(
      DOCUMENT_SELECTOR,
      createInlayHintsProvider(),
    ),
    vscode.languages.registerDocumentSemanticTokensProvider(
      DOCUMENT_SELECTOR,
      createSemanticTokensProvider(),
      SEMANTIC_LEGEND,
    ),
    vscode.workspace.onDidChangeTextDocument((event) => {
      clearDocumentState(event.document.uri);
      updateFigureDiagnostics(figureDiagnosticCollection, event.document);
      previewManager.handleDocumentChange(event.document);
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      updateFigureDiagnostics(figureDiagnosticCollection, document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      clearDocumentState(document.uri);
      figureDiagnosticCollection.delete(document.uri);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      clearDocumentState(document.uri);
      updateFigureDiagnostics(figureDiagnosticCollection, document);
      previewManager.handleDocumentChange(document);
      if (path.basename(document.fileName) === "package.json") {
        void refreshEnabledContext();
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      previewManager.handleEditorSelectionChanged(event.textEditor);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      previewManager.handleEditorSelectionChanged(editor);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void refreshEnabledContext();
      createExamPageViewProvider.refresh();
      refreshAllOpenFigureDiagnostics(figureDiagnosticCollection);
    }),
    examFileWatcher.onDidCreate(() => {
      createExamPageViewProvider.refresh();
      refreshAllOpenFigureDiagnostics(figureDiagnosticCollection);
    }),
    examFileWatcher.onDidDelete(() => {
      createExamPageViewProvider.refresh();
      refreshAllOpenFigureDiagnostics(figureDiagnosticCollection);
    }),
    examFileWatcher.onDidChange(() => {
      createExamPageViewProvider.refresh();
      refreshAllOpenFigureDiagnostics(figureDiagnosticCollection);
    }),
  );

  void refreshEnabledContext();
  refreshAllOpenFigureDiagnostics(figureDiagnosticCollection);
}

export function deactivate(): void {}
