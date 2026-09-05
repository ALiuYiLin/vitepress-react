---
description: VitePress 是一个专为构建快速、以内容为中心的网站而设计的静态站点生成器，由 Vite 和 React 驱动。
---

# VitePress 是什么？ {#what-is-vitepress}

VitePress 是一个[静态站点生成器](https://en.wikipedia.org/wiki/Static_site_generator) (SSG)，专为构建快速、以内容为中心的站点而设计。简而言之，VitePress 获取用 Markdown 编写的内容，对其应用主题，并生成可以轻松部署到任何地方的静态 HTML 页面。

::: tip {no-title}
只是想尝试一下？跳到[快速开始](./getting-started)。
:::

## 使用场景 {#use-cases}

- **文档**

  VitePress 附带一个专为技术文档设计的默认主题。你现在正在阅读的这个页面，以及 [Vite](https://vite.dev/)、[Rollup](https://rollupjs.org/)、[Pinia](https://pinia.vuejs.org/)、[VueUse](https://vueuse.org/)、[Vitest](https://vitest.dev/)、[D3](https://d3js.org/)、[UnoCSS](https://unocss.dev/)、[Iconify](https://iconify.design/) 等文档都是基于该主题（或其派生主题）构建的。

- **博客、档案和营销网站**

  VitePress 支持[完全的自定义主题](./custom-theme)，具有标准 Vite + React 应用程序的开发体验。基于 Vite 构建还意味着可以直接利用其生态系统中丰富的 Vite 插件。此外，VitePress 提供了灵活的 API 来[加载数据](./data-loading)（本地或远程），也可以[动态生成路由](./routing#dynamic-routes)。只要可以在构建时确定数据，就可以使用它来构建几乎任何东西。

## 开发体验 {#developer-experience}

VitePress 旨在使用 Markdown 生成内容时提供出色的开发体验。

- **[Vite 驱动](https://cn.vite.dev/)**：即时服务器启动，始终立即反映 (<100ms) 编辑变化，无需重新加载页面。

- **[内置 Markdown 扩展](./markdown)**：frontmatter、表格、语法高亮……应有尽有。具体来说，VitePress 提供了许多用于处理代码块的高级功能，使其真正成为技术文档的理想选择。

- **[React 增强的 Markdown](./using-react)**：Markdown 被编译为静态 HTML 并经 JSX 序列化。可以用 `<script>` 块编写 React 组件 / 页面作用域状态（hooks 合法），在正文中用组件标签或 `{expr}` 嵌入交互性；页面级 scoped 样式见 [md 页面 scoped 样式](./md-scoped-demo)。

## 性能 {#performance}

与许多传统的 SSG 不同，每次导航都会导致页面完全重新加载，VitePress 生成的网站在初次访问时提供静态 HTML，但它会变成[单页应用程序](https://en.wikipedia.org/wiki/Single-page_application)（SPA）以进行站点内的后续导航。我们认为，这种模式为性能提供了最佳平衡：

- **快速的初始加载**

  对任何页面的初次访问都将会是静态的、预呈现的 HTML，以实现极快的加载速度和最佳的 SEO。然后页面加载一个 JavaScript bundle，将页面变成 React SPA（这被称为“水合”）。得益于 React 19 的流式水合与自动 JSX runtime 优化，这一过程非常快。在 [PageSpeed Insights](https://pagespeed.web.dev/report?url=https%3A%2F%2Fvitepress.dev%2F) 上，典型的 VitePress 站点即使在网络速度较慢的低端移动设备上也能获得近乎完美的性能分数。

- **加载完成后可以快速切换**

  更重要的是，SPA 模型在首次加载后能够提升用户体验。用户在站点内导航时，不会再触发整个页面的刷新。而是通过获取并动态更新页面的内容来实现切换。VitePress 还会自动预加载视口范围内链接对应的页面片段。这样一来，大部分情况下，用户在加载完成后就能立即浏览新页面。

- **高效的交互**

  为了在静态 Markdown 中嵌入动态 React 内容，每个 Markdown 页面都会先被编译为 TSX 页面模块，再交给 oxc 转成 JavaScript。页面正文的静态部分在编译期即被序列化，动态部分（表达式、组件）只承担其自身的水合成本，从而最小化激活开销与有效负载。

## 与 VuePress / 上游 VitePress 的关系 {#what-about-vuepress}

VitePress 灵感来源于 VuePress（一个基于 Vue 的静态站点生成器）。**本仓库是 VitePress 的 React 移植版**：构建/路由/默认主题/正文渲染均为 React 实现，配置项与文档沿用上游语义；需要 Vue 语法与组件的地方（如部分历史文档、`{{ }}` 插值、`.vue` 组件）不再适用，请参考[在 Markdown 中使用 React](./using-react) 的规则。

如果你是从 VuePress 1 或旧版 Vue 体系迁移过来，可以参见[从 VuePress 迁移](./migration-from-vuepress)。
