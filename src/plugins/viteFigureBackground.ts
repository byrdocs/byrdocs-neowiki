import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { inflateSync } from "node:zlib";

const CONTENT_DIRECTORIES = [resolve("exams"), resolve("src/others")];
const CONTENT_EXTENSIONS = new Set([".mdx"]);
const IMAGE_EXTENSIONS = new Set([".png", ".svg"]);
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

type FigureUsage = {
    assetPath: string;
    assetSrc: string;
    column: number;
    displayColumn: number;
    filePath: string;
    hasBackground: boolean;
    line: number;
    snippetLines: string[];
    tagLines: string[];
    tagSource: string;
};

type SvgDimensions = {
    x?: number;
    y?: number;
    height?: number;
    width?: number;
};

function parseAttribute(tag: string, attributeName: string) {
    const match = tag.match(
        new RegExp(
            String.raw`\b${attributeName}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>` + "`" + String.raw`]+))`,
            "i",
        ),
    );
    if (!match) return undefined;
    return match[1] ?? match[2] ?? match[3];
}

function parseStringProp(tag: string, propName: string) {
    const directMatch = tag.match(
        new RegExp(
            String.raw`\b${propName}\s*=\s*(?:"([^"]*)"|'([^']*)')`,
            "i",
        ),
    );
    if (directMatch) return directMatch[1] ?? directMatch[2];
    const expressionMatch = tag.match(
        new RegExp(
            String.raw`\b${propName}\s*=\s*\{\s*(?:"([^"]*)"|'([^']*)')\s*\}`,
            "i",
        ),
    );
    return expressionMatch ? (expressionMatch[1] ?? expressionMatch[2]) : undefined;
}

function hasExplicitBackground(tag: string) {
    return /\bbackground(?=\s|=|>|\/)/i.test(tag);
}

function maskCodeFences(content: string) {
    const lines = content.split(/\r?\n/u);
    let activeFence: { character: "`" | "~"; length: number } | undefined;
    return lines
        .map((line) => {
            const fenceMatch = line.match(/^\s*([`~]{3,})/u);
            if (!fenceMatch) return activeFence ? "" : line;

            const marker = fenceMatch[1];
            const character = marker[0] as "`" | "~";
            const length = marker.length;

            if (
                activeFence &&
                activeFence.character === character &&
                length >= activeFence.length
            ) {
                activeFence = undefined;
                return "";
            }
            if (!activeFence) {
                activeFence = { character, length };
                return "";
            }
            return "";
        })
        .join("\n");
}

function formatDisplayLine(line: string) {
    return line.replace(/\t/gu, "    ").trimEnd();
}

async function collectContentFiles(directoryPath: string): Promise<string[]> {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = resolve(directoryPath, entry.name);
            if (entry.isDirectory()) return collectContentFiles(entryPath);
            return CONTENT_EXTENSIONS.has(extname(entry.name).toLowerCase())
                ? [entryPath]
                : [];
        }),
    );
    return nested.flat();
}

function getFigureUsages(filePath: string, content: string) {
    const maskedContent = maskCodeFences(content);
    const sourceLines = content.split(/\r?\n/u);
    const usages: FigureUsage[] = [];
    for (const match of maskedContent.matchAll(/<Figure\b[^>]*>/gu)) {
        const tag = match[0];
        const src = parseStringProp(tag, "src");
        if (!src || /^(?:[a-z]+:)?\/\//iu.test(src) || src.startsWith("data:")) {
            continue;
        }

        const assetPath = filePath.startsWith(resolve("exams"))
            ? resolve(dirname(filePath), src)
            : resolve("public", src.replace(/^\/+/u, ""));
        const assetExtension = extname(assetPath).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(assetExtension)) continue;

        const matchIndex = match.index ?? 0;
        const contentBeforeMatch = maskedContent.slice(0, matchIndex);
        const line = contentBeforeMatch.split("\n").length;
        const column = matchIndex - (contentBeforeMatch.lastIndexOf("\n") + 1) + 1;
        const rawStartLine = sourceLines[line - 1] ?? "";
        const displayColumn =
            formatDisplayLine(rawStartLine.slice(0, Math.max(0, column - 1))).length + 1;
        const tagSource = tag;
        const tagLineCount = tagSource.split(/\r?\n/u).length;
        usages.push({
            assetPath,
            assetSrc: src,
            column,
            displayColumn,
            filePath,
            hasBackground: hasExplicitBackground(tag),
            line,
            snippetLines: sourceLines
                .slice(line - 1, line - 1 + tagLineCount)
                .map((sourceLine) => formatDisplayLine(sourceLine)),
            tagLines: tagSource
                .split(/\r?\n/u)
                .map((tagLine) => formatDisplayLine(tagLine)),
            tagSource,
        });
    }
    return usages;
}

