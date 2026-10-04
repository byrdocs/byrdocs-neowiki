/* eslint-disable @typescript-eslint/no-require-imports -- The extension and test harness use CommonJS. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadExtension } = require("./load-extension.cjs");

test("reuse a server only within its workspace; switch terminals and clear external URLs for another workspace", async () => {
  const terminals = [];
  let nextPort = 4321;
  const vscode = {
    ViewColumn: { One: 1, Two: 2 },
    env: { asExternalUri: async uri => uri },
    window: {
      terminals,
      createTerminal(options) {
        const terminal = {
          ...options, disposed: false, commands: [],
          dispose() { this.disposed = true; },
          sendText(command) { this.commands.push(command); },
          show() {},
        };
        terminals.push(terminal);
        return terminal;
      },
    },
  };
  const load = loadExtension(vscode, {
    "constants.js": { PREVIEW_TERMINAL_NAME: "BYR Docs Wiki Preview" },
    "lib/previewSync.js": { buildPreviewSyncInjectedPageScript: () => "", buildPreviewSyncVitePluginSource: () => "" },
    "preview/server.js": {
      pingServer: async () => true,
      findAvailableLocalServerBaseUri: async () => {
        const value = `http://127.0.0.1:${nextPort++}`;
        return { toString: () => value };
      },
      waitForTerminalShellIntegration: async () => null,
    },
  });
  const { ExamPreviewManager } = load("preview/manager");
  const manager = new ExamPreviewManager();
  manager.buildPreviewCommand = async () => "pnpm dev";
  const workspace = name => ({ uri: { fsPath: name, toString: () => `file:///${name}` } });
  manager.currentExam = { workspaceFolder: workspace("A") };
  await manager.ensureServer();
  const uriA = manager.localServerBaseUri;
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].cwd, "A");
  assert.deepEqual(terminals[0].commands, ["pnpm dev"], "no shell integration must still launch the server");

  await manager.ensureServer();
  assert.equal(terminals.length, 1, "same-workspace preview should reuse the server");
  assert.equal(manager.externalBaseUri, uriA);

  manager.currentExam = { workspaceFolder: workspace("B") };
  await manager.ensureServer();
  assert.equal(terminals.length, 2);
  assert.equal(terminals[0].disposed, true);
  assert.equal(terminals[1].cwd, "B");
  assert.notEqual(manager.localServerBaseUri, uriA);
  assert.equal(manager.externalBaseUri, null, "do not reuse A's forwarded URL for B");
  assert.equal(manager.serverReady, false);
  assert.deepEqual(terminals[1].commands, ["pnpm dev"]);
});
