# BYR Docs Wiki Tools

`BYR Docs Wiki Tools` 是一个专门为 `byrdocs-wiki` 工作区编写的 VS Code 扩展，用来优化试题页面的编辑、预览、创建与浏览流程。

它不是通用扩展。只有当前工作区根目录 `package.json` 中的 `name` 为 `byrdocs-wiki` 时，扩展功能才会启用。

## 快速开始

### 预览一个现有试卷

1. 打开一个 `exams/<name>/index.mdx`
2. 按 `Ctrl/Cmd + K V`
3. 左侧保留源码，右侧打开预览
4. 在源码和预览之间点击对应块进行定位

### 从侧边栏浏览试卷

1. 点击侧边栏 中的 `BYR Docs Wiki`
2. 在试卷列表中搜索或筛选
3. 点击任意试卷，直接打开源码与预览

### 创建新试卷

1. 打开 `BYR Docs Wiki` 侧边栏
2. 点击 `新建页面`
3. 填写表单
4. 点击 `创建并预览`

## 许可证

[MIT License](./LICENSE)
