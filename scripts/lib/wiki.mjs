const DEFAULT_BASE_URL = "https://wiki.byrdocs.org";
const EXAM_TITLE_PATTERN = /^\d{2}-\d{2}-[12]-.+-(期中|期末)(?:（.+）)?$/;

const LOGIN_PAGE_MARKERS = [
    "<title>BYR Docs 登录</title>",
    "登录 BYR Docs Wiki",
];
const HTML_RESPONSE_PREFIX = /^<(?:!doctype\s+html\b|html\b|head\b|body\b)/i;
const AUTH_INTERCEPT_MESSAGE = "wiki API 返回了 HTML 而不是 JSON，可能被认证拦截。请正确设置 BYRDOCS_WIKI_HEADER 或 BYRDOCS_WIKI_COOKIE。";

export function loadEnvFile() {
    if (typeof process.loadEnvFile !== "function")
        return;

    try {
        process.loadEnvFile(".env");
    } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT")
            throw error;
    }
}

loadEnvFile();

export function getBaseUrl() {
    return process.env.BYRDOCS_WIKI_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

export function rewriteWikiUrl(url) {
    const original = new URL(url);
    const base = new URL(getBaseUrl());
    original.protocol = base.protocol;
    original.host = base.host;
    return original.toString();
}

export function getAuthHeaders() {
    const headers = new Headers({
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "byrdocs-wiki-exporter/0.1",
    });

    const customHeader = process.env.BYRDOCS_WIKI_HEADER?.trim();
    if (customHeader)
        headers.set("X-Byrdocs-Header", customHeader);

    const cookie = process.env.BYRDOCS_WIKI_COOKIE?.trim();
    if (cookie)
        headers.set("Cookie", cookie);

    return headers;
}

export function isExamTitle(title) {
    return EXAM_TITLE_PATTERN.test(title);
}

export function getPageContent(page) {
    return page?.revisions?.[0]?.slots?.main?.content ?? "";
}

function looksLikeHtml(bodyText, contentType) {
    const trimmed = bodyText.trimStart();
    return /(?:^|[;,]\s*)text\/html\b/i.test(contentType) || HTML_RESPONSE_PREFIX.test(trimmed);
}

function assertAuthenticatedResponse(bodyText, url, contentType = "") {
    if (LOGIN_PAGE_MARKERS.some(marker => bodyText.includes(marker)) || looksLikeHtml(bodyText, contentType)) {
        throw new Error(`${AUTH_INTERCEPT_MESSAGE} 请求地址：${url}`);
    }
}

export async function wikiApiQuery(params) {
    const url = new URL("/api.php", getBaseUrl());
    const searchParams = new URLSearchParams({
        format: "json",
        formatversion: "2",
    });

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "")
            continue;
        searchParams.set(key, String(value));
    }

    url.search = searchParams.toString();

    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    const bodyText = await response.text();
    const contentType = response.headers.get("content-type") || "";

    assertAuthenticatedResponse(bodyText, url, contentType);

    if (!response.ok) {
        throw new Error(`请求 ${url} 失败，HTTP ${response.status}: ${bodyText.slice(0, 400)}`);
    }

    try {
        return JSON.parse(bodyText);
    } catch (error) {
        if (looksLikeHtml(bodyText, contentType))
            throw new Error(`${AUTH_INTERCEPT_MESSAGE} 请求地址：${url}`, { cause: error });

        throw new Error(
            `请求 ${url} 返回的内容不是合法 JSON：${bodyText.slice(0, 400)}`,
            { cause: error },
        );
    }
}

export async function *iterateExamPages({ props = "revisions", rvprop = "content" } = {}) {
    let continuation = {};

    while (true) {
        const data = await wikiApiQuery({
            action: "query",
            generator: "allpages",
            gapnamespace: "0",
            gapfilterredir: "nonredirects",
            gaplimit: "max",
            prop: props,
            rvslots: props.includes("revisions") ? "main" : undefined,
            rvprop: props.includes("revisions") ? rvprop : undefined,
            cllimit: props.includes("categories") ? "max" : undefined,
            imlimit: props.includes("images") ? "max" : undefined,
            ...continuation,
        });

        const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
        for (const page of pages) {
            if (typeof page?.title === "string" && isExamTitle(page.title))
                yield page;
        }

        if (!data?.continue)
            break;

        continuation = data.continue;
    }
}

export async function fetchExamPage(title) {
    const data = await wikiApiQuery({
        action: "query",
        prop: "revisions|categories|images",
        titles: title,
        rvslots: "main",
        rvprop: "content",
        cllimit: "max",
        imlimit: "max",
    });

    const page = Array.isArray(data?.query?.pages) ? data.query.pages[0] : undefined;

    if (!page || page.missing)
        throw new Error(`旧 wiki 页面不存在：${title}`);

    return page;
}

export async function fetchFileDownloadInfo(fileTitle) {
    const data = await wikiApiQuery({
        action: "query",
        prop: "imageinfo",
        titles: fileTitle,
        iiprop: "url",
    });

    const page = Array.isArray(data?.query?.pages) ? data.query.pages[0] : undefined;
    const imageInfo = page?.imageinfo?.[0];

    if (!imageInfo?.url)
        throw new Error(`无法获取文件下载地址：${fileTitle}`);

    return {
        ...imageInfo,
        url: rewriteWikiUrl(imageInfo.url),
        descriptionurl: imageInfo.descriptionurl
            ? rewriteWikiUrl(imageInfo.descriptionurl)
            : imageInfo.descriptionurl,
        descriptionshorturl: imageInfo.descriptionshorturl
            ? rewriteWikiUrl(imageInfo.descriptionshorturl)
            : imageInfo.descriptionshorturl,
    };
}
