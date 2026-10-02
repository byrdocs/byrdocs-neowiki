/* eslint-disable @typescript-eslint/no-require-imports -- The extension and test harness use CommonJS. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the built extension with only its host APIs and optional services replaced.
// Each test gets its own module cache, so document and preview state cannot leak.
function loadExtension(vscode, overrides = {}) {
  const root = path.resolve(__dirname, "../dist");
  const cache = new Map();
  function load(filename) {
    if (!path.extname(filename)) filename += ".js";
    const relative = path.relative(root, filename).split(path.sep).join("/");
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = (name) => {
      if (name === "vscode") return vscode;
      if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name));
      return require(name);
    };
    const execute = vm.runInThisContext(
      `(function(require, module, exports) {${fs.readFileSync(filename, "utf8")}\n})`,
      { filename },
    );
    execute(localRequire, module, module.exports);
    return module.exports;
  }
  return (name) => load(path.join(root, name));
}

module.exports = { loadExtension };