const ANSI = {
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    gray: "\x1b[90m",
    red: "\x1b[31m",
    reset: "\x1b[0m",
    yellow: "\x1b[33m",
} as const;

const SUPPORTS_COLOR =
    !("NO_COLOR" in process.env) &&
    (process.env.FORCE_COLOR !== undefined
        ? process.env.FORCE_COLOR !== "0"
        : Boolean(process.stderr.isTTY));

function colorize(text: string, ...styles: string[]) {
    if (!SUPPORTS_COLOR || styles.length === 0) return text;
    return `${styles.join("")}${text}${ANSI.reset}`;
}

function formatHelpLabel() {
    return colorize("help", ANSI.bold, ANSI.yellow);
}

function formatNoteLabel() {
    return colorize("note", ANSI.bold, ANSI.cyan);
}

function formatErrorHeader(usageCount: number) {
    const errorLabel = colorize("error", ANSI.bold, ANSI.red);
    const ruleLabel = colorize("[figure-background-check]", ANSI.bold);
    const backgroundLabel = colorize("background", ANSI.bold);
    const countLabel = colorize(String(usageCount), ANSI.bold);
    return `${errorLabel}${ruleLabel}: Figure 引用透明图像时必须显式设置 \`${backgroundLabel}\` 属性（共 ${countLabel} 处）`;
}

function buildSuggestedFigureTag(
    tagSource: string,
    background: "white" | "transparent",
) {
    const baseTag = tagSource.trimEnd();
    if (!baseTag) return `<Figure ... background="${background}" />`;

    const updatedTag = baseTag.replace(
        /\s*(\/?>)\s*$/u,
        ` background="${background}"$1`,
    );

    return updatedTag === baseTag
        ? `<Figure ... background="${background}" />`
        : updatedTag;
}

function formatCaretLine(usage: FigureUsage, gutterWidth: number) {
    const pipe = colorize("|", ANSI.gray);
    const message = `此处的 <Figure> 引用了透明图像 ${colorize(usage.assetSrc, ANSI.bold)}，但未显式设置 background 属性`;
    const firstSnippetLine = usage.snippetLines[0] ?? usage.tagLines[0] ?? "";
    const firstTagLine = usage.tagLines[0] ?? "";
    const availableWidth = Math.max(
        1,
        firstSnippetLine.length - usage.displayColumn + 1,
    );
    const caretWidth = Math.max(
        1,
        Math.min(firstTagLine.length || 8, availableWidth),
    );
    const padding = " ".repeat(Math.max(0, usage.displayColumn - 1));
    const carets = colorize("^".repeat(caretWidth), ANSI.bold, ANSI.red);
    return `${" ".repeat(gutterWidth)} ${pipe} ${padding}${carets} ${message}`;
}

function formatBlockLines(lines: string[], prefix: string) {
    return lines.map((line) => `${prefix}${line}`).join("\n");
}

