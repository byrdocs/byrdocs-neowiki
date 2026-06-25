import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RecentExam {
  id: string;
  timestamp: number;
  message: string;
  uncommitted?: boolean;
}

export function getRecentlyChangedExams(): RecentExam[] {
  const committed = getCommittedExams();
  const uncommitted = getUncommittedExams();

  const ids = new Set(uncommitted.map((e) => e.id));
  const merged = [
    ...uncommitted,
    ...committed.filter((e) => !ids.has(e.id)),
  ];

  return filterExistingExams(merged);
}

function getCommittedExams(): RecentExam[] {
  try {
    const output = execSync(
      `git -c core.quotePath=false log --format='---COMMIT---%n%at%n%s' --name-only --max-count=30 -- 'exams/'`,
      { encoding: "utf-8" },
    );
    return parseGitLog(output);
  } catch {
    return [];
  }
}

function getUncommittedExams(): RecentExam[] {
  let output = "";
  try {
    const modified = execSync(
      `git -c core.quotePath=false diff --name-only HEAD -- 'exams/'`,
      { encoding: "utf-8" },
    );
    output += modified;
  } catch {
    /* ok */
  }

  try {
    const untracked = execSync(
      `git -c core.quotePath=false ls-files --others --exclude-standard -- 'exams/'`,
      { encoding: "utf-8" },
    );
    output += untracked;
  } catch {
    /* ok */
  }

  if (!output.trim()) return [];

  const examMap = new Map<string, RecentExam>();
  for (const filePath of output.split("\n")) {
    const match = filePath.match(/^exams\/([^/]+)\//);
    if (!match) continue;
    const examId = match[1];
    if (examMap.has(examId)) continue;

    let timestamp = Date.now();
    try {
      timestamp = statSync(join("exams", examId)).mtimeMs;
    } catch {
      /* keep Date.now() fallback */
    }

    examMap.set(examId, {
      id: examId,
      timestamp: Math.floor(timestamp / 1000),
      message: "",
      uncommitted: true,
    });
  }

  return [...examMap.values()].sort((a, b) => b.timestamp - a.timestamp);
}

function parseGitLog(output: string): RecentExam[] {
  const blocks = output.split("---COMMIT---\n").filter(Boolean);
  const examMap = new Map<string, RecentExam>();

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;

    const timestamp = parseInt(lines[0], 10);
    if (isNaN(timestamp)) continue;

    const message = lines[1];

    for (const filePath of lines.slice(2)) {
      const match = filePath.match(/^exams\/([^/]+)\//);
      if (!match) continue;
      const examId = match[1];
      if (!examMap.has(examId)) {
        examMap.set(examId, { id: examId, timestamp, message });
      }
    }
  }

  return [...examMap.values()].sort((a, b) => b.timestamp - a.timestamp);
}

function filterExistingExams(exams: RecentExam[]): RecentExam[] {
  let validDirs: Set<string>;
  try {
    const entries = readdirSync("exams", { withFileTypes: true });
    validDirs = new Set(
      entries
        .filter(
          (e) =>
            e.isDirectory() &&
            !e.name.startsWith(".") &&
            e.name !== "LICENSE",
        )
        .map((e) => e.name),
    );
  } catch {
    return exams;
  }

  return exams.filter((e) => validDirs.has(e.id));
}
