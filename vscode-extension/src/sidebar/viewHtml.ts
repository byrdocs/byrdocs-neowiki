import * as vscode from "vscode";
import {
  ANSWER_COMPLETENESS_VALUES,
  STAGE_VALUES,
  TERM_LABELS,
  TERM_VALUES,
  TYPE_VALUES,
} from "../lib/metadata";
import { createNonce, escapeAttribute, escapeHtml } from "../utils/common";
import {
  formatAcademicYearLabel,
  getAcademicYearStartOptions,
} from "./exams";
import type { CreateExamPageViewState } from "./types";

export function renderCreateExamPageViewHtml(
  _webview: vscode.Webview,
  state: CreateExamPageViewState,
): string {
  const nonce = createNonce();
  const serializedState = JSON.stringify(state).replace(/</g, "\\u003c");
  const academicYearOptions = getAcademicYearStartOptions()
    .map(
      (startYear) => `<option value="${startYear}" ${state.defaults.startYear === startYear ? "selected" : ""}>${escapeHtml(formatAcademicYearLabel(startYear))}</option>`,
    )
    .join("");
  const schoolsMarkup = state.schools.length
    ? state.schools
        .map(
          (school) => `
            <label class="school-option">
              <input type="checkbox" name="colleges" value="${escapeAttribute(school)}" />
              <span>${escapeHtml(school)}</span>
            </label>`,
        )
        .join("")
    : '<p class="empty-note">未读取到学院列表，将只创建基础 frontmatter。</p>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: light dark;
      --accent: #0f766e;
      --accent-soft: color-mix(in srgb, var(--accent) 15%, transparent);
      --border: var(--vscode-input-border, rgba(127, 127, 127, 0.35));
      --muted: var(--vscode-descriptionForeground);
    }
    body {
      margin: 0;
      padding: 16px 14px 20px;
      font: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: linear-gradient(180deg, var(--vscode-sideBar-background), color-mix(in srgb, var(--vscode-sideBar-background) 85%, var(--accent-soft)));
    }
    h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.35;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 12px;
    }
    form { display: grid; gap: 14px; margin-top: 0; }
    .row { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .field { display: grid; gap: 6px; }
    label { font-size: 12px; font-weight: 600; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--vscode-input-background) 92%, var(--accent-soft));
      color: var(--vscode-input-foreground);
      box-sizing: border-box;
    }
    .school-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 10px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, var(--accent-soft));
      max-height: 190px;
      overflow: auto;
    }
    .school-option { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; font-weight: 400; }
    .school-option input { width: auto; margin-top: 2px; }
    .preview-card, .message-card, .error-card {
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 12px;
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 90%, var(--accent-soft));
    }
    .preview-card strong {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .preview-value { font-size: 13px; line-height: 1.5; word-break: break-all; }
    .error-card { display: none; border-color: color-mix(in srgb, #dc2626 50%, var(--border)); }
    .error-card.visible { display: block; }
    .error-card ul { margin: 0; padding-left: 18px; }
    .message-card { display: none; border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
    .message-card.visible { display: block; }
    .actions { display: block; }
    .page { display: grid; gap: 16px; }
    button, .exam-item {
      font: inherit;
    }
    button[type="submit"], .secondary-button, .top-action-button {
      width: 100%;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font-weight: 600;
    }
    button[type="submit"]:hover, .secondary-button:hover, .top-action-button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button[disabled] { opacity: 0.6; cursor: wait; }
    .secondary-button {
      width: auto;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .secondary-button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .top-action-button {
      width: 100%;
      border-radius: 10px;
      padding: 7px 11px;
      font-size: 11px;
    }
    .page.hidden { display: none; }
    .page-stack { display: grid; gap: 18px; }
    .page-header {
      display: grid;
      gap: 10px;
    }
    .page-header-copy {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .filter-panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 90%, var(--accent-soft));
    }
    .filter-grid {
      display: grid;
      gap: 8px 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .filter-panel .field {
      gap: 4px;
    }
    .filter-panel label {
      font-size: 11px;
      font-weight: 600;
    }
    .filter-panel input,
    .filter-panel select {
      padding: 5px 8px;
      min-height: 28px;
      border-radius: 7px;
      font-size: 11px;
    }
    .list-summary {
      font-size: 11px;
      color: var(--muted);
    }
    .exam-list {
      display: grid;
      gap: 10px;
    }
    .exam-item {
      display: grid;
      gap: 4px;
      width: 100%;
      text-align: left;
      padding: 12px 13px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 94%, var(--accent-soft));
      color: inherit;
      cursor: pointer;
    }
    .exam-item:hover {
      border-color: var(--vscode-list-hoverForeground, var(--border));
      background: var(--vscode-list-hoverBackground, color-mix(in srgb, var(--vscode-editorWidget-background) 90%, transparent));
    }
    .exam-title {
      font-weight: 700;
      font-size: 12px;
      line-height: 1.45;
    }
    .exam-name {
      font-size: 11px;
      color: var(--muted);
      word-break: break-all;
    }
    .create-topbar {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin-bottom: 4px;
    }
    #create-form {
      gap: 12px;
    }
    #create-form .row {
      gap: 8px 10px;
    }
    #create-form .field {
      gap: 4px;
    }
    #create-form label {
      font-size: 11px;
    }
    #create-form input,
    #create-form select,
    #create-form textarea {
      padding: 5px 8px;
      min-height: 28px;
      border-radius: 7px;
      font-size: 11px;
    }
    #create-form .school-grid {
      gap: 6px;
      padding: 8px;
      border-radius: 8px;
      max-height: 168px;
    }
    #create-form .school-option {
      gap: 6px;
      font-size: 11px;
    }
    #create-form .school-option input {
      min-height: auto;
      padding: 0;
    }
    #create-form .preview-card,
    #create-form .message-card,
    #create-form .error-card {
      padding: 10px;
      border-radius: 10px;
    }
    #create-form .preview-card strong {
      margin-bottom: 4px;
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
    }
    #create-form .preview-value {
      font-size: 12px;
      line-height: 1.45;
    }
    #create-form .muted-note,
    #create-form .empty-note,
    #create-form .message-card,
    #create-form .error-card {
      font-size: 11px;
    }
    #create-form #submit-button,
    .create-topbar .secondary-button {
      border-radius: 10px;
      padding: 7px 11px;
      font-size: 11px;
    }
    .muted-note, .empty-note { font-size: 12px; color: var(--muted); line-height: 1.5; }
    @media (max-width: 520px) {
      .row, .school-grid, .filter-grid { grid-template-columns: 1fr; }
      .page-header > button, .create-topbar > button { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page-stack">
    <section id="list-view" class="page">
      <div class="page-header">
        <button type="button" class="top-action-button" id="show-create-button">新建页面</button>
      </div>

      <div class="filter-panel">
        <div class="field">
          <label for="exam-search">搜索</label>
          <input id="exam-search" type="search" placeholder="搜索课程、备注或目录名" />
        </div>
        <div class="filter-grid">
          <div class="field">
            <label for="filter-period">学年学期</label>
            <select id="filter-period"><option value="">全部</option></select>
          </div>
          <div class="field">
            <label for="filter-stage">阶段</label>
            <select id="filter-stage"><option value="">全部</option></select>
          </div>
          <div class="field">
            <label for="filter-college">学院</label>
            <select id="filter-college"><option value="">全部</option></select>
          </div>
          <div class="field">
            <label for="filter-completeness">答案完成度</label>
            <select id="filter-completeness"><option value="">全部</option></select>
          </div>
        </div>
        <div class="list-summary" id="list-summary"></div>
      </div>

      <div class="exam-list" id="exam-list"></div>
    </section>

    <section id="create-view" class="page hidden">
      <div class="create-topbar">
        <button type="button" class="secondary-button" id="back-to-list-button">返回页面列表</button>
      </div>

      <form id="create-form">
        <div class="field">
          <label for="startYear">学年</label>
          <select id="startYear" name="startYear">${academicYearOptions}</select>
        </div>

        <div class="row">
          <div class="field">
            <label for="term">学期</label>
            <select id="term" name="term">
              ${TERM_VALUES.map((value) => `<option value="${value}" ${state.defaults.term === value ? "selected" : ""}>${value} · ${TERM_LABELS[value]}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="stage">阶段</label>
            <select id="stage" name="stage">
              ${STAGE_VALUES.map((value) => `<option value="${value}" ${state.defaults.stage === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="field">
          <label for="subject">课程名称</label>
          <input id="subject" name="subject" type="text" placeholder="例如：线性代数" value="${escapeAttribute(state.defaults.subject)}" />
        </div>

        <div class="row">
          <div class="field">
            <label for="type">类型</label>
            <select id="type" name="type">
              ${TYPE_VALUES.map((value) => `<option value="${value}" ${state.defaults.type === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="answerCompleteness">答案完成度</label>
            <select id="answerCompleteness" name="answerCompleteness">
              <option value="">不填写</option>
              ${ANSWER_COMPLETENESS_VALUES.map((value) => `<option value="${value}">${value}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="field">
          <label for="remark">备注（可选）</label>
          <input id="remark" name="remark" type="text" placeholder="例如：A卷 / 国际学院" value="${escapeAttribute(state.defaults.remark)}" />
        </div>

        <div class="field">
          <label for="source">来源 md5（可选）</label>
          <input id="source" name="source" type="text" maxlength="32" placeholder="32 位小写 md5" value="${escapeAttribute(state.defaults.source)}" />
        </div>

        <div class="field">
          <label>学院（可选）</label>
          <div class="school-grid">${schoolsMarkup}</div>
          <div class="muted-note">学院会写入 YAML 列表；不勾选时会省略该字段。</div>
        </div>

        <div class="preview-card">
          <strong>目录名预览</strong>
          <div class="preview-value" id="name-preview">-</div>
        </div>

        <div class="preview-card">
          <strong>时间字段预览</strong>
          <div class="preview-value" id="time-preview">-</div>
        </div>

        <div class="error-card" id="errors"></div>
        <div class="message-card" id="message"></div>

        <div class="actions">
          <button type="submit" id="submit-button">创建并预览</button>
        </div>
      </form>
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = ${serializedState};
    const exams = Array.isArray(state.exams) ? state.exams : [];
    const schools = Array.isArray(state.schools) ? state.schools : [];
    const initialView = state.initialView === "create" ? "create" : "list";
    const listView = document.getElementById("list-view");
    const createView = document.getElementById("create-view");
    const showCreateButton = document.getElementById("show-create-button");
    const backToListButton = document.getElementById("back-to-list-button");
    const searchInput = document.getElementById("exam-search");
    const periodFilter = document.getElementById("filter-period");
    const stageFilter = document.getElementById("filter-stage");
    const collegeFilter = document.getElementById("filter-college");
    const completenessFilter = document.getElementById("filter-completeness");
    const listSummary = document.getElementById("list-summary");
    const examList = document.getElementById("exam-list");
    const form = document.getElementById("create-form");
    const errors = document.getElementById("errors");
    const message = document.getElementById("message");
    const remarkInput = document.getElementById("remark");
    const subjectInput = document.getElementById("subject");
    const submitButton = document.getElementById("submit-button");
    const namePreview = document.getElementById("name-preview");
    const timePreview = document.getElementById("time-preview");

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }
    function normalizeRemark(value) {
      return value.trim().replace(/^[（(]\\s*/, "").replace(/\\s*[）)]$/, "").trim();
    }
    function padYear(year) {
      return String(year).slice(-2).padStart(2, "0");
    }
    function deriveEndYear(startYear) {
      return parseInt(startYear) + 1;
    }
    function formatPeriodLabel(startYear, term) {
      return startYear + "-" + deriveEndYear(startYear) + " 年" + (term === "1" ? "第一学期" : "第二学期");
    }
    function setView(view) {
      const showList = view === "list";
      listView.classList.toggle("hidden", !showList);
      createView.classList.toggle("hidden", showList);
      if (showList) {
        searchInput.focus();
      } else {
        subjectInput.focus();
      }
    }
    function fillSelectOptions(select, values, formatter) {
      const currentValue = select.value;
      const extraOptions = values
        .map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(formatter ? formatter(value) : value) + "</option>")
        .join("");
      select.innerHTML = '<option value="">全部</option>' + extraOptions;
      if (values.includes(currentValue)) {
        select.value = currentValue;
      }
    }
    function populateFilters() {
      const periods = [...new Set(exams.map((exam) => String(exam.academicYear + "|" + exam.term)).filter(Boolean))];
      const stages = [...new Set(exams.map((exam) => String(exam.stage)).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
      const colleges = [...new Set([...schools, ...exams.flatMap((exam) => Array.isArray(exam.colleges) ? exam.colleges : [])].filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
      const completeness = [...new Set(exams.map((exam) => String(exam.answerCompleteness)).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
      fillSelectOptions(periodFilter, periods, (value) => {
        const [academicYear, term] = String(value).split("|");
        const [startYear] = String(academicYear).split("-");
        return formatPeriodLabel(startYear, term);
      });
      fillSelectOptions(stageFilter, stages);
      fillSelectOptions(collegeFilter, colleges);
      fillSelectOptions(completenessFilter, completeness);
    }
    function renderExamList() {
      const query = searchInput.value.trim().toLowerCase();
      const filteredExams = exams.filter((exam) => {
        if (periodFilter.value && (exam.academicYear + "|" + exam.term) !== periodFilter.value) return false;
        if (stageFilter.value && exam.stage !== stageFilter.value) return false;
        if (collegeFilter.value && !exam.colleges.includes(collegeFilter.value)) return false;
        if (completenessFilter.value && exam.answerCompleteness !== completenessFilter.value) return false;
        if (!query) return true;
        const haystack = [
          exam.examName,
          exam.subject,
          exam.stage,
          exam.academicYear,
          exam.remark,
          exam.answerCompleteness,
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });

      listSummary.textContent = "共 " + exams.length + " 份试卷，当前显示 " + filteredExams.length + " 份。";
      if (filteredExams.length === 0) {
        examList.innerHTML = '<div class="preview-card"><div class="preview-value">没有匹配的试卷。</div></div>';
        return;
      }

      examList.innerHTML = filteredExams.map((exam) => {
        return '<button type="button" class="exam-item" data-exam-name="' + escapeHtml(exam.examName) + '">' +
          '<div class="exam-title">' + escapeHtml(exam.subject) + '</div>' +
          '<div class="exam-name">' + escapeHtml(exam.examName) + '</div>' +
        '</button>';
      }).join("");
    }
    function collectPayload() {
      return {
        startYear: form.startYear.value,
        term: form.term.value,
        subject: form.subject.value.trim(),
        stage: form.stage.value,
        type: form.type.value,
        remark: form.remark.value,
        source: form.source.value.trim().toLowerCase(),
        answerCompleteness: form.answerCompleteness.value,
        colleges: [...form.querySelectorAll('input[name="colleges"]:checked')].map((input) => input.value),
      };
    }
    function computeErrors(payload) {
      const problems = [];
      const startYear = Number.parseInt(payload.startYear, 10);
      if (!Number.isInteger(startYear) || String(startYear).length !== 4) problems.push("开始年份必须是四位数字。");
      if (!payload.subject) problems.push("课程名称不能为空。");
      if (/[\\\\/:*?"<>|]/.test(payload.subject)) problems.push("课程名称不能包含文件系统保留字符。");
      if (payload.source && !/^[0-9a-f]{32}$/.test(payload.source)) problems.push("来源必须是 32 位小写 md5。");
      if (normalizeRemark(payload.remark) && /[\\\\/:*?"<>|]/.test(normalizeRemark(payload.remark))) problems.push("备注不能包含文件系统保留字符。");
      return problems;
    }
    function renderErrors(problems) {
      if (!problems.length) {
        errors.className = "error-card";
        errors.innerHTML = "";
        return;
      }
      errors.className = "error-card visible";
      errors.innerHTML = "<ul>" + problems.map((problem) => "<li>" + problem + "</li>").join("") + "</ul>";
    }
    function renderMessage(text) {
      if (!text) {
        message.className = "message-card";
        message.textContent = "";
        return;
      }
      message.className = "message-card visible";
      message.textContent = text;
    }
    function updatePreview() {
      const payload = collectPayload();
      const problems = computeErrors(payload);
      renderErrors(problems);
      const startYear = Number.parseInt(payload.startYear, 10);
      const endYear = Number.isInteger(startYear) ? deriveEndYear(startYear) : NaN;
      const remark = normalizeRemark(payload.remark);
      if (Number.isInteger(startYear) && Number.isInteger(endYear) && payload.subject) {
        const name = [padYear(startYear), padYear(endYear), payload.term, payload.subject, payload.stage].join("-") + (remark ? "（" + remark + "）" : "");
        namePreview.textContent = name;
      } else {
        namePreview.textContent = "输入完整信息后自动生成";
      }
      if (Number.isInteger(startYear) && Number.isInteger(endYear)) {
        timePreview.textContent = startYear + "-" + endYear + "学年第" + (payload.term === "1" ? "一" : "二") + "学期";
      } else {
        timePreview.textContent = "输入年份后自动生成";
      }
      return problems.length === 0;
    }
    function setBusy(busy) {
      submitButton.disabled = busy;
      submitButton.textContent = busy ? "正在创建..." : "创建并预览";
    }
    showCreateButton.addEventListener("click", () => {
      setView("create");
    });
    backToListButton.addEventListener("click", () => {
      setView("list");
    });
    examList.addEventListener("click", (event) => {
      const target = event.target.closest("[data-exam-name]");
      if (!target) return;
      const examName = target.getAttribute("data-exam-name");
      if (!examName) return;
      vscode.postMessage({ type: "openExamPage", examName });
    });
    [searchInput, periodFilter, stageFilter, collegeFilter, completenessFilter].forEach((element) => {
      element.addEventListener("input", renderExamList);
      element.addEventListener("change", renderExamList);
    });
    form.addEventListener("input", () => {
      renderMessage("");
      updatePreview();
    });
    form.addEventListener("change", () => {
      renderMessage("");
      updatePreview();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = collectPayload();
      const problems = computeErrors(payload);
      renderErrors(problems);
      if (problems.length > 0) return;
      setBusy(true);
      renderMessage("");
      vscode.postMessage({ type: "createExamPage", payload });
    });
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || typeof message.type !== "string") return;
      if (message.type === "created") {
        setBusy(false);
        renderMessage("已创建并打开：" + message.examName);
      }
      if (message.type === "openedExisting") {
        setBusy(false);
        renderMessage("已打开现有页面：" + message.examName);
      }
      if (message.type === "focusRemark") {
        setBusy(false);
        setView("create");
        renderMessage("该页面已存在，请添加备注后重试。");
        remarkInput.focus();
        remarkInput.select();
        remarkInput.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (message.type === "createCancelled") {
        setBusy(false);
      }
      if (message.type === "showCreateForm") {
        setView("create");
      }
      if (message.type === "showExamList") {
        setView("list");
      }
      if (message.type === "createError") {
        setBusy(false);
        renderMessage(message.message || "创建失败。");
      }
    });
    populateFilters();
    renderExamList();
    updatePreview();
    setView(initialView);
  </script>
</body>
</html>`;
}
