/* eslint-disable @typescript-eslint/no-require-imports -- The extension and test harness use CommonJS. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { loadExtension } = require('./load-extension.cjs');

class Uri {
  constructor(fsPath) { this.fsPath = fsPath; this.path = fsPath; this.scheme = 'file'; }
  toString() { return 'file://' + this.fsPath; }
  static file(value) { return new Uri(value); }
}
class Position {
  constructor(line, character) { Object.assign(this, { line, character }); }
  isAfterOrEqual(p) { return this.line > p.line || this.line === p.line && this.character >= p.character; }
  isBeforeOrEqual(p) { return this.line < p.line || this.line === p.line && this.character <= p.character; }
}
class Range { constructor(start, end) { Object.assign(this, { start, end }); } }
class WorkspaceEdit {
  delete(uri, range) { this.range = range; this.text = ''; }
  insert(uri, position, text) { this.replace(uri, new Range(position, position), text); }
  replace(uri, range, text) { this.range = range; this.text = text; }
}
function editingFixture(text) {
  const document = {
    text, version: 1, uri: Uri.file('/test/index.mdx'), fileName: '/test/index.mdx',
    getText() { return this.text; },
    positionAt(offset) { const lines = this.text.slice(0, offset).split('\n'); return new Position(lines.length - 1, lines.at(-1).length); },
    offsetAt(p) { return this.text.split('\n').slice(0, p.line).reduce((sum, line) => sum + line.length + 1, 0) + p.character; },
  };
  const load = loadExtension({
    Uri, Position, Range, WorkspaceEdit, SemanticTokensLegend: class {}, InlayHintKind: { Type: 1 },
    InlayHint: class { constructor(position, label) { Object.assign(this, { position, label }); } },
    workspace: {
      openTextDocument: async () => document,
      applyEdit: async edit => {
        document.text = document.text.slice(0, document.offsetAt(edit.range.start)) + edit.text + document.text.slice(document.offsetAt(edit.range.end));
        document.version++;
        return true;
      },
    },
  }, { 'workspace.js': { isSupportedDocument: () => true } });
  const provider = load('language/providers');
  return {
    document,
    syntax: () => load('lib/parser').parseDocumentSyntax(document.text),
    toggle: () => provider.toggleChoiceCorrectness({ kind: 'optionTag', uri: document.uri, line: 1, character: 1 }),
    labels: () => provider.createInlayHintsProvider().provideInlayHints(document, new Range(new Position(0, 0), new Position(100, 0)))
      .map(hint => hint.label.map(part => part.value).join('').trim()),
  };
}

for (const attribute of [
  'correct={2 > 1}',
  'correct={(() => ({answer: true}))().answer}',
  'correct={/}/.test("}")}',
  'correct={flag /* } > */}',
  'correct={`result ${flag ? `>${value}` : "}"}`}',
  'correct={total / count > 1}',
  'correct={flag // } >\n}',
]) {
  test(`toggle removes the complete expression: ${attribute}`, async () => {
    const fixture = editingFixture(`<Choices>\n<Option aria-label="a > b" ${attribute} item="1">A</Option>\n</Choices>`);
    await fixture.toggle();
    assert.equal(fixture.document.text, '<Choices>\n<Option aria-label="a > b" item="1">A</Option>\n</Choices>');
  });
}
test('adding correctness keeps quoted > and component-like attribute text unchanged', async () => {
  const fixture = editingFixture('<Choices>\n<Option aria-label="a > b <Option>">A</Option>\n<Option correct>B</Option>\n</Choices>');
  assert.equal(fixture.syntax().tags.filter(tag => tag.name === 'Option' && !tag.isClosing).length, 2);
  await fixture.toggle();
  assert.equal(fixture.document.text, '<Choices>\n<Option aria-label="a > b <Option>" correct>A</Option>\n<Option correct>B</Option>\n</Choices>');
});

