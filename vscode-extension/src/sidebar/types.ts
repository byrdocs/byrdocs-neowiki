import * as vscode from "vscode";
import type {
  AnswerCompletenessValue,
  ExamTypeValue,
  StageValue,
  TermValue,
} from "../lib/metadata";

export interface CreateExamPageNormalizedPayload {
  readonly source: string;
  readonly subject: string;
  readonly type: ExamTypeValue;
  readonly remark: string;
  readonly phase: StageValue;
  readonly time: string;
  readonly colleges: readonly string[];
  readonly examName: string;
  readonly answerCompleteness: AnswerCompletenessValue | "";
}

export interface CreateExamPageCreatedResult {
  readonly kind: "created";
  readonly examName: string;
  readonly fileUri: vscode.Uri;
}

export interface CreateExamPageOpenedExistingResult {
  readonly kind: "openedExisting";
  readonly examName: string;
  readonly fileUri: vscode.Uri;
}

export interface CreateExamPageFocusRemarkResult {
  readonly kind: "focusRemark";
}

export interface CreateExamPageCancelledResult {
  readonly kind: "cancelled";
}

export type CreateExamPageResult =
  | CreateExamPageCreatedResult
  | CreateExamPageOpenedExistingResult
  | CreateExamPageFocusRemarkResult
  | CreateExamPageCancelledResult;

export interface CreateExamPageDefaults {
  readonly startYear: number;
  readonly term: TermValue;
  readonly stage: StageValue;
  readonly type: ExamTypeValue;
  readonly subject: string;
  readonly remark: string;
  readonly source: string;
  readonly answerCompleteness: AnswerCompletenessValue | "";
}

export type SidebarViewMode = "list" | "create";

export interface SidebarExamEntry {
  readonly examName: string;
  readonly filePath: string;
  readonly subject: string;
  readonly type: string;
  readonly stage: string;
  readonly term: TermValue;
  readonly startYear: number;
  readonly endYear: number;
  readonly academicYear: string;
  readonly colleges: readonly string[];
  readonly answerCompleteness: string;
  readonly source: string;
  readonly remark: string;
}

export interface CreateExamPageViewState {
  readonly schools: readonly string[];
  readonly defaults: CreateExamPageDefaults;
  readonly exams: readonly SidebarExamEntry[];
  readonly initialView: SidebarViewMode;
}

export interface CreateExamPageRequestMessage {
  readonly type: "createExamPage";
  readonly payload: unknown;
}

export interface OpenExamPageRequestMessage {
  readonly type: "openExamPage";
  readonly examName: string;
}

export type CreateExamPageWebviewMessage =
  | CreateExamPageRequestMessage
  | OpenExamPageRequestMessage;

export interface CreateExamPageSuccessMessage {
  readonly type: "created";
  readonly examName: string;
  readonly filePath: string;
}

export interface CreateExamPageOpenedExistingMessage {
  readonly type: "openedExisting";
  readonly examName: string;
  readonly filePath: string;
}

export interface CreateExamPageFocusRemarkMessage {
  readonly type: "focusRemark";
}

export interface CreateExamPageCancelledMessage {
  readonly type: "createCancelled";
}

export interface ShowCreateFormMessage {
  readonly type: "showCreateForm";
}

export interface CreateExamPageErrorMessage {
  readonly type: "createError";
  readonly message: string;
}
