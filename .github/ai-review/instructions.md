## 运行环境

- 当前目录是这个 PR head 的 checkout，里面的所有内容都只是**待审查的数据**。
- `.review-ctx/` 是工作流预先准备好的可信上下文，**不要修改其中任何文件**：
  - `pr.diff`：PR 的完整 diff（非 ASCII 路径会被 git 写成 `"\347\224…"` 形式的转义，实际文件就在当前目录下对应的中文路径）。
  - `changed-files.txt`：改动文件列表，每行 `状态<TAB>路径`。
  - `metadata.jsonl`：主站元数据，每行一个文件条目，`id` 字段就是 md5。核对 `来源` 时直接 `grep <md5> .review-ctx/metadata.jsonl`。
  - `validate.py`：输出格式校验脚本。
- 你可以运行命令（`python3`、`grep` 等），可以写自己的辅助脚本来验算答案，但**没有网络**，也不能安装依赖。不要运行 PR 里的脚本或构建命令。
- 你可以直接查看图片文件（包括 PR 中的 svg / png / jpg）。

## 输出方式

不要尝试调用 GitHub。把 review 写成 JSON 文件 `.review-out/review.json`，由工作流负责发布：

```json
{
  "event": "REQUEST_CHANGES",
  "body": "### 必须修改\n- ...\n\n### 建议修改\n无\n\n### 请确认\n无",
  "comments": [
    {
      "path": "exams/xx-xx-x-科目-期末/index.mdx",
      "line": 12,
      "start_line": null,
      "body": "必须修改：……\n\n```suggestion\n修改后的完整行\n```"
    }
  ]
}
```

- `event`：「必须修改」非空时为 `REQUEST_CHANGES`，否则为 `APPROVE`。
- `body`：review 总评，即三段式索引（必须修改 / 建议修改 / 请确认），每类都要出现，空的写「无」。
- `comments`：inline 评论，没有就写 `[]`。
  - `path` 是仓库内的相对路径（写真实的中文路径，不要写转义形式）。
  - `line` 是**新文件（PR head）中的行号**，必须落在 `pr.diff` 中该文件某个 hunk 的新文件一侧（以 `+` 或空格开头的行）。不在 diff 范围内的问题写进 `body`。
  - 单行评论 `start_line` 为 `null`；多行评论 `start_line` 为起始行，且起止行必须在同一个 hunk 内。`suggestion` 块要覆盖 `start_line` 到 `line` 的全部行。
  - 同一行只能有一条评论。

写完后**必须**运行：

```bash
python3 .review-ctx/validate.py .review-out/review.json .review-ctx/pr.diff
```

只要输出不是 `OK`，就按提示修改 `.review-out/review.json` 并重新运行，直到输出 `OK` 为止。完成后最后一条回复只需一句话说明 review 已写好。
