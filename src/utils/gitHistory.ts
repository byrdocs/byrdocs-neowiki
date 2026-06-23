import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

export interface RecentExam {
  id: string;
  timestamp: number;
  message: string;
}

export function getRecentlyChangedExams(): RecentExam[] {
  try {
    const output = execSync(
      `git log --format='---COMMIT---%n%at%n%s' --name-only --diff-filter=AM --max-count=30 -- 'exams/'`,
      { encoding: "utf-8" },
    );
    const exams = parseGitLog(output);
    return filterExistingExams(exams);
  } catch {
    return [];
  }
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
