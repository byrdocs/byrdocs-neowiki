# BYR Docs 维基真题 (Neowiki)

本站收录北京邮电大学近年的期中、期末考试题，使用更友好的 MDX 编辑语言和更丰富的插件，将往年试题整理成易阅读、可交互的形式。

我们非常欢迎你为维基真题贡献自己的一份力量！如需了解如何贡献及编辑规范，请阅读[编辑指南](https://wiki.byrdocs.org/guide/)。

## 许可证

本项目采用双许可证：

- `exams/` 目录下的试卷内容采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 授权。
- 其余代码采用 [MIT](./LICENSE) 授权。

## 如何贡献

1. [Fork 本仓库](https://github.com/byrdocs/byrdocs-neowiki/fork) 到你自己的 GitHub 账号下。
2. Clone 你的仓库到本地。
3. 安装必要依赖。
    ```
    pnpm i
    ```
4. 开启一个预览服务器。接下来，你可以在 http://localhost:4321 看到本网站的预览。
    ```
    pnpm dev
    ```
5. 对 `exams/` 中的文件进行编辑，并在预览网站中使用与对应文件同名（不带 `.mdx`）的路径名访问对应试题页。
6. 确认编辑结果符合预期后，提交编辑，上传到你 fork 的仓库，并提出 pull request。

### 建议编辑器

我们推荐使用 VS Code 并安装 [BYR Docs Wiki Tools](https://marketplace.visualstudio.com/items?itemName=byrdocs.byrdocs-wiki-vscode) 扩展，它能显著提升编辑体验：

- **实时预览**：打开一份 `exams/<name>/index.mdx`，按 `Ctrl/Cmd + K V` 即可在右侧打开预览面板，源码与预览之间支持点击定位。
- **试卷浏览**：侧边栏的「BYR Docs Wiki」面板可以搜索、筛选并快速打开任意试卷。
- **新建试卷**：在侧边栏点击「新建页面」，填写表单后即可自动创建试卷目录和模板文件。
