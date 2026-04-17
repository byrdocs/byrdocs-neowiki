import * as http from "node:http";
import * as vscode from "vscode";

export function stripAnsi(output: string): string {
  return output.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
    "",
  );
}

export function isLocalServerHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "::" ||
    normalizedHostname === "[::]" ||
    normalizedHostname === "[::1]" ||
    normalizedHostname.startsWith("127.")
  );
}

export function sanitizeUrlCandidate(candidate: string): string {
  return candidate.replace(/[),.;]+$/g, "");
}

export function extractUrlCandidates(output: string): string[] {
  return [...output.matchAll(/\bhttps?:\/\/[^\s"'`<>)\]}]+/gi)]
    .map((match) => sanitizeUrlCandidate(match[0] || ""))
    .filter(Boolean);
}

export function scoreServerUrlCandidate(
  output: string,
  candidate: string,
): number {
  let score = 0;

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const matchingLine =
      output
        .split(/\r?\n/)
        .find((line) => line.includes(candidate)) || "";

    if (isLocalServerHost(hostname)) {
      score += 100;
    }

    if (/\blocal\b/i.test(matchingLine)) {
      score += 120;
    }

    if (/\bnetwork\b/i.test(matchingLine)) {
      score -= 25;
    }

    if (/\bastro\b/i.test(output) || /\bLocal\b/.test(output)) {
      score += 10;
    }
  } catch {
    return 0;
  }

  return score;
}

export function normalizeParsedServerBaseUri(
  candidate: string,
): vscode.Uri | null {
  try {
    const url = new URL(candidate);
    let hostname = url.hostname;

    if (
      hostname === "0.0.0.0" ||
      hostname === "::" ||
      hostname === "[::]" ||
      hostname === "[::1]"
    ) {
      hostname = "127.0.0.1";
    }

    const authority = url.port ? `${hostname}:${url.port}` : hostname;
    return vscode.Uri.parse(`${url.protocol}//${authority}`);
  } catch {
    return null;
  }
}

export function parseServerBaseUriFromTerminalOutput(
  output: string,
): vscode.Uri | null {
  const cleanedOutput = stripAnsi(output);
  const candidates = extractUrlCandidates(cleanedOutput);
  if (candidates.length === 0) {
    return null;
  }

  const bestCandidate = candidates
    .map((candidate) => ({
      candidate,
      score: scoreServerUrlCandidate(cleanedOutput, candidate),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestCandidate || bestCandidate.score < 1) {
    return null;
  }

  return normalizeParsedServerBaseUri(bestCandidate.candidate);
}

export async function pingServer(baseUri: vscode.Uri): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(
      baseUri.toString(),
      { timeout: 1500 },
      (response) => {
        response.resume();
        resolve(true);
      },
    );

    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

export function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export async function waitForTerminalShellIntegration(
  terminal: vscode.Terminal,
  timeoutMs: number,
): Promise<vscode.TerminalShellIntegration | null> {
  if (terminal.shellIntegration) {
    return terminal.shellIntegration;
  }

  return new Promise((resolve) => {
    const disposable = vscode.window.onDidChangeTerminalShellIntegration(
      (event) => {
        if (event.terminal !== terminal) {
          return;
        }

        cleanup();
        resolve(event.shellIntegration);
      },
    );
    const timeoutHandle = setTimeout(() => {
      cleanup();
      resolve(terminal.shellIntegration || null);
    }, timeoutMs);

    const cleanup = (): void => {
      disposable.dispose();
      clearTimeout(timeoutHandle);
    };
  });
}

export async function waitForServerUri(
  baseUri: vscode.Uri,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pingServer(baseUri)) {
      return true;
    }

    await sleep(intervalMs);
  }

  return false;
}
