/* eslint-disable @typescript-eslint/no-require-imports -- The extension and test harness use CommonJS. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadExtension } = require("./load-extension.cjs");

test("an already integrated terminal does not need an event subscription", async () => {
  const integration = {};
  const { waitForTerminalShellIntegration } = loadExtension({ window: {} })("preview/server");
  assert.equal(await waitForTerminalShellIntegration({ shellIntegration: integration }, 1), integration);
});

test("a callable but restricted proposed API falls back instead of rejecting", async () => {
  const { waitForTerminalShellIntegration } = loadExtension({
    window: { onDidChangeTerminalShellIntegration() { throw new Error("CANNOT use API proposal: terminalShellIntegration"); } },
  })("preview/server");
  assert.equal(await waitForTerminalShellIntegration({}, 1), null);
});

test("missing API and restricted terminal getter both fall back", async () => {
  const { waitForTerminalShellIntegration } = loadExtension({ window: {} })("preview/server");
  assert.equal(await waitForTerminalShellIntegration({}, 1), null);
  const terminal = { get shellIntegration() { throw new Error("unavailable"); } };
  assert.equal(await waitForTerminalShellIntegration(terminal, 1), null);
});

test("only the requested terminal resolves the wait and disposes its listener", async () => {
  let listener;
  let disposed = false;
  const { waitForTerminalShellIntegration } = loadExtension({
    window: { onDidChangeTerminalShellIntegration(callback) {
      listener = callback;
      return { dispose() { disposed = true; } };
    } },
  })("preview/server");
  const terminal = {};
  const integration = {};
  const pending = waitForTerminalShellIntegration(terminal, 1000);
  listener({ terminal: {}, shellIntegration: {} });
  assert.equal(disposed, false);
  listener({ terminal, shellIntegration: integration });
  assert.equal(await pending, integration);
  assert.equal(disposed, true);
});

test("timeout disposes its listener and permits the plain terminal fallback", async () => {
  let disposed = false;
  const { waitForTerminalShellIntegration } = loadExtension({
    window: { onDidChangeTerminalShellIntegration() {
      return { dispose() { disposed = true; } };
    } },
  })("preview/server");
  assert.equal(await waitForTerminalShellIntegration({}, 1), null);
  assert.equal(disposed, true);
});