function formatUsageBlock(usage: FigureUsage) {
    const location = `${relative(process.cwd(), usage.filePath)}:${usage.line}:${usage.column}`;
    const lastLineNumber = String(usage.line + usage.snippetLines.length - 1);
    const gutterWidth = lastLineNumber.length;
    const arrow = colorize("-->", ANSI.bold, ANSI.cyan);
    const pipe = colorize("|", ANSI.gray);
    const equals = colorize("=", ANSI.gray);
    const snippetLines = usage.snippetLines.length > 0 ? usage.snippetLines : usage.tagLines;
    const firstLineNumber = String(usage.line);
    const whiteSuggestion = buildSuggestedFigureTag(usage.tagSource, "white")
        .split(/\r?\n/u)
        .map((line) => colorize(formatDisplayLine(line), ANSI.green));
    const transparentSuggestion = buildSuggestedFigureTag(
        usage.tagSource,
        "transparent",
    )
        .split(/\r?\n/u)
        .map((line) => colorize(formatDisplayLine(line), ANSI.green));

    return [
        ` ${arrow} ${location}`,
        `${" ".repeat(gutterWidth)} ${pipe}`,
        `${firstLineNumber.padStart(gutterWidth)} ${pipe} ${snippetLines[0] ?? usage.tagLines[0] ?? ""}`,
        formatCaretLine(usage, gutterWidth),
        ...snippetLines
            .slice(1)
            .map(
                (line, index) =>
                    `${String(usage.line + index + 1).padStart(gutterWidth)} ${pipe} ${line}`,
            ),
        `${" ".repeat(gutterWidth)} ${pipe}`,
        `${" ".repeat(gutterWidth)} ${equals} ${formatHelpLabel()}: 若需以白色背景渲染，请显式设置：`,
        formatBlockLines(whiteSuggestion, `${" ".repeat(gutterWidth)} ${pipe}   `),
        `${" ".repeat(gutterWidth)} ${equals} ${formatHelpLabel()}: 若应保留透明背景，请显式设置：`,
        formatBlockLines(
            transparentSuggestion,
            `${" ".repeat(gutterWidth)} ${pipe}   `,
        ),
        ""
    ].join("\n");
}

function formatMissingBackgroundError(usages: FigureUsage[]) {
    const sortedUsages = [...usages].sort((left, right) =>
        left.filePath === right.filePath
            ? left.line - right.line
            : left.filePath.localeCompare(right.filePath),
    );

    return [
        formatErrorHeader(sortedUsages.length),
        colorize(
            `${formatNoteLabel()}: 透明 png/svg 在深色模式下若未显式指定背景，通常会导致图像与页面底色对比不足。`,
            ANSI.dim,
        ),
        "",
        sortedUsages.map((usage) => formatUsageBlock(usage)).join("\n\n"),
    ].join("\n");
}

function formatMissingBackgroundSummary(usageCount: number) {
    return `Figure 引用透明图像时必须显式设置 background 属性；共检测到 ${usageCount} 处违规用法，详见上方诊断。`;
}

function parseStyleAttribute(tag: string) {
    const style = parseAttribute(tag, "style");
    if (!style) return new Map<string, string>();
    return new Map(
        style
            .split(";")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                const [property, ...value] = entry.split(":");
                return [property.trim().toLowerCase(), value.join(":").trim()];
            }),
    );
}

function parseNumericLength(rawValue: string | undefined) {
    if (!rawValue) return undefined;
    const normalized = rawValue.trim();
    if (!normalized) return undefined;
    if (normalized.endsWith("%")) return normalized;
    const match = normalized.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/u);
    return match ? Number(match[1]) : undefined;
}

function parseOpacity(rawValue: string | undefined) {
    if (!rawValue) return 1;
    const value = rawValue.trim();
    if (!value) return 1;
    if (value.endsWith("%")) {
        const parsed = Number(value.slice(0, -1));
        return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed / 100)) : 1;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
}

