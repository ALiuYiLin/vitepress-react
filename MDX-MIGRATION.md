# MDX 内核迁移评估(markdown-it → @mdx-js/mdx)

> 状态:草稿(供决策讨论,未实施)
> 日期:2026-09-06 · 分支:`migrate-react-m0`
> 依据代码:运行时「正文 `{expr}` 一律求值、attrs `((…))`、math 行级 `$` 保护」改造完成后的现状
> 触发问题:正文写作是否应直接采用标准 MDX(React 生态事实标准),而不是维护一套自家 {expr} 子集

---

## 1. 背景与决策问题

vitepress-react 把正文编译成 React 页面模块的管线是自研的:

```
maskScriptBlocks → maskJsxHtmlLines/maskJsxExpressions(占位 @@VP_EXPR/HTML_n@@)
→ markdown-it 渲染 HTML → serializeHtmlToJsx(HTML→JSX,占位处还原表达式/组件)
→ oxc 编译(vite 插件:jsx-scoped、组件自动导入…)
```

这套管线让 Markdown 里能写 `{expr}` 与 JSX,但它是**私有语法子集**,不是 MDX。决策问题:

1. 是否值得把渲染内核替换为 [`@mdx-js/mdx`](https://mdxjs.com/)(整篇内容编译为 JSX/JS,Next.js / Docusaurus 同款)?
2. 若替换,markdown-it 承载的 VitePress 能力(锚点/attrs/容器/高亮/数学/表格/链接重写/……)哪些保留、哪些废弃、哪些用 remark 生态等价迁移?
3. `@mdit/plugin-attrs` 在 MDX 内核下是否还能工作?若不能,id/class 语法如何重新设计?

## 2. 现状能力清单(迁移的“底账”)

### 2.1 markdown-it / @mdit-vue 承载(全部依赖 token 流水线)

| 能力 | 实现 | 备注 |
| --- | --- | --- |
| 标题锚点 + permalink(`header-anchor`,aria-label) | `@mdit/plugin-anchor` + 定制 permalink | slugify 来自 `@mdit-vue/shared` |
| **attrs 后缀属性(id/class/裸属性)** | `@mdit/plugin-attrs`,`left:'((' right:')'` | 上一轮从 `{}` 迁移而来;不含 fence |
| 自定义容器 `::: tip …` | 自研 `plugins/containers.ts`(支持 fence line attrs、no-title、嵌套、code-group、v-pre/raw) | |
| 代码高亮/行高亮 `{4,7}`/代码组/复制按钮/行号 | 自研 `highlight.ts` `lineNumbers.ts` `preWrapper.ts` + 主题 CSS | |
| 数学 `$…$` / `$$…$$` | `markdown-it-mathjax3`(动态 import,出错即提示安装)+ 自研 v-pre 包裹 | mask 层已按“行内成对 $”保护,LaTeX `{…}` 不被当表达式 |
| 表格增强(tasklist、tabindex) | `@mdit/plugin-tasklist` + 自研 `table.ts` `restoreEntities.ts` | |
| emoji / footnote / cjk emphasis | `@mdit/plugin-emoji` / `-footnote` / `mdit-cjk-friendly` | |
| `[[toc]]`、env.headers 大纲收集、frontmatter、title 推断 | `@mdit-vue/plugin-toc/-headers/-frontmatter/-title` | headers 默认必须开(大纲依赖) |
| 内部链接/图片重写、dead-link 收集、`include`/`snippet`、外部链接 target | 自研 `link.ts` `image.ts` `include.ts` `snippet.ts` | include 依赖 env.src/行号,错误要带 md 行号 |
| `<script>`/`<style>` 提取 | `maskScriptBlocks`(md-it **之前**)+ `@mdit-vue/plugin-sfc` | script 的 page-scope(useState 注入 Page 体)与具名导出提升是本 fork 核心 |

### 2.2 markdown-it 之外的自研层(与内核替换的关系)

- `maskJsxHtmlLines` / `maskJsxExpressions`(JSX 语义、`\{` 转义、`{{…}}` 双花括号豁免、fence/行内码/`<style>`/frontmatter/`<<<`/math 保护);
- `serializeHtmlToJsx`(正文文本一律包成 `{"…"}` 字符串、占位还原);
- `createReactPageSrc`(组装:正文 JSX + script 提升 + 组件自动导入 + `__pageData` JSON);
- `restoreHeaderExpressions`(env.headers 标题里的表达式还原);
- vite 层:`jsxScopedVitePlugin`(md 页 `<style scoped>`/`*.scoped.css`,选择器带 `data-v-hash`)、错误定位注释 `{/* JSX md:n */}`、`dedupeImports`。

> 结论前置:真正“换内核”替换的是 2.1 整块与 2.2 的 mask/序列化;2.2 的 script/style/组件自动导入是**页级协议**,MDX 下仍要自研保留,只是形态要改(见 §7)。

## 3. 目标架构(路线 A)

```
frontmatter 剥离(remark-frontmatter)
→ <script>/<style> 预提取(自研,保留)
→ @mdx-js/mdx compile(CommonMark + JSX + {expr} + 顶层 import/export + remark/rehype 插件链)
→ 产物:整篇正文 = 一个可渲染组件/JSX 模块
→ 页面模块组装:正文组件 + script page-scope + __pageData(自研,保留)
→ oxc 编译(jsx-scoped、自动导入,保留)
```

关键差异:**正文不再“先生成 HTML 字符串再序列化成 JSX”,而是直接编译为 JSX/JS**;mdast/hast 树替代 token 流成为所有能力的作用点。

## 4. 迁移阶段与里程碑

| 阶段 | 内容 | 出口标准 |
| --- | --- | --- |
| P0 选型 POC | 起最小 demo:@mdx-js/mdx + remark 插件链渲染一个纯文档页;验证 SSR/hydrate、产物体积、构建时间 | 纯文档页(无表达式/组件)行为与现在一致,可 diff |
| P1 内核替换 | 编译入口替换;frontmatter/标题/大纲(title、headers、slug)采集改 mdast;dead-link/行号重算;页缓存适配 | 无 JSX 的 md 页全量回归通过(对照 docs 现有 37+ 页) |
| P2 能力迁移 | §5 矩阵逐项:高亮、容器、表格、emoji/footnote、数学、链接/图片、include/snippet、`[[toc]]` | 与现有渲染逐页像素级/语义级对比验收 |
| P3 协议改造 | attrs(§6)、`<script>` page-scope 与 MDX import/export 融合(§7)、scoped 样式、自动导入 | 现有用 React 能力的所有页面(using-react/md-react-rules/md-scoped-demo…)回归 |
| P4 收尾 | mask 系列删除、错误定位(`JSX md:n`→mdast position)、缓存失效策略、性能/产物回归、上游文档差异文档化 | 全量 typecheck/build/单测/e2e、页面 200 |

## 5. 能力迁移矩阵(含 remark 选型)

| 能力 | markdown-it 现状 | remark/rehype 候选 | 行为差异与备注 |
| --- | --- | --- | --- |
| 标题 slug/锚点 permalink | `@mdit/plugin-anchor` 定制 permalink(header-anchor) | [rehype-slug](https://github.com/rehypejs/rehype-slug) + 自研 rehype 加 permalink 节点(rehype-autolink-headings 样式不同,需按默认主题复刻) | slugify 规则要与 @mdit-vue/shared 对齐,否则目录/链接锚点变化 |
| attrs(块/标题/行内后缀属性) | `@mdit/plugin-attrs`,`((…))` | 参考 [remark-attributes](https://github.com/manuelmeister/remark-attributes)(markdown-it-attrs 语法移植)或 remark-directive 自研 | **语法需重定**,见 §6;remark-attributes 是社区维护,需评估质量与 `((…))` 语法是否支持 |
| 容器 `::: tip` | 自研 containers | [remark-directive](https://github.com/remarkjs/remark-directive)+ 自研容器渲染(fence-line attrs/no-title/嵌套/code-group) | containers.test 33 用例是迁移验收基线 |
| 代码高亮 | 自研 highlight(行高亮 meta `{4,7}`、代码组、复制) | [@shikijs/rehype](https://github.com/shikijs/shiki) 或 [rehype-pretty-code](https://rehype-pretty-code.pages.dev/)(+ 自研行高亮 meta 解析) | 高亮引擎 md-it 版用的 markdown-it 高亮接口;换引擎后主题/复制按钮结构(主题 CSS)要对齐 |
| 数学 | markdown-it-mathjax3(动态依赖) | remark-math + [rehype-katex](https://github.com/remarkjs/remark-math) | KaTeX ≠ MathJax,输出 DOM 不同;`$` 保护从 mask 层移除(mdx 天然不解析 `$`?——注意:MDX 里 `$…$` 是普通文本,需 remark-math 才解析,`{…}` LaTeX 分组不再有与 `{expr}` 的冲突,反而是简化点) |
| 表格/emoji/footnote/tasklist | md-it 插件 | remark-gfm(footnote 用 remark-footnotes,GFM 表格)+ remark-emoji;tasklist 自研 | GFM 表格 vs md-it 表格规则有差异(对齐/转义),需按现有 markdown.test 验收 |
| `[[toc]]` | `@mdit-vue/plugin-toc` | 自研 remark 插件(用 headers 采集结果渲染 toc 块) | 依赖 env.headers 顺序/level |
| headers/大纲/title/frontmatter | @mdit-vue 全家 | remark-frontmatter + 自研 mdast heading 采集(slug、level、children 文本) | env 协议(`PageData.headers`)对外不变,内部实现换 |
| 内部链接/图片重写 + dead-link | 自研 link/image(+ env.links/linkLines) | 自研 rehype 遍历(hast-util)重写 `href/src`、收集行号 | include/snippet(`<<<`)在 mdast 阶段处理,include 递归与行号映射要重做 |
| include/snippet | 自研(env.src、includes) | 自研 remark 插件(preprocess 展开) | `include` 的 `#region/选择标题段` 语义在 mdast 上重写 |
| `<script>`/`<style>`(page-scope) | maskScriptBlocks + plugin-sfc | **自研预提取保留**(协议改,见 §7) | MDX 会把裸 `<script>` 当 JSX 元素编译,必须先行提取 |
| eagerFrontmatterInterpolation(`{{ }}`) | Vue 遗留插件(默认关) | 废弃 | MDX 语义下 `{{ }}` 是嵌套表达式/文本,无该能力 |

> 选型总原则:凡是 VitePress 已经内建且上游文档依赖的“细节行为”(permalink DOM、行高亮 meta、容器 fence-line attrs、include 区域选择),社区 remark 插件只提供“近似”,**验收标尺 = 现有单测(markdown/containers/include/image/link/snippet/markdownToReact 等 100+ 用例)+ docs 逐页对比**;近似不够的部分一律自研 mdast/rehype 插件。

## 6. 专项:@mdit/plugin-attrs 的 MDX 命运与语法重设计

**结论:attrs 插件不能直接工作。** 它活在 markdown-it 的 token 规则里;mdxjs 无 token 流。`((#id))`/`((.cls))` 在 MDX 里会按表达式解析(非法的 `((` 内容报编译错)或按文本输出。

可选语法(需决策,三选一或组合):

| 方案 | 语法示例 | 实现成本 | 说明 |
| --- | --- | --- | --- |
| A. 移植 markdown-it 风格后缀 | `## 标题 ((#id))`、`{.cls}`(恢复花括号?) | 中:自研 mdast 插件,可参考 [remark-attributes](https://github.com/manuelmeister/remark-attributes) | 与今天 docs 写法迁移量最小;但“恢复 `{}`”在 MDX 里与表达式抢语法,必须坚持 `((…))` 形态 |
| B. directive 语义 | `:::div {.cls}` / `## 标题 {#id}`(需插件把标题文本后的 `{…}` 当属性,不交给表达式) | 高:MDX 标题行尾 `{…}` 会先被 mdxjs 当表达式吃掉,要在**编译前**掩码,等于 reintroduce mask | 治标不治本 |
| C. 前置掩码 + 编译后应用 | 编译前把 `((…))` 语法占位,mdast 上定位目标节点应用属性 | 中:掩码在 mdxjs 之前(与现在 mask 同层) | 与 B 本质相同,推荐形态:它把“md-it attrs 语义”原样搬到 MDX 上 |

**建议**:若真走路线 A,**保留 `((…))` 语法、以“编译前掩码 + mdast 属性注入”实现**(方案 C/A 结合),attrs 能力不丢、docs 的 212 处迁移不回滚;代价是维持一层与“纯 MDX”不同的小语法(与今天同一哲学,只是作用点从 md-it 变 mdast)。

## 7. 页级协议:`<script>` / `<style>` 与 MDX 的冲突

MDX 文件级 JS 是 **顶层 `import`/`export`**(模块作用域);而 vitepress-react 的 `<script>` 语义是“import/具名导出 → 模块顶层;其余(useState…)→ 注入页面 `Page()` 函数体”。两者并存需要新协议:

- **推荐**:mdxjs 的顶层 `import/export` 直接接受(MDX 标准);非导出的“页面作用域初始化语句”继续走自研 `<script>` 提取(编译前拿走,注入 Page 体)——即 **import/export 归 MDX,副作用/状态声明归 `<script>`**;
- 正文 `{expr}` 与两种来源的标识符共享作用域的保证方式要重验(mdxjs 单模块 + 注入代码拼接的位置);
- `<style scoped>`/`*.scoped.css`:与编译内核无关,继续在 vite transform 层做(jsx-scoped),不动;
- 组件自动导入(`<Badge/>` 免 import):继续注入,不动。

## 8. 产物形态与运行时影响

- 正文从“HTML 字符串序列化”变为“JSX 组件树”,`serializeHtmlToJsx.ts` 整体删除;
- 整页仍是 React hydrate(现状模型),MDX 不改变“壳 + 正文”的 SSR 方式;但**每个纯文档页也会多一个正文组件函数**,产物/首屏差异需 P0 实测(不宜预先断言“MDX 更重”或“更轻”);
- oxc/tsx 编译、jsx runtime 配置、错误定位注释(`JSX md:n` → mdast `position` 行号)重接;
- 缓存:md render 单例与 `hash(ts,relativePath)` 缓存逻辑保留,键值语义不变。

## 9. 主要风险

1. **与上游 Vue 版的双轨**:上游继续 markdown-it;换内核后,上游的新 md 特性/配置语义无法直接同步,fork 维护成本上升(最大风险);
2. **行为细节回归**:permalink DOM、行高亮 meta、容器、include 区域选择等“隐藏契约”靠自研保真,工作量大头在 P2/P3;
3. **依赖变化**:markdown-it-mathjax3 → KaTeX(或继续 MathJax 的自研 rehype);高亮引擎替换影响主题 CSS 结构;
4. **语法冲突反复**:MDX 的 `{expr}` 是优点(不用 mask),但 attrs/`$` 数学又要回到“编译前掩码”保语法 → 仍有一层私有预处理,收益打折;
5. **社区插件质量**:remark-attributes 等为社区维护,深用需 fork 或自研。

## 10. 备选路线(供对比,不动内核)

- 路线 B:保持 markdown-it 内核,按 MDX 写作习惯**补齐语法缺口**(裸 `import/export` 声明行、JSX 覆盖位置扩全、`export const` 数据)。成本以天计,attrs/math/高亮/容器全保留;代价:仍是自家子集,拿不到 MDX 工具生态(编辑器、lint、tsc 检查、remark 社区插件)。
- 路线 C:维持现状,文档明示“这是 MDX 风格子集,不是 MDX”。

## 11. 结论建议

1. 若 fork 的长期定位是“**紧跟上游 VitePress 的 React 移植**”→ 不建议换内核(路线 B/C),换内核与上游同步目标冲突;
2. 若定位转向“**React 生态独立文档引擎(与上游分道扬镳)**”→ 路线 A 值得做,顺序按 §4 阶段走,P0 先用 2~3 页纯文档页做产物/性能 POC 再决定;
3. **无论哪条路,`@mdit/plugin-attrs` 都不会是“还能用”的答案**——路线 B 下它继续工作(现状),路线 A 下必须换实现但语法可保留 `((…))`;
4. 建议下一动作:若认真评估路线 A,先产出 P0 POC(最小 mdxjs 站点 + remark 插件链 + 纯文档页 diff),用数据(构建时间/产物体积/回归差异清单)替代口头权衡。

## 参考

- MDX 官方:[mdxjs.com](https://mdxjs.com/) / [@mdx-js/mdx](https://www.npmjs.com/package/@mdx-js/mdx)
- markdown-it-attrs 的 remark 移植参考:[remark-attributes](https://github.com/manuelmeister/remark-attributes)(另见 npm 上 `remark-attrs`)
- remark 官方插件:remark-directive / remark-gfm / remark-frontmatter / remark-math
- rehype 官方插件:rehype-slug / rehype-autolink-headings / rehype-katex / rehype-pretty-code(或 [@shikijs/rehype](https://github.com/shikijs/shiki))
- mdx-js 仓库(社区集成讨论,如 vite/query 参数):https://github.com/mdx-js/mdx
