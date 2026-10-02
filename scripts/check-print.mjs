// Run against the Astro development server; uses a dedicated Playwright CLI session.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const baseURL = process.argv[2] || "http://127.0.0.1:4331";
const session = "neowiki-print";
async function checkPrint(page, baseURL) {
  let checks = 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };
  await page.goto(baseURL + "/exam/24-25-1-数据结构-期末/");
  await page.waitForSelector('#examPrintDialog[data-ready="true"]', {state: 'attached'});
  await page.waitForSelector('.exam-choices[data-exam-choices-ready]');
  await page.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls++; window.dispatchEvent(new Event('beforeprint')); };
    window.dispatchEvent(new CustomEvent('examsetall', {detail: {revealed: false}}));
    document.querySelector('.exam-blank[aria-pressed]').click();
    document.querySelector('.exam-solution').open = true;
    const choice = document.querySelector('.exam-choices');
    choice.querySelector('.exam-choice-option:not([data-answer="true"]) input').click();
    choice.querySelector('.exam-choices-submit').click();
  });
  // details toggle and progress persistence are asynchronous.
  await page.waitForTimeout(100);
  const snapshot = () => page.evaluate(() => {
    const root = document.querySelector('main .exam-page-main');
    return JSON.stringify({html: root.innerHTML, checked: [...root.querySelectorAll('input')].map(i => i.checked), storage: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('exam-state:')))});
  });
  const original = await snapshot();
  await page.keyboard.press('Control+p');
  assert(await page.locator('#examPrintDialog').evaluate(el => el.open), 'Keyboard must open options');
  assert(await page.locator('#examPrintAnswers').isChecked(), 'Answers should default on');
  assert(!(await page.locator('#examPrintInfo').isChecked()), 'Info should default off');
  assert(await page.locator('input[name="examPrintPlacement"][value="end"]').isChecked(), 'Appendix should be default');
  await page.locator('#examPrintDialogCancel').click();
  assert(await snapshot() === original, 'Cancel options changed original');

  for (const mode of ['end', 'inline', 'none']) {
    await page.emulateMedia({media: 'screen'});
    await page.evaluate(mode => {
      document.documentElement.classList.toggle('dark', mode === 'inline');
      document.querySelector('#examPrint').click();
    }, mode);
    await page.locator('#examPrintAnswers').setChecked(mode !== 'none');
    await page.locator('#examPrintInfo').setChecked(mode === 'inline');
    assert(await page.locator('#examPrintAnswerPlacement').evaluate(el => el.disabled) === (mode === 'none'), 'Placement disabled state');
    if (mode !== 'none') await page.locator('input[name="examPrintPlacement"][value="' + mode + '"]').check();
    await page.locator('#examPrintDialogConfirm').click();
    await page.waitForFunction(count => window.__printCalls === count, ['end', 'inline', 'none'].indexOf(mode) + 1);
    await page.waitForSelector('.exam-print-document', {state: 'attached'});
    await page.waitForFunction(() => document.documentElement.classList.contains('exam-printing'));
    assert(await snapshot() === original, mode + ': preparing changed original DOM/storage');
    await page.emulateMedia({media: 'print'});
    const state = await page.evaluate(() => {
      const root = document.querySelector('.exam-print-document');
      const questions = root.querySelector('.exam-print-questions');
      const blank = questions.querySelector('.exam-blank-answer');
      const option = questions.querySelector('.exam-choice-option[data-answer="true"]');
      return {
        blankVisibility: getComputedStyle(blank).visibility,
        blankWidth: blank.getBoundingClientRect().width,
        solutions: questions.querySelectorAll('.exam-solution').length,
        open: [...questions.querySelectorAll('.exam-solution')].every(e => e.open),
        outline: getComputedStyle(option).outlineStyle,
        mark: getComputedStyle(option.querySelector('.exam-choice-indicator'), '::after').content,
        info: questions.querySelectorAll('.exam-info-box').length,
        appendix: root.querySelectorAll('.print-answers-appendix').length,
        appendixItems: root.querySelectorAll('.print-answer-item').length,
        onlyPrint: [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').every(e => e === root),
        tools: root.querySelectorAll('.related-exams, .exam-choices-submit, dialog').length,
        footer: root.querySelector('.print-footer').textContent,
        color: getComputedStyle(root).color,
        selected: [...root.querySelectorAll('input')].some(e => e.checked),
      };
    });
    assert(state.blankWidth > 0 && state.blankVisibility === (mode === 'inline' ? 'visible' : 'hidden'), mode + ': blank visibility/space');
    assert(mode === 'inline' ? state.solutions > 0 && state.open : state.solutions === 0, mode + ': solution visibility');
    assert(mode === 'inline' ? state.outline !== 'none' && state.mark !== 'none' : state.outline === 'none' && state.mark === 'none', mode + ': choice marks');
    assert(state.info === (mode === 'inline' ? 1 : 0), mode + ': info visibility');
    assert(state.appendix === (mode === 'end' ? 1 : 0), mode + ': appendix');
    if (mode === 'end') assert(state.appendixItems > 20, 'Missing appendix answers');
    assert(state.onlyPrint && state.tools === 0 && !state.selected, mode + ': UI/selection leaked to print');
    assert(state.color === 'rgb(17, 17, 17)' && state.footer.includes('CC BY-NC-SA 4.0'), 'Print colors/license');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert(await page.locator('.exam-print-document').count() === 1, 'Repeated beforeprint created duplicate');
    // PDF generation invokes the real browser print lifecycle, including afterprint.
    await page.pdf({path: 'output/playwright/print-' + mode + '.pdf', preferCSSPageSize: true, printBackground: false});
    await page.evaluate(() => {
      window.dispatchEvent(new Event('afterprint'));
      window.dispatchEvent(new Event('afterprint'));
    });
    await page.emulateMedia({media: 'screen'});
    assert(await page.locator('.exam-print-document').count() === 0, 'afterprint did not clean up');
    assert(!(await page.locator('#examPrintDialogConfirm').isDisabled()), 'Print button not restored');
    assert(await snapshot() === original, mode + ': original DOM/storage changed after print');
    console.log('PASS ' + mode + ': rendering, PDF, repeated lifecycle, unchanged original DOM/storage');
  }
  // Native browser-menu printing works without clicking the toolbar first.
  await page.reload();
  await page.waitForSelector('#examPrintDialog[data-ready="true"]', {state: 'attached'});
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert(await page.locator('.print-answers-appendix').count() === 1, 'Browser menu should use default appendix');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  console.log('PASS native browser-menu lifecycle');

  // Failure must restore the page, including the print button.
  const errorPromise = page.waitForEvent('pageerror');
  await page.evaluate(() => {
    window.print = () => { throw new Error('expected-print-failure'); };
    document.querySelector('#examPrint').click();
    document.querySelector('#examPrintDialogConfirm').click();
  });
  assert((await errorPromise).message.includes('expected-print-failure'), 'Expected print failure');
  assert(await page.locator('.exam-print-document').count() === 0, 'Failed printing did not clean up');
  assert(!(await page.locator('#examPrintDialogConfirm').isDisabled()), 'Failed printing left disabled button');
  console.log('PASS print failure cleanup');

  const results = await page.evaluate(async () => {
    const { buildPrintAnswersAppendix } = await import('/src/scripts/printAppendix.ts');
    const build = html => {
      const root = document.createElement('div');
      root.className = 'exam-page-main';
      root.innerHTML = html;
      return buildPrintAnswersAppendix(root);
    };
    const blank = answer => '<span class="exam-blank"><span class="exam-blank-answer">' + answer + '</span></span>';
    const solution = answer => '<details class="exam-solution"><div class="exam-solution-content">' + answer + '</div></details>';
    const partial = build('<h2>填空</h2><ol start="3"><li>' + blank('three') + '</li><li>' + blank('') + '</li><li>' + blank('five') + '</li></ol><h2>空章节</h2>' + blank(''));
    const fallback = build('<h2>无编号</h2>' + blank('first') + blank('') + blank('third'));
    const nested = build('<h2>大题</h2><h3>7.</h3>' + solution('<h2>解题过程</h2><ol><li>' + blank('nested') + '</li></ol>'));
    const choice = build('<h2>选择</h2><fieldset class="exam-choices"><div class="exam-choices-item">第 9 题</div><label class="exam-choice-option"></label><label class="exam-choice-option" data-answer="true"></label><label class="exam-choice-option" data-answer="true"></label></fieldset>');
    const labels = root => [...root.querySelectorAll('.print-answer-label')].map(e => e.textContent).join(',');
    return {
      partial: labels(partial), sections: partial.querySelectorAll('.print-answer-section').length,
      fallback: labels(fallback), nested: labels(nested), nestedCount: nested.querySelectorAll('.print-answer-item').length,
      choice: labels(choice), letters: choice.querySelector('.print-answer-body').textContent,
      empty: build('<h2>空</h2>' + blank('') + solution('')) === null,
      svg: build(solution('<svg><path d="M0 0h1"/></svg>'))?.querySelectorAll('svg').length,
    };
  });
  assert(results.partial === '3.,5.' && results.sections === 1, 'Partial list answers/empty sections: ' + JSON.stringify(results));
  assert(results.fallback === '1.,3.', 'Missing answers shifted fallback numbering');
  assert(results.nested === '7.' && results.nestedCount === 1, 'Solution headings/nested answers affected numbering');
  assert(results.choice === '9.' && results.letters === 'B、C', 'Explicit choice number/multiple answers');
  assert(results.empty && results.svg === 1, 'Empty or image-only answers mishandled');
  console.log('PASS appendix: partial answers, original numbers, nested explanations, multiple choice, empty and SVG-only answers');

  await page.goto(baseURL + '/exam/25-26-2-习近平新时代中国特色社会主义思想概论-期末/');
  await page.waitForSelector('#examPrintDialog[data-ready="true"]', {state: 'attached'});
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert(await page.locator('.exam-print-document .exam-choices').count() === 40, 'No-answer fixture missing');
  assert(await page.locator('.print-answers-appendix').count() === 0, 'No-answer paper got an empty appendix');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  console.log('PASS real no-answer paper: 40 questions, no empty appendix');
  await page.goto(baseURL + '/exam/24-25-1-高等数学（上）-期中/');
  await page.waitForSelector('#examPrintDialog[data-ready="true"]', {state: 'attached'});
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({media: 'print'});
  await page.evaluate(() => document.fonts.ready);
  const math = await page.evaluate(() => {
    const root = document.querySelector('.exam-print-document');
    const formulas = [...root.querySelectorAll('.katex')];
    return {
      count: formulas.length,
      clipped: formulas.filter(e => e.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).length,
      appendix: root.querySelectorAll('.print-answers-appendix .katex').length,
    };
  });
  assert(math.count > 20 && math.appendix > 0, 'Math formulas/appendix missing');
  assert(math.clipped === 0, 'Math overflows print width');
  await page.pdf({path: 'output/playwright/print-math.pdf', preferCSSPageSize: true});
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({media: 'screen'});
  console.log('PASS real mathematics paper: formulas, appendix and PDF');
  return {status: 'PASS', checks, modes: ['end', 'inline', 'none'], fixtures: ['partial answers', 'original numbering', 'nested solutions', 'multiple choice', 'empty answers', 'SVG answers', '40 unanswered questions']};
}

mkdirSync('output/playwright', {recursive: true});
const cli = (...args) => execFileSync('npx', ['--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', session, ...args], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
try {
  cli('open', baseURL);
  const result = cli('run-code', `async (page) => { return await (${checkPrint.toString()})(page, ${JSON.stringify(baseURL)}); }`);
  writeFileSync('output/playwright/check-print.log', result);
  console.log(result.split('### Ran Playwright code')[0]);
  if (result.includes('### Error') || !/"status"\s*:\s*"PASS"/.test(result)) process.exitCode = 1;
} catch (error) {
  console.error(String(error.stdout || error.message));
  process.exitCode = 1;
} finally {
  cli('close');
}