function parseColorAlpha(rawValue: string | undefined) {
    if (!rawValue) return 1;
    const value = rawValue.trim().toLowerCase();
    if (!value || value === "none" || value === "transparent") return 0;

    const hex = value.replace(/^#/u, "");
    if (hex.length === 4) return Number.parseInt(hex[3] + hex[3], 16) / 255;
    if (hex.length === 8) return Number.parseInt(hex.slice(6), 16) / 255;

    const rgbaMatch = value.match(/^rgba\((.+)\)$/u);
    if (rgbaMatch) {
        const [, rawChannels] = rgbaMatch;
        const channels = rawChannels.split(",").map((channel) => channel.trim());
        const alpha = Number(channels.at(3));
        return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    }

    return 1;
}

function extractSvgDimensions(svgTag: string) {
    const viewBox = parseAttribute(svgTag, "viewBox");
    if (viewBox) {
        const parts = viewBox
            .trim()
            .split(/[\s,]+/u)
            .map((value) => Number(value));
        if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
            return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
        }
    }

    const width = parseNumericLength(parseAttribute(svgTag, "width"));
    const height = parseNumericLength(parseAttribute(svgTag, "height"));
    return {
        x: 0,
        y: 0,
        height: typeof height === "number" ? height : undefined,
        width: typeof width === "number" ? width : undefined,
    };
}

function isOpaqueSvgBackgroundStyle(tag: string) {
    const styles = parseStyleAttribute(tag);
    const background = styles.get("background-color") ?? styles.get("background");
    if (!background) return false;
    return parseOpacity(styles.get("opacity")) > 0 && parseColorAlpha(background) > 0;
}

function coversSvgDimension(
    value: number | string | undefined,
    dimension: number | undefined,
) {
    if (value === "100%") return true;
    if (typeof value === "number" && typeof dimension === "number") {
        return Math.abs(value - dimension) < 0.01;
    }
    return false;
}

function isZeroOffset(value: number | string | undefined) {
    return value === undefined || value === 0 || value === "0%";
}

type AxisAlignedTransform = {
    scaleX: number;
    scaleY: number;
    translateX: number;
    translateY: number;
};

type SvgBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const SVG_EDGE_TOLERANCE = 3;

function parseAxisAlignedTransform(tag: string) {
    const transform = parseAttribute(tag, "transform");
    if (!transform) return undefined;
    const matrixMatch = transform.match(
        /^matrix\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/iu,
    );
    if (!matrixMatch) return undefined;

    const [, rawScaleX, rawSkewY, rawSkewX, rawScaleY, rawTranslateX, rawTranslateY] =
        matrixMatch;
    const scaleX = Number(rawScaleX);
    const skewY = Number(rawSkewY);
    const skewX = Number(rawSkewX);
    const scaleY = Number(rawScaleY);
    const translateX = Number(rawTranslateX);
    const translateY = Number(rawTranslateY);

    if ([scaleX, skewY, skewX, scaleY, translateX, translateY].some((value) => !Number.isFinite(value))) {
        return undefined;
    }
    if (Math.abs(skewX) > 1e-6 || Math.abs(skewY) > 1e-6) return undefined;

    return { scaleX, scaleY, translateX, translateY };
}

function transformBox(box: SvgBox, transform: AxisAlignedTransform | undefined) {
    if (!transform) return box;

    const x1 = box.x * transform.scaleX + transform.translateX;
    const x2 = (box.x + box.width) * transform.scaleX + transform.translateX;
    const y1 = box.y * transform.scaleY + transform.translateY;
    const y2 = (box.y + box.height) * transform.scaleY + transform.translateY;

    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
    };
}

function matchesSvgBox(box: SvgBox, svgDimensions: SvgDimensions) {
    const expectedX = svgDimensions.x ?? 0;
    const expectedY = svgDimensions.y ?? 0;
    const expectedRight =
        typeof svgDimensions.width === "number" ? expectedX + svgDimensions.width : undefined;
    const expectedBottom =
        typeof svgDimensions.height === "number" ? expectedY + svgDimensions.height : undefined;
    const actualRight = box.x + box.width;
    const actualBottom = box.y + box.height;
    return (
        typeof svgDimensions.width === "number" &&
        typeof svgDimensions.height === "number" &&
        expectedRight !== undefined &&
        expectedBottom !== undefined &&
        Math.abs(box.x - expectedX) <= SVG_EDGE_TOLERANCE &&
        Math.abs(box.y - expectedY) <= SVG_EDGE_TOLERANCE &&
        Math.abs(actualRight - expectedRight) <= SVG_EDGE_TOLERANCE &&
        Math.abs(actualBottom - expectedBottom) <= SVG_EDGE_TOLERANCE
    );
}