test('markdown code examples are not treated as editable components', () => {
  const fixture = editingFixture('<Choices>\n<Option>A</Option>\n`<Option correct>示例</Option>`\n~~~mdx\n<Option correct>示例</Option>\n~~~\n<Option correct>B</Option>\n</Choices>');
  assert.deepEqual(fixture.labels(), ['错误答案', '正确答案']);
  assert.equal(fixture.syntax().tags.filter(tag => tag.name === 'Option').length, 4);
});

test('only top-level choice list markers receive answer hints', () => {
  const fixture = editingFixture('<Choices>\n- 主选项 A\n  + 选项内说明\n+ 主选项 B\n</Choices>');
  assert.deepEqual(fixture.labels(), ['错误答案', '正确答案']);
});

test('unicode identifiers followed by division do not stop tag parsing', () => {
  const fixture = editingFixture('<Choices>\n<Option correct={得分 / 2}>A</Option>\n<Option correct>B</Option>\n</Choices>');
  assert.deepEqual(fixture.labels(), ['移除答案标记', '正确答案']);
});
for (const attribute of ['correct={false}', 'correct="false"', "correct={'false'}", 'correct={null}', 'correct={0}']) {
  test(`${attribute} is false and toggles to true in one click`, async () => {
    const fixture = editingFixture(`<Choices>\n<Option ${attribute}>A</Option>\n<Option correct>B</Option>\n</Choices>`);
    assert.deepEqual(fixture.labels(), ['错误答案', '正确答案']);
    await fixture.toggle();
    assert.equal(fixture.document.text, '<Choices>\n<Option correct>A</Option>\n<Option correct>B</Option>\n</Choices>');
    assert.deepEqual(fixture.labels(), ['正确答案', '正确答案']);
    await fixture.toggle();
    assert.equal(fixture.document.text, '<Choices>\n<Option>A</Option>\n<Option correct>B</Option>\n</Choices>');
  });
}
test('dynamic expressions are not labelled as statically correct', () => {
  const fixture = editingFixture('<Choices>\n<Option correct={answer}>A</Option>\n</Choices>');
  assert.deepEqual(fixture.labels(), ['移除答案标记']);
});

test('an explicit false value remains clickable without any correct sibling', async () => {
  const fixture = editingFixture('<Choices>\n<Option correct={false}>A</Option>\n<Option>B</Option>\n</Choices>');
  assert.deepEqual(fixture.labels(), ['错误答案']);
  await fixture.toggle();
  assert.deepEqual(fixture.labels(), ['正确答案', '错误答案']);
});

test('incomplete attribute expressions are not destructively edited', async () => {
  const source = '<Choices>\n<Option correct={value > 1>A</Option>\n</Choices>';
  const fixture = editingFixture(source);
  await fixture.toggle();
  assert.equal(fixture.document.text, source);
});

test('self-closing tags and spread attributes retain their boundaries', async () => {
  const fixture = editingFixture('<Choices>\n<Option {...props} correct={2 > 1} />\n</Choices>');
  const option = fixture.syntax().tags.find(tag => tag.name === 'Option');
  assert.equal(option.selfClosing, true);
  await fixture.toggle();
  assert.equal(fixture.document.text, '<Choices>\n<Option {...props} />\n</Choices>');
});

test('backslashes in JSX quoted attributes do not escape the closing quote', async () => {
  const fixture = editingFixture('<Choices>\n<Option aria-label="path\\" correct>A</Option>\n</Choices>');
  await fixture.toggle();
  assert.equal(fixture.document.text, '<Choices>\n<Option aria-label="path\\">A</Option>\n</Choices>');
});

test('only documents belonging to wiki workspaces receive wiki editing features', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byrdocs-workspace-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const folder = (name, packageName) => {
    const dir = path.join(root, name); fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: packageName }));
    return { uri: Uri.file(dir) };
  };
  const wiki = folder('wiki', 'byrdocs-wiki'), other = folder('other', 'notes');
  const workspace = loadExtension({ SemanticTokensLegend: class {}, workspace: {
    workspaceFolders: [wiki, other],
    getWorkspaceFolder: uri => [wiki, other].find(f => uri.fsPath.startsWith(f.uri.fsPath + path.sep)),
  } })('workspace');
  assert.equal(workspace.getWikiWorkspaceFolderForUri(), wiki);
  for (const dir of [other.uri.fsPath, path.join(root, 'outside')]) {
    const uri = Uri.file(path.join(dir, 'index.mdx'));
    assert.equal(workspace.getWikiWorkspaceFolderForUri(uri), null);
    assert.equal(workspace.isSupportedDocument({ uri, fileName: uri.fsPath }), false);
  }
  const uri = Uri.file(path.join(wiki.uri.fsPath, 'index.mdx'));
  assert.equal(workspace.isSupportedDocument({ uri, fileName: uri.fsPath }), true);
});

