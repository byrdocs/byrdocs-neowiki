/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS extension harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadExtension } = require('./load-extension.cjs');
const { parseDocumentSyntax: parse, isOffsetIgnored } = loadExtension({})('lib/parser');

for (const code of ['`a`', '```a``b```', '`a\nb`']) {
  test(`code span preserves adjacent closing tag: ${code}`, () => {
    const source = `<Choices><Option>${code}</Option></Choices>`;
    const state = parse(source);
    assert.equal(state.pairs.length, 2);
    assert.equal(isOffsetIgnored(source.indexOf('</Option>'), state.ignoredRanges), false);
    assert.equal(isOffsetIgnored(source.indexOf(code) + 1, state.ignoredRanges), true);
  });
}
for (const unfinished of ['<Option ', '<Figure src="./a.png', '<Figure caption={<>Tom\'s</>} />']) {
  test(`recover after unsupported or incomplete tag: ${unfinished}`, () => {
    const state = parse(`${unfinished}\n<Figure src="ok.svg" />\n<Choices>\n<Option correct>A</Option>\n</Choices>`);
    assert(state.tags.some(t => t.name === 'Figure' && t.attributes.some(a => a.value === 'ok.svg')));
    assert(state.pairs.some(p => p.name === 'Choices'));
    assert(state.pairs.some(p => p.name === 'Option'));
    assert(!state.tags.some(t => t.start === 0));
  });
}
test('code-block lists cannot lower the choice indentation', () => {
  const source = '<Choices>\n  - A\n  + B\n\n  ```\n- not an option\n  ```\n</Choices>';
  assert.deepEqual(parse(source).choiceMarkers.map(m => source.slice(m.start, m.lineEnd)), ['- A', '+ B']);
});
test('one extra space is a peer, two extra spaces are nested', () => {
  const source = '<Choices>\n- A\n + B\n  - nested\n</Choices>';
  assert.deepEqual(parse(source).choiceMarkers.map(m => source.slice(m.start, m.lineEnd)), ['- A', '+ B']);
});
test('frontmatter boundary leaves first component editable', () => {
  assert.equal(parse('---\na: b\n---\n<Blank>x</Blank>').pairs.length, 1);
});
test('long fences require matching, whitespace-only closing fences', () => {
  const source = '````mdx\n```\n<Option>example</Option>\n```` still code\n<Option>example</Option>\n````\n<Option>real</Option>';
  assert.equal(parse(source).pairs.length, 1);
});
test('real exam tags adjacent to code spans retain their pairs', () => {
  for (const exam of ['25-26-2-数据结构与算法-期末', '24-25-1-数据结构-期末']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../../exams', exam, 'index.mdx'), 'utf8');
    const state = parse(source);
    const closings = [...source.matchAll(/`<\/(Option|Blank)>/g)];
    assert(closings.length > 0);
    for (const match of closings) {
      assert(state.pairs.some(p => p.close.start === match.index + 1), `${exam}: ${match.index}`);
    }
  }
});
test('YAML subject scalars are always strings and round-trip in the sidebar', () => {
  const exams = loadExtension({ SemanticTokensLegend: class {} })('sidebar/exams');
  for (const subject of ['2024', 'true', 'null', '- 专题', '[专题] 程序设计', '程序设计 #1']) {
    const payload = exams.normalizeCreateExamPayload({startYear:'2025', term:'1', subject, stage:'期末', type:'本科', colleges:[]}, []);
    const source = exams.renderExamTemplate('---\n科目: {{科目}}\n---\n', payload);
    assert.equal(JSON.parse(source.split('\n')[1].slice(4)), subject);
    assert.equal(exams.parseExamFrontmatter(source).subject, subject);
  }
});