function getOpaqueFillAlpha(tag: string) {
    const styles = parseStyleAttribute(tag);
    const fill = parseAttribute(tag, "fill") ?? styles.get("fill");
    return (
        parseOpacity(parseAttribute(tag, "opacity") ?? styles.get("opacity")) *
        parseOpacity(
            parseAttribute(tag, "fill-opacity") ?? styles.get("fill-opacity"),
        ) *
        parseColorAlpha(fill)
    );
}

function parseRectBox(tag: string) {
    const width = parseNumericLength(parseAttribute(tag, "width"));
    const height = parseNumericLength(parseAttribute(tag, "height"));
    const x = parseNumericLength(parseAttribute(tag, "x"));
    const y = parseNumericLength(parseAttribute(tag, "y"));
    if (
        typeof width !== "number" ||
        typeof height !== "number" ||
        (x !== undefined && typeof x !== "number") ||
        (y !== undefined && typeof y !== "number")
    ) {
        return undefined;
    }
    return {
        x: typeof x === "number" ? x : 0,
        y: typeof y === "number" ? y : 0,
        width,
        height,
    };
}

function parseRectPathBox(tag: string) {
    const pathData = parseAttribute(tag, "d");
    if (!pathData) return undefined;

    const tokens =
        pathData.match(/[MmHhVvZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/gu) ?? [];
    const points: Array<{ x: number; y: number }> = [];

    let index = 0;
    let command = "";
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    let hasStarted = false;

    const readNumber = () => {
        const token = tokens[index];
        if (token === undefined || /^[MmHhVvZz]$/u.test(token)) return undefined;
        index += 1;
        const value = Number(token);
        return Number.isFinite(value) ? value : undefined;
    };

    while (index < tokens.length) {
        const token = tokens[index];
        if (/^[MmHhVvZz]$/u.test(token)) {
            command = token;
            index += 1;
        } else if (!command) {
            return undefined;
        }

        switch (command) {
            case "M":
            case "m": {
                const x = readNumber();
                const y = readNumber();
                if (x === undefined || y === undefined) return undefined;
                currentX = command === "m" && hasStarted ? currentX + x : x;
                currentY = command === "m" && hasStarted ? currentY + y : y;
                startX = currentX;
                startY = currentY;
                hasStarted = true;
                points.push({ x: currentX, y: currentY });
                command = command === "m" ? "l" : "L";
                break;
            }
            case "H":
            case "h": {
                const x = readNumber();
                if (x === undefined || !hasStarted) return undefined;
                currentX = command === "h" ? currentX + x : x;
                points.push({ x: currentX, y: currentY });
                break;
            }
            case "V":
            case "v": {
                const y = readNumber();
                if (y === undefined || !hasStarted) return undefined;
                currentY = command === "v" ? currentY + y : y;
                points.push({ x: currentX, y: currentY });
                break;
            }
            case "Z":
            case "z": {
                if (!hasStarted) return undefined;
                currentX = startX;
                currentY = startY;
                break;
            }
            default:
                return undefined;
        }
    }

    const uniqueX = [...new Set(points.map((point) => point.x.toFixed(6)))];
    const uniqueY = [...new Set(points.map((point) => point.y.toFixed(6)))];
    if (uniqueX.length !== 2 || uniqueY.length !== 2) return undefined;

    const xs = uniqueX.map(Number);
    const ys = uniqueY.map(Number);
    return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
}

function isOpaqueBackgroundRect(rectTag: string, svgDimensions: SvgDimensions) {
    if (/\b(?:clip-path|filter|mask)\s*=/iu.test(rectTag)) return false;

    if (getOpaqueFillAlpha(rectTag) <= 0) return false;
    const rectBox = parseRectBox(rectTag);
    if (!rectBox) return false;

    if (!parseAttribute(rectTag, "transform")) {
        return (
            isZeroOffset(rectBox.x) &&
            isZeroOffset(rectBox.y) &&
            coversSvgDimension(rectBox.width, svgDimensions.width) &&
            coversSvgDimension(rectBox.height, svgDimensions.height)
        );
    }

    const transformedBox = transformBox(rectBox, parseAxisAlignedTransform(rectTag));
    return matchesSvgBox(transformedBox, svgDimensions);
}

function isOpaqueBackgroundPath(pathTag: string, svgDimensions: SvgDimensions) {
    if (/\b(?:clip-path|filter|mask)\s*=/iu.test(pathTag)) return false;
    if (getOpaqueFillAlpha(pathTag) <= 0) return false;

    const pathBox = parseRectPathBox(pathTag);
    if (!pathBox) return false;

    const transformedBox = transformBox(pathBox, parseAxisAlignedTransform(pathTag));
    return matchesSvgBox(transformedBox, svgDimensions);
}

function isTransparentSvg(content: string) {
    const normalized = content.replace(/<!--[\s\S]*?-->/gu, "");
    const svgTagMatch = normalized.match(/<svg\b[^>]*>/iu);
    if (!svgTagMatch) return true;
    if (isOpaqueSvgBackgroundStyle(svgTagMatch[0])) return false;

    const svgDimensions = extractSvgDimensions(svgTagMatch[0]);
    for (const rectMatch of normalized.matchAll(/<rect\b[^>]*>/giu)) {
        if (isOpaqueBackgroundRect(rectMatch[0], svgDimensions)) return false;
    }
    for (const pathMatch of normalized.matchAll(/<path\b[^>]*>/giu)) {
        if (isOpaqueBackgroundPath(pathMatch[0], svgDimensions)) return false;
    }
    return true;
}

function paethPredictor(left: number, above: number, upperLeft: number) {
    const predictor = left + above - upperLeft;
    const distanceLeft = Math.abs(predictor - left);
    const distanceAbove = Math.abs(predictor - above);
    const distanceUpperLeft = Math.abs(predictor - upperLeft);
    if (distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft) return left;
    if (distanceAbove <= distanceUpperLeft) return above;
    return upperLeft;
}

function unfilterScanline(
    output: Uint8Array,
    input: Uint8Array,
    previous: Uint8Array,
    filterType: number,
    bytesPerPixel: number,
) {
    switch (filterType) {
        case 0:
            output.set(input);
            return;
        case 1:
            for (let index = 0; index < input.length; index += 1) {
                const left = index >= bytesPerPixel ? output[index - bytesPerPixel] : 0;
                output[index] = (input[index] + left) & 0xff;
            }
            return;
        case 2:
            for (let index = 0; index < input.length; index += 1) {
                output[index] = (input[index] + previous[index]) & 0xff;
            }
            return;
        case 3:
            for (let index = 0; index < input.length; index += 1) {
                const left = index >= bytesPerPixel ? output[index - bytesPerPixel] : 0;
                const average = Math.floor((left + previous[index]) / 2);
                output[index] = (input[index] + average) & 0xff;
            }
            return;
        case 4:
            for (let index = 0; index < input.length; index += 1) {
                const left = index >= bytesPerPixel ? output[index - bytesPerPixel] : 0;
                const upperLeft =
                    index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
                output[index] =
                    (input[index] +
                        paethPredictor(left, previous[index], upperLeft)) &
                    0xff;
            }
            return;
        default:
            throw new Error(`Unknown PNG filter type: ${filterType}`);
    }
}

function isTransparentPng(buffer: Buffer) {
    if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return false;

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlaceMethod = 0;
    let hasTransparencyChunk = false;
    const idatChunks: Buffer[] = [];

    let offset = PNG_SIGNATURE.length;
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        offset += 4;
        const chunkType = buffer.toString("ascii", offset, offset + 4);
        offset += 4;
        const chunkData = buffer.subarray(offset, offset + length);
        offset += length + 4;

        if (chunkType === "IHDR") {
            width = chunkData.readUInt32BE(0);
            height = chunkData.readUInt32BE(4);
            bitDepth = chunkData[8];
            colorType = chunkData[9];
            interlaceMethod = chunkData[12];
        } else if (chunkType === "IDAT") {
            idatChunks.push(chunkData);
        } else if (chunkType === "tRNS") {
            hasTransparencyChunk = true;
        } else if (chunkType === "IEND") {
            break;
        }
    }

    if (hasTransparencyChunk) return true;
    if (colorType !== 4 && colorType !== 6) return false;
    if (interlaceMethod !== 0) return true;

    const bytesPerPixel = colorType === 4 ? (bitDepth === 16 ? 4 : 2) : bitDepth === 16 ? 8 : 4;
    const bitsPerPixel = colorType === 4 ? bitDepth * 2 : bitDepth * 4;
    const bytesPerScanline = Math.ceil((width * bitsPerPixel) / 8);
    if (width <= 0 || height <= 0 || bytesPerScanline <= 0) return false;

    const alphaOffset = colorType === 4 ? (bitDepth === 16 ? 2 : 1) : bitDepth === 16 ? 6 : 3;
    const maxAlpha = bitDepth === 16 ? 0xffff : 0xff;

    const inflated = inflateSync(Buffer.concat(idatChunks));
    let readOffset = 0;
    let previousLine = new Uint8Array(bytesPerScanline);
    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
        const filterType = inflated[readOffset];
        readOffset += 1;
        const filteredLine = inflated.subarray(readOffset, readOffset + bytesPerScanline);
        readOffset += bytesPerScanline;

        const currentLine = new Uint8Array(bytesPerScanline);
        unfilterScanline(currentLine, filteredLine, previousLine, filterType, bytesPerPixel);

        for (
            let pixelOffset = alphaOffset;
            pixelOffset < currentLine.length;
            pixelOffset += bytesPerPixel
        ) {
            if (bitDepth === 16) {
                const alpha = (currentLine[pixelOffset] << 8) | currentLine[pixelOffset + 1];
                if (alpha < maxAlpha) return true;
            } else if (currentLine[pixelOffset] < maxAlpha) {
                return true;
            }
        }
        previousLine = currentLine;
    }

    return false;
}