test('create an exam in an assets-only directory and preserve existing files', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byrdocs-create-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const examName = '25-26-1-数据结构-期末';
  const directory = path.join(root, 'exams', examName);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, '题图.svg'), '<svg/>');
  const wiki = { uri: Uri.file(root) };
  const load = loadExtension({ Uri, SemanticTokensLegend: class {}, window: { showWarningMessage: async () => undefined } },
    { 'workspace.js': { getWikiWorkspaceFolderForUri: () => wiki } });
  const payload = { startYear: '2025', term: '1', subject: '数据结构', stage: '期末', type: '本科', colleges: [] };
  const previews = [];
  const manager = { showSourceDocument: async () => {}, preview: async uri => previews.push(uri.fsPath) };
  const result = await load('sidebar/exams').createExamPageFromPayload(payload, manager);
  assert.equal(result.kind, 'created');
  assert.equal(fs.readFileSync(path.join(directory, '题图.svg'), 'utf8'), '<svg/>');
  assert.match(fs.readFileSync(path.join(directory, 'index.mdx'), 'utf8'), /科目: 数据结构/);
  assert.deepEqual(previews, [path.join(directory, 'index.mdx')]);
  fs.writeFileSync(path.join(directory, 'index.mdx'), 'Existing work');
  assert.equal((await load('sidebar/exams').createExamPageFromPayload(payload, manager)).kind, 'cancelled');
  assert.equal(fs.readFileSync(path.join(directory, 'index.mdx'), 'utf8'), 'Existing work');
});

test('figure diagnostics resolve static expressions and query strings', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'byrdocs-figure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const examDirectory = path.join(root, 'exams', '25-26-1-数据结构-期末');
  fs.mkdirSync(examDirectory, { recursive: true });
  fs.writeFileSync(path.join(examDirectory, '图.svg'), '<svg/>');
  const wiki = { uri: Uri.file(root) };
  const load = loadExtension(
    {
      Uri,
      DiagnosticSeverity: { Error: 0 },
      Diagnostic: class { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } },
    },
    {
      'workspace.js': {
        getWikiWorkspaceFolderForUri: () => wiki,
        getUriExtension: () => '.mdx',
      },
    },
  );
  const updateDiagnostics = load('language/diagnostics').updateFigureDiagnostics;
  for (const [index, source] of ['<Figure src="图.svg" />', '<Figure src={"图.svg"} />', '<Figure src="图.svg?v=1" />'].entries()) {
    const document = {
      version: index + 1,
      uri: Uri.file(path.join(examDirectory, 'index.mdx')),
      fileName: path.join(examDirectory, 'index.mdx'),
      getText: () => source,
      positionAt: offset => new Position(0, offset),
    };
    let diagnostics;
    updateDiagnostics({ set: (_uri, value) => { diagnostics = value; }, delete: () => {} }, document);
    assert.deepEqual(diagnostics, []);
  }
});

test('new exam frontmatter preserves YAML-special subject names', () => {
  const exams = loadExtension({ SemanticTokensLegend: class {} })('sidebar/exams');
  const payload = exams.normalizeCreateExamPayload({ startYear: '2025', term: '1', subject: '程序设计 #1', stage: '期末', type: '本科', colleges: [] }, []);
  const source = exams.renderExamTemplate('---\n科目: {{科目}}\n---\n', payload);
  assert.match(source, /科目: "程序设计 #1"/);
  assert.equal(exams.parseExamFrontmatter(source).subject, '程序设计 #1');
});
