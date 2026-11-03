#!/usr/bin/env python3
"""校验 AI review 的输出 JSON。

用法：python3 validate.py <review.json> <pr.diff>

review.json 的格式：
{
  "event": "APPROVE" | "COMMENT" | "REQUEST_CHANGES",
  "body": "总评（markdown）",
  "comments": [
    {"path": "仓库内相对路径", "line": 12, "start_line": null, "body": "inline 评论（markdown）"}
  ]
}

inline 评论的 line / start_line 是新文件（PR head）中的行号，必须落在 diff 里同一个
hunk 的新文件一侧，否则 GitHub 会拒绝整个 review。通过时输出 OK，否则逐条列出错误并
以 1 退出。只用标准库：review job 和发布 job 都会运行它。
"""

import json
import re
import sys

EVENTS = {"APPROVE", "COMMENT", "REQUEST_CHANGES"}
MAX_BODY = 60000
MAX_COMMENTS = 100
HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
ESCAPES = {"n": b"\n", "t": b"\t", '"': b'"', "\\": b"\\", "a": b"\a", "b": b"\b", "f": b"\f", "r": b"\r", "v": b"\v"}


def unquote_git_path(raw):
    """还原 git 的 C 风格引号路径，例如 "b/exams/\\347\\224\\265/index.mdx"。"""
    if not (raw.startswith('"') and raw.endswith('"')):
        return raw
    s = raw[1:-1]
    out = bytearray()
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "\\" and i + 1 < len(s):
            nxt = s[i + 1]
            if nxt in "01234567" and re.fullmatch(r"[0-7]{3}", s[i + 1 : i + 4]):
                out.append(int(s[i + 1 : i + 4], 8))
                i += 4
                continue
            if nxt in ESCAPES:
                out += ESCAPES[nxt]
                i += 2
                continue
        out += ch.encode("utf-8")
        i += 1
    return out.decode("utf-8", errors="replace")


def parse_diff(text):
    """返回 {path: {新文件行号: hunk 序号}}，只包含新文件一侧可以评论的行。"""
    files = {}
    current = None
    new_line = None
    hunk = 0
    for line in text.splitlines():
        if line.startswith("diff --git "):
            current, new_line = None, None
        elif line.startswith("+++ "):
            target = line[4:].rstrip("\t")
            if target == "/dev/null":
                current = None
            else:
                path = unquote_git_path(target)
                current = path[2:] if path.startswith("b/") else path
                files.setdefault(current, {})
            new_line = None
        elif line.startswith("@@"):
            m = HUNK_RE.match(line)
            new_line = int(m.group(1)) if (m and current is not None) else None
            hunk += 1
        elif current is not None and new_line is not None:
            if line.startswith("+") or line.startswith(" ") or line == "":
                files[current][new_line] = hunk
                new_line += 1
            elif line.startswith("-") or line.startswith("\\"):
                pass
            else:
                new_line = None
    return files


def validate(review, diff_files):
    errors = []
    if not isinstance(review, dict):
        return ["顶层必须是 JSON 对象"]
    extra = set(review) - {"event", "body", "comments"}
    if extra:
        errors.append(f"顶层有多余字段：{sorted(extra)}（只允许 event / body / comments）")

    if review.get("event") not in EVENTS:
        errors.append(f"event 必须是 {sorted(EVENTS)} 之一，当前是 {review.get('event')!r}")

    body = review.get("body")
    if not isinstance(body, str) or not body.strip():
        errors.append("body 必须是非空字符串")
    elif len(body) > MAX_BODY:
        errors.append(f"body 太长（{len(body)} 字符，上限 {MAX_BODY}）")

    comments = review.get("comments")
    if not isinstance(comments, list):
        return errors + ["comments 必须是数组（没有 inline 评论时写 []）"]
    if len(comments) > MAX_COMMENTS:
        errors.append(f"comments 太多（{len(comments)} 条，上限 {MAX_COMMENTS}），请合并或把次要问题写进 body")

    seen_lines = {}
    for i, c in enumerate(comments):
        where = f"comments[{i}]"
        if not isinstance(c, dict):
            errors.append(f"{where} 必须是对象")
            continue
        extra = set(c) - {"path", "line", "start_line", "body"}
        if extra:
            errors.append(f"{where} 有多余字段：{sorted(extra)}（只允许 path / line / start_line / body）")
        path, line, start = c.get("path"), c.get("line"), c.get("start_line")
        cbody = c.get("body")
        if not isinstance(cbody, str) or not cbody.strip():
            errors.append(f"{where}.body 必须是非空字符串")
        elif len(cbody) > MAX_BODY:
            errors.append(f"{where}.body 太长")
        if not isinstance(path, str) or path not in diff_files:
            errors.append(f"{where}.path={path!r} 不是本 PR 中有文本改动的文件；可评论的文件：{sorted(diff_files)}")
            continue
        lines = diff_files[path]
        if not isinstance(line, int) or isinstance(line, bool):
            errors.append(f"{where}.line 必须是整数")
            continue
        if line not in lines:
            errors.append(f"{where}: {path} 第 {line} 行不在 diff 的改动范围内（只能评论 diff 中新文件一侧出现的行）")
            continue
        if start is not None:
            if not isinstance(start, int) or isinstance(start, bool):
                errors.append(f"{where}.start_line 必须是整数或 null")
                continue
            if start >= line:
                errors.append(f"{where}: start_line({start}) 必须小于 line({line})；单行评论请把 start_line 设为 null")
                continue
            if start not in lines or lines[start] != lines[line]:
                errors.append(f"{where}: {path} 第 {start}-{line} 行不在 diff 的同一个 hunk 里，多行评论必须在同一个 hunk 内")
                continue
        key = (path, line)
        if key in seen_lines:
            errors.append(f"{where} 与 comments[{seen_lines[key]}] 评论的是同一行（{path}:{line}），请合并成一条")
        seen_lines[key] = i
    return errors


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            review = json.load(f)
    except (OSError, ValueError) as e:
        print(f"无法读取或解析 {sys.argv[1]}：{e}")
        return 1
    with open(sys.argv[2], encoding="utf-8", errors="replace") as f:
        diff_files = parse_diff(f.read())
    errors = validate(review, diff_files)
    if errors:
        print(f"发现 {len(errors)} 个问题：")
        for e in errors:
            print(f"- {e}")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
