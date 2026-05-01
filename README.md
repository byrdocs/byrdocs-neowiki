# BYR Docs 维基真题 (Neowiki)

本站收录北京邮电大学近年的期中、期末考试题，使用更友好的 MDX 编辑语言和更丰富的插件，将往年试题整理成易阅读、可交互的形式。

你可以在 [guide.mdx](./src/guide/index.mdx) 中看到我们的编辑规范，并在 [test.mdx](./src/test/index.mdx) 中查看自测题的源代码。

我们非常欢迎你为维基真题贡献自己的一份力量！

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
5. 对 [exams](./exams) 中的文件进行编辑，并在预览网站中使用与对应文件同名（不带 `.mdx`）的路径名访问对应试题页。
6. 确认编辑结果符合预期后，提交编辑，上传到你 fork 的仓库，并提出 pull request。
