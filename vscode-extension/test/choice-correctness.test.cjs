/* eslint-disable @typescript-eslint/no-require-imports -- The extension and test harness use CommonJS. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadExtension } = require("./load-extension.cjs");

class Uri {}
class Position {
  constructor(line, character) { Object.assign(this, { line, character }); }
}
class Range {
  constructor(start, end) { Object.assign(this, { start, end }); }
}

for (const attribute of ["correct", "correct={true}", 'correct="true"', "correct='true'", 'correct=""', "correct = {true}"]) {
  test(`toggling ${attribute} preserves valid markup and neighboring attributes`, async () => {
    const before = `<Choices>\n<Option data-note="keep" ${attribute} item="1">A</Option>\n</Choices>`;
    const uri = new Uri();
    const document = {
      uri, version: 1, text: before,
      getText() { return this.text; },
      positionAt(offset) {
        const lines = this.text.slice(0, offset).split("\n");
        return new Position(lines.length - 1, lines.at(-1).length);
      },
      offsetAt(position) {
        return this.text.split("\n").slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
      },
    };
    class WorkspaceEdit {
      delete(_uri, range) { this.range = range; }
    }
    const vscode = {
      Uri, Position, Range, WorkspaceEdit,
      SemanticTokensLegend: class {},
      workspace: {
        openTextDocument: async () => document,
        applyEdit: async (edit) => {
          document.text = document.text.slice(0, document.offsetAt(edit.range.start)) + document.text.slice(document.offsetAt(edit.range.end));
          return true;
        },
      },
    };
    const load = loadExtension(vscode, { "workspace.js": { isSupportedDocument: () => true } });
    const { parseDocumentSyntax } = load("lib/parser");
    const option = parseDocumentSyntax(before).tags.find(tag => tag.name === "Option");
    const correct = option.attributes.find(attr => attr.name === "correct");
    assert.equal(before.slice(correct.start, correct.end), "correct", "hover/highlight range must remain the attribute name");
    assert.equal(before.slice(correct.start, correct.fullEnd), attribute);

    await load("language/providers").toggleChoiceCorrectness({ kind: "optionTag", uri, line: 1, character: 1 });
    assert.equal(document.text, '<Choices>\n<Option data-note="keep" item="1">A</Option>\n</Choices>');
  });
}
