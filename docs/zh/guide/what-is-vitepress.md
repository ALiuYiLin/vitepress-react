---
description: vitepress-react 是 VitePress 的 React 实现：继承 VitePress 的内容优先工作流与默认主题，用 React 19 渲染正文与主题，并提供页面级样式隔离、可自定义的 Markdown 解析/渲染规则、组件级主题重写等能力。
---

# vitepress-react 是什么？ {#what-is-vitepress}

一句话：**vitepress-react 把 VitePress 的“内容优先”体验搬到了 React 生态**——用 Markdown 写内容，用 React 写交互与主题，产出静态 HTML，并在站点内提供 SPA 式的导航体验。

- 上游 [VitePress](https://vitepress.dev/) 用 Vue 3 渲染页面与主题；本项目用 **React 19** 重写了正文渲染与默认主题，配置项、路由、Markdown 扩展与默认主题语义尽量与上游保持一致；
- 你现在阅读的这个站点就是 vitepress-react 构建的；
- 它不是一个新发明的工作流，而是**同一套内容模型换一套渲染实现**——你写的还是 VitePress 风格的 `.md`，但正文与主题里的组件都是 React。

::: tip 只是想试试？
跳到[快速开始](./getting-started)（`vitepress-react init` 一条命令起站）。
:::

## 先说 VitePress {#why-vitepress}

选择"把 VitePress 做成 React 版"，是因为 VitePress 已经把"技术文档站"这件事打磨得很成熟：

- **内容优先**：Markdown 是唯一必需的语言。[默认主题](./extending-default-theme)开箱即带导航、侧边栏、大纲、本地搜索、上下页、编辑链接、主题切换、i18n；[`:::` 容器](./markdown#custom-containers)、代码高亮（Shiki）、[代码组](./markdown#code-groups)、[frontmatter](./frontmatter)、[attrs](./markdown#attributize)、[数据加载](./data-loading)、[动态路由](./routing#dynamic-routes) 都不需要自己攒。
- **开发体验**：Vite 驱动，秒级启动、编辑即时反映；改的是 Markdown，得到的是可部署的静态站点。
- **性能模型**：首屏是预渲染的静态 HTML（利于 SEO 与弱网），加载后变为 SPA——站内跳转不再整页刷新，并自动预取视口内链接。
- **生态与影响力**：Vue 生态的核心项目几乎都在用它——[Vue 3](https://vuejs.org/)、[Vue Router](https://router.vuejs.org/)、[Pinia](https://pinia.vuejs.org/)、[VueUse](https://vueuse.org/)；此外 [Vite](https://vite.dev/)、[Vitest](https://vitest.dev/)、[Rollup](https://rollupjs.org/)、[UnoCSS](https://unocss.dev/)、[Iconify](https://iconify.design/)、[Element Plus](https://element-plus.org/)、[Slidev](https://sli.dev/) 等文档站也都基于它（或其派生主题）。这意味着**语法、主题约定、社区经验、插件生态都是现成的**，用户不需要重新学习一套文档框架。

也正因为影响力足够大，"VitePress 的内容工作流 + React 的渲染与生态"这个组合才有价值：内容与配置可以照搬，团队却能在熟悉的 React 里写交互与主题。

## 为什么做成 React 版 {#why-react}

上游 VitePress 与 Vue 是深度绑定的：正文由 Vue 模板渲染、主题是 `.vue` 单文件组件、正文插值用 `{{ }}`、运行时依赖 Vue。对以 React 为主的团队，这意味着**要么在文档站里维护第二套框架心智，要么放弃 VitePress 的成熟体验**。

本项目选择第三条路：**保留 VitePress 的内容模型、配置语义与默认主题外观，把渲染层与主题层换成 React**：

| 层             | 上游 VitePress               | vitepress-react                              |
| -------------- | ---------------------------- | -------------------------------------------- |
| 内容           | `.md`（Markdown + 扩展语法） | 同左（`.md`，语法与语义尽量对齐）            |
| 正文渲染       | Markdown → Vue 模板          | Markdown → TSX 页面模块 → oxc → JavaScript   |
| 组件与交互     | Vue 组件、`{{ }}` 插值       | React 组件、`<>{expr}</>` / 组件标签         |
| 默认主题       | `.vue` 组件                  | `.tsx` 组件（可按组件粒度重写或整体替换）    |
| 样式隔离       | SFC `<style scoped>`         | `<style scoped>` / `*.scoped.css` + 选择器宏 |
| 构建、路由、SSR | Vite / VitePress 内核        | 同一套内核（Vite + 本项目实现的路由与 SSR）  |

这样迁移成本最低：**你不需要改 Markdown 与站点配置**，需要重写的只是"正文里嵌的组件"和"自定义主题"。

## 为什么不用 MDX {#why-not-mdx}

[MDX](https://mdxjs.com/) 是很优秀的方案，优点很明确：

- **Markdown 文档可以直接当 JSX 用**：`.mdx` 里可以 `import` 组件、用 `{expr}`、把 Markdown 内容当作 JSX children，写交互式文档非常顺手；
- 与 React 天然契合（毕竟它本身就是 JSX），remark/rehype 生态与各类构建集成都很成熟。

但它与"内容优先 + 可定制解析 + 开箱默认主题"这个目标有几处硬冲突：

| 关注点             | MDX 的实际情况                                                                                                                | 本项目需要的                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **自定义 Markdown 语法** | 解析走 micromark/remark 管线：`:::` 容器、代码组、`{#anchor}` 这类扩展必须自带插件；MDX 要求内容是**合法 JSX**，未知语法不会"退化成文本"，而是**直接报错打断构建** | 能自由增删 Markdown-It 插件、自定义 token 与序列化规则 |
| **编辑器 / 语言服务**   | `.mdx` 需要额外配置（编辑器 MDX 扩展、TS 插件、`mdx` 类型声明）才有补全与诊断；仓库里 `.md` / `.mdx` 混排时体验不一致         | `.md` 原地可用、零额外配置                             |
| **灵活性**             | "Markdown 如何变成 DOM"要穿过 micromark → mdast → hast → JSX 多层；正文与组件的边界模糊，一页既像文档又像代码                  | 精确控制"哪些是 Markdown、哪些交给 React"              |
| **迁移成本**           | 现有 VitePress 语法、容器、主题约定需要改写                                                                                   | 直接继承 VitePress 语法与默认主题                      |
| **错误面**             | 少一个 import、漏转义一个 `<`，整页编译失败                                                                                   | 正文默认静态序列化，只有显式 JSX 区域才参与编译        |

一句话总结：**MDX 把 Markdown 变成"带文档外观的代码"；本项目反过来，把 Markdown 保持为文档，只在你显式划出的地方（`<>{expr}</>`、组件标签、`::: react`）交给 React**。对"文档为主、交互为辅"的站点，后者的可预测性、容错性与迁移成本都更好。

## vitepress-react 现在提供了什么 {#features}

- **继承 VitePress 的绝大多数能力**：默认主题（导航 / 侧边栏 / 大纲 / 本地搜索 / 上下页 / 编辑链接 / 主题切换 / i18n）、[Markdown 扩展](./markdown)（容器、代码组、Shiki 高亮、行高亮、[attrs 加类/id](./using-react)、frontmatter、emoji、脚注…）、[数据加载](./data-loading)、[动态路由](./routing#dynamic-routes)、静态生成与 SSR、[sitemap](./sitemap-generation)。
- **可以在 Markdown 里写 React**：`<script>` 里 `import` 或定义组件、使用页面作用域 hooks（`useState` 等合法），正文用组件标签与 `<>{expr}</>` 嵌入交互；规则见[在 Markdown 中使用 React](./using-react)。
- **页面级样式隔离**：`<style scoped>` 内联块与 `*.scoped.css` 外部导入，编译期注入 `data-v-{hash}`，并支持 `:global()` / `:deep()` 选择器宏；用法见 [md 页面 scoped 样式](./md-scoped-demo)。
- **可自定义 Markdown 解析与渲染规则**：Markdown-It 插件、token 级接管规则、HTML→JSX 序列化都在本项目内实现，你可以按需增删（自定义容器、自定义注解语法、图标语法、自定义标题锚点等），而不是被锁死在固定管线里。
- **主题可按组件粒度重写，也能整体替换**：`extends` 默认主题后覆盖任意组件（`VPNavBar`、`VPFooter`、`VPSidebar`…）或只改样式（含逐组件替换 scoped css），也可以从零写 `Layout` 完全自定义；见[扩展默认主题](./extending-default-theme)与[自定义主题](./custom-theme)。
- **React 生态直连**：正文与主题就是 React 组件，表单、图表、状态库、UI 库可以直接用；构建期仍是 Vite，Vite 插件生态同样可用。
- **SSR 与水合友好**：每个 Markdown 页面先编译为 TSX 页面模块，静态部分在编译期序列化，动态部分只承担自身水合成本；SSR 注意事项见 [SSR 兼容性](./ssr-compat)。

## 与 VuePress / 上游 VitePress 的关系 {#what-about-vuepress}

VitePress 灵感来源于 VuePress（基于 Vue 的静态站点生成器）。**本仓库是 VitePress 的 React 实现（独立重写，不是上游分支）**：构建、路由、默认主题与正文渲染均为 React 实现，配置项与文档沿用上游语义。需要 Vue 语法与组件的地方——`{{ }}` 插值、`.vue` 组件、Vue 指令（`v-if`、`:prop`、`@click`）——不再适用，请参考[在 Markdown 中使用 React](./using-react) 的规则。

## 目前不适用 / 尚未覆盖 {#limitations}

- **不接受 Vue 语法**：`.vue` 组件、`{{ }}` 插值、Vue 指令、Vue 生态的主题与插件需要按 React 重写；
- **上游 Vue 专用插件不通用**：依赖 Vue 运行时或 `.vue` SFC 的第三方插件/主题需要移植；
- **仍在 alpha**：API 与默认主题细节可能调整，升级前请留意更新日志。

::: tip 接下来读什么？
- [快速开始](./getting-started)：安装、`init` 脚手架、目录结构
- [在 Markdown 中使用 React](./using-react)：`<script>`、组件、`<>{expr}</>`、`::: react` 容器
- [自定义主题](./custom-theme)：从零写一个 React 主题
:::
