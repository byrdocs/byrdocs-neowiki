# 编辑与预览修复验证记录

验证日期：2026-10-03。

## 修复内容

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| 点击 `<Option correct={true}>` 或 `<Option correct="true">` 的正误提示 | 只删除 `correct`，留下赋值部分，MDX 无法编译 | 删除整个属性，保留合法标签及相邻属性 |
| 同一多根工作区先预览项目 A，再预览项目 B | 复用 A 的服务器，B 同名试卷显示 A 内容，B 独有试卷返回 404 | 关闭旧预览终端，在 B 中启动服务器并重新解析预览地址 |
| 在 VS Code 1.90 启动预览 | 调用受限制的 `terminalShellIntegration` 实验 API 时抛错，启动中断 | 捕获不可用的接口，使用现有 `Terminal.sendText` 回退流程启动 |

属性解析分别记录属性名结束位置和完整属性结束位置，避免扩大悬停及语义高亮范围。同一项目内的多份试卷仍复用已有预览服务器。

VS Code 1.90 中相关接口运行时存在，但调用受 proposed API 限制；只检查 `typeof ... === "function"` 不能避免错误。此次保留 `engines.vscode: ^1.90.0`，没有启用实验 API。

## 自动化回归测试

在仓库根目录执行：

```sh
cd vscode-extension
pnpm install --ignore-workspace --frozen-lockfile
pnpm test
```

12 项测试通过，覆盖：

- 裸属性、布尔表达式、单双引号字符串、空字符串和带空格的赋值；删除后保持相邻属性和选项正文，属性名范围不变。
- 同项目服务器复用，以及跨项目时关闭旧终端、切换工作目录、清理外部预览地址。
- 已有 shell integration、接口缺失、接口调用或属性访问被限制、非目标终端事件，以及超时后的监听器清理。

测试使用编译后的真实扩展模块，并替换 VS Code 宿主接口或服务器服务。`PR Checks` 已加入扩展依赖安装和回归测试。编译使用声明的 `@types/vscode` 开发依赖，不再依赖某台机器上的 VS Code 安装路径。

## 真实扩展宿主验证

环境：macOS 27.0.1 arm64，扩展 0.2.7 源码的修复前、修复后编译产物；独立用户配置、扩展目录和两个临时 Neowiki 项目。测试入口通过 `--extensionDevelopmentPath` 和 `--extensionTestsPath` 在真实 VS Code 中运行。

正误切换通过 `vscode.executeInlayHintProvider` 取得实际行内提示的命令并执行，再用 MDX 编译器检查修改后的文档。预览通过正式的 `byrdocsWiki.previewExamPage` 命令启动真实终端及 Astro。测试仅在面板更新后记录当前工作区和 iframe URL，再请求该 URL 核对内容；没有替换宿主 API 或 HTTP 服务。

### VS Code 1.128.0

- 修复前，两种带值的 `correct` 标签在切换后均编译失败；修复后均变成 `<Option>A</Option>` 并编译通过。裸属性的正常行为保持不变。
- A 的同名试卷返回 HTTP 200 和 A 内容。
- 切到 B 后，服务器从 A 的端口切到 B 的新端口，HTTP 200 返回 B 内容，不再出现 A 内容。
- B 独有试卷从修复前的 HTTP 404 变为 HTTP 200，返回 B 内容。

### VS Code 1.90.0

修复前预览报错：

```text
Extension 'byrdocs.byrdocs-wiki-vscode' CANNOT use API proposal: terminalShellIntegration.
Its package.json#enabledApiProposals-property declares: [] but NOT terminalShellIntegration.
```

修复后，在没有启用 proposed API 的同一个 1.90.0 宿主中：

- 预览成功进入 ready，A 的试卷返回 HTTP 200 和 A 内容。
- 切换到 B 后，同名试卷及 B 独有试卷均返回 HTTP 200 和 B 内容。
- 三种 `correct` 写法在切换后均保持合法 MDX，编译通过。

这同时验证了普通终端回退流程能实际启动服务器，而不仅是避免抛出异常。

## 网站检查

在仓库根目录执行 `WIKI_SITE_URL=https://wiki.byrdocs.org pnpm validate`：

- ESLint 通过。
- Astro check 检查 38 个文件，0 errors、0 warnings、0 hints。
- 完整构建成功，生成 228 个页面。构建仍有既有的 Shiki `SQL` 语言名称提示，回退到纯文本高亮，不影响构建。

验证只覆盖上述场景；没有声称覆盖所有操作系统、所有编辑器版本或所有 Markdown 写法。