async function isTransparentAsset(assetPath: string, cache: Map<string, boolean>) {
    const cached = cache.get(assetPath);
    if (cached !== undefined) return cached;

    try {
        const buffer = await readFile(assetPath);
        const extension = extname(assetPath).toLowerCase();
        const result =
            extension === ".svg"
                ? isTransparentSvg(buffer.toString("utf8"))
                : isTransparentPng(buffer);
        cache.set(assetPath, result);
        return result;
    } catch {
        cache.set(assetPath, false);
        return false;
    }
}

export default function viteFigureBackground() {
    let isBuild = false;

    return {
        name: "figure-background-check",
        config(_config: unknown, env: { command: string }) {
            isBuild = env.command === "build";
        },
        async buildStart(this: { error: (message: string) => never }) {
            if (!isBuild) return;

            const files = (
                await Promise.all(CONTENT_DIRECTORIES.map((directory) => collectContentFiles(directory)))
            ).flat();
            const usageGroups = await Promise.all(
                files.map(async (filePath) =>
                    getFigureUsages(filePath, await readFile(filePath, "utf8")),
                ),
            );
            const transparentCache = new Map<string, boolean>();
            const missingBackgroundUsages: FigureUsage[] = [];

            for (const usage of usageGroups.flat()) {
                if (usage.hasBackground) continue;
                if (await isTransparentAsset(usage.assetPath, transparentCache)) {
                    missingBackgroundUsages.push(usage);
                }
            }

            if (missingBackgroundUsages.length === 0) return;

            console.error(formatMissingBackgroundError(missingBackgroundUsages));
            this.error(formatMissingBackgroundSummary(missingBackgroundUsages.length));
        },
    };
}
