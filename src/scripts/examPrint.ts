import { buildPrintAnswersAppendix } from "./printAppendix";

type AnswerPlacement = "inline" | "end";
interface PrintOptions {
  answers: boolean;
  info: boolean;
  placement: AnswerPlacement;
}

function preparePrintDocument(options: PrintOptions): HTMLElement | null {
  const source = document.querySelector(".exam-page-main");
  if (!source) return null;

  // Work exclusively on a copy: no answer events or storage writes on the page.
  const printDocument = document.createElement("article");
  printDocument.className = "wiki-content exam-print-document";
  printDocument.dataset.answerMode = options.answers ? options.placement : "none";
  const title = document.querySelector("[data-page-heading]");
  if (title) printDocument.append(title.cloneNode(true));
  const questions = source.cloneNode(true) as HTMLElement;
  questions.className = "exam-page-main exam-print-questions";
  printDocument.append(questions);

  if (options.answers && options.placement === "end") {
    const appendix = buildPrintAnswersAppendix(questions);
    if (appendix) printDocument.append(appendix);
  }
  if (!options.info) questions.querySelector(".exam-info-box")?.remove();

  printDocument.querySelectorAll(".related-exams, dialog, .exam-choices-submit, .code-toolbar, .exam-figure-missing")
    .forEach((element) => element.remove());
  printDocument.querySelectorAll("[id]").forEach((element) => {
    // Preserve IDs inside SVG diagrams, which may be used by clip paths or <use>.
    if (element instanceof HTMLElement) element.removeAttribute("id");
  });
  printDocument.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    input.checked = false;
    input.removeAttribute("checked");
    // Cloned radio names must not join (and deselect) the original page's groups.
    input.removeAttribute("name");
  });
  // Chromium can split a fieldset despite break-inside: avoid. A plain block
  // keeps each copied option group together without affecting the live form.
  printDocument.querySelectorAll("fieldset.exam-choices").forEach((fieldset) => {
    const group = document.createElement("div");
    for (const attribute of fieldset.attributes) group.setAttribute(attribute.name, attribute.value);
    group.append(...fieldset.childNodes);
    fieldset.replaceWith(group);
  });
  printDocument.querySelectorAll<HTMLDetailsElement>(".exam-solution").forEach((solution) => {
    if (options.answers && (options.placement === "inline" || solution.closest(".print-answers-appendix"))) {
      solution.open = true;
    } else {
      solution.remove();
    }
  });
  printDocument.querySelectorAll(".exam-choice-option").forEach((option) => {
    option.classList.remove("is-correct", "is-wrong", "is-missed");
    if (options.answers && (options.placement === "inline" || option.closest(".print-answers-appendix")) && option.getAttribute("data-answer") === "true") {
      option.classList.add("exam-print-correct");
    }
  });
  printDocument.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.loading = "eager";
  });

  const footer = document.createElement("div");
  footer.className = "print-footer";
  const link = document.createElement("a");
  link.href = `${window.location.origin}${window.location.pathname}`;
  link.textContent = decodeURI(link.href);
  const license = document.createElement("a");
  license.href = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
  license.textContent = "CC BY-NC-SA 4.0";
  footer.append("本试卷来自 BYR Docs 维基真题：", link, document.createElement("br"), "除非另有声明，内容采用 ", license, " 授权。");
  printDocument.append(footer);
  document.body.append(printDocument);
  return printDocument;
}

export function initExamPrint(): void {
  const dialog = document.getElementById("examPrintDialog");
  const answers = document.getElementById("examPrintAnswers");
  const info = document.getElementById("examPrintInfo");
  const placement = document.getElementById("examPrintAnswerPlacement");
  const confirm = document.getElementById("examPrintDialogConfirm");
  if (!(dialog instanceof HTMLDialogElement) || !(answers instanceof HTMLInputElement) || !(info instanceof HTMLInputElement) || !(placement instanceof HTMLFieldSetElement) || !(confirm instanceof HTMLButtonElement)) return;
  if (dialog.dataset.ready === "true") return;
  dialog.dataset.ready = "true";

  let options: PrintOptions = { answers: true, info: false, placement: "end" };
  let printDocument: HTMLElement | null = null;
  let preparing = false;
  const syncPlacement = () => { placement.disabled = !answers.checked; };
  const openDialog = () => {
    if (preparing) return;
    answers.checked = options.answers;
    info.checked = options.info;
    placement.querySelectorAll<HTMLInputElement>("input").forEach(input => {
      input.checked = input.value === options.placement;
    });
    syncPlacement();
    if (!dialog.open) dialog.showModal();
  };
  const prepare = () => {
    printDocument ??= preparePrintDocument(options);
    if (printDocument) document.documentElement.classList.add("exam-printing");
  };
  const finish = () => {
    printDocument?.remove();
    printDocument = null;
    document.documentElement.classList.remove("exam-printing");
    preparing = false;
    confirm.disabled = false;
  };
  document.getElementById("examPrint")?.addEventListener("click", openDialog);
  document.getElementById("examPrintDialogCancel")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  answers.addEventListener("change", syncPlacement);
  confirm.addEventListener("click", async () => {
    if (preparing) return;
    options = {
      answers: answers.checked,
      info: info.checked,
      placement: placement.querySelector<HTMLInputElement>("input:checked")?.value === "inline" ? "inline" : "end",
    };
    preparing = true;
    confirm.disabled = true;
    dialog.close();
    try {
      prepare();
      // Give copied lazy images and math fonts time to load before opening preview.
      const resources = [document.fonts.ready, ...Array.from(printDocument?.querySelectorAll("img") ?? [], image => image.decode().catch(() => {}))];
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([Promise.all(resources), new Promise(resolve => { timeout = setTimeout(resolve, 4000); })]);
      } finally {
        clearTimeout(timeout);
      }
      if (!preparing || !printDocument) return;
      window.print();
    } catch (error) {
      finish();
      throw error;
    }
  });
  window.addEventListener("beforeprint", prepare);
  window.addEventListener("afterprint", finish);
  window.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat || event.key.toLowerCase() !== "p") return;
    event.preventDefault();
    openDialog();
  });
}
