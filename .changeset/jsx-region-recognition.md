---
'@10coding/vitepress-react': patch
---

JSX 区域识别重建为「声明式区域表 + 交接层」,取代原先的 A/B/C/D 规则集。

面向 Markdown 作者的变化:

- 作者标签在**所有**行内上下文里都按 JSX 交给 React,包括标题。
  `## 标题 <Badge />` 的锚点 id 保持干净(`标题`,而不是 `标题-badge`),
  标题里的 `<>{expr}</>` 也和正文一样求值(此前标签会塌成字面 `<>`,
  原文还会漏进 slug)。
- 不再识别 Vue 语法并静默降级。属性一律按 JSX 写,因此 `:prop="x"` /
  `@click="x"` 现在**在编译期报错**(oxc),而不是"丢弃属性 + 告警";
  `v-if` / `v-for` 会被当普通属性透传;`{{ msg }}` 被当表达式容器。
- 区域出现在链接标签内(`[<>{a}</>](/x)`)不再让构建崩溃。

内部:

- 新增 `src/node/markdown/jsx/`:`regions.ts`(规则表)、`scan.ts`(词法)、
  `scriptTags.ts`(`<script>` 判定唯一定义)、`handoff.ts`(区域 →
  `env.sfcBlocks` / `env.jsxStore` + 占位输出)、`index.ts`;
  删除 `jsxTokenRules.ts` 与 `jsxLexer.ts`,不再有任何 core 阶段规则。
- token 类型为 `vp_jsx_inline` / `vp_jsx_block` / `vp_script`,文本提取者
  按类型过滤,因此 slug 与大纲标题天然忽略区域。
- 占位符改为**带 nonce 的元素哨兵**
  (`<span data-vp-jsx="<nonce>:n">` / `<div data-vp-jsx="<nonce>:n">`),
  取代 `@@VP_HTML_n@@` 文本 marker:作者正文/代码块里写的同名字面量
  (或手写的 `data-vp-jsx`)不会再被真实区域替换。
