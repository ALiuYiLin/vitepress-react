# MDX 内核迁移(决策基线 · 执行计划)

> 状态:**已决策(2026-09-06,`refactor/mdx` 分支),本文档是执行基线**;不再是一份开放评估。
> 决策记录(含理由)见 [`packages/mdx-kernel/README.md`](./packages/mdx-kernel/README.md) 的 D1–D4;
> 本文档负责:目标、要删/要留/要自研的完整底账、迁移矩阵、阶段与风险。
> 代码基线:正文 `{expr}` 一律求值、attrs `((…))`、math 行级 `$` 保护改造完成后的 `migrate-react-m0` 现状。

---

## 1. 背景与目标

vitepress-react 不是 VitePress 的 fork,不继承上游后续功能,将开发自己的独有能力。
文档渲染内核从自研 markdown-it 管线切换为 **MDX(@mdx-js/mdx + remark/rehype)**,采用此前评估的"路线 A"(真 MDX);路线 B/C(保持 markdown-it 补语法)已否决,见 §8。

## 2. 决策摘要

| # | 决策 | 一句话 |
| --- | --- | --- |
| D1 | Vue 模板语法(`{{ }}` 等)**不保留** | React 版不支持 Vue 语法;正文按 MDX 标准 |
| D2 | attrs 走 **remark-attributes**(或 remark-attrs)**社区方案** | 不自研;P0 验证时序与语法(§5 风险) |
| D3 | `<script>`/`<style>` 提取**本次不做** | 用 MDX 顶层 import/export 与 `import './x.css'`;后续需要再议 |
| D4 | frontmatter 用 remark-frontmatter / remark-mdx-frontmatter | PageData 契约不变 |

## 3. 现状管线(要替换的底账)

```
maskScriptBlocks(<script> 提取)
→ maskJsxHtmlLines / maskJsxExpressions(JSX 行与 {expr} 占位 @@VP_…@@)
→ markdown-it 渲染(md-it + @mdit(-vue)/* + 11 个自研 plugins/*)
→ serializeHtmlToJsx(HTML→JSX,占位还原)
→ createReactPageSrc(正文 JSX + script 提升 + __pageData)
→ oxc 编译(vite 插件:jsx-scoped、组件自动导入)
```

要删除的整层:`markdownToReact.ts` 中 mask 两函数与 `restoreHeaderExpressions`、`serializeHtmlToJsx.ts`、`src/node/markdown/*` 的 md-it 装配与 `plugins/*`(11 个自研 md-it 插件)、attrs 的 `((…))` 接线、eagerFrontmatterInterpolation、`restoreEntities` 等。
保留不变的页级协议:`__pageData` JSON、PageData 字段契约(headers/frontmatter/title/params/deadLinks/includes)、组件自动导入、jsx-scoped vite 插件(与渲染内核解耦,本次不动)、SSR/水合与页面 chunk 模型。

## 4. 目标架构

```
frontmatter 剥离(remark-frontmatter / remark-mdx-frontmatter)
→ @mdx-js/mdx compile(JSX / {expr} / 顶层 import-export 原生;
   remark 链:容器自研、include/snippet 自研、attrs 社区包、math、gfm…;
   rehype 链:slug/permalink、Shiki 高亮、katex…)
→ 页面模块组装:正文组件 + __pageData(保留/减薄)
→ oxc 编译(jsx-scoped、自动导入,保留)
```

正文不再有"HTML 字符串 → JSX 序列化"环节。

## 5. 能力迁移矩阵(生态 / 自研 / 废弃)

| 能力 | md-it 版现状 | MDX 版来源 | 备注/风险 |
| --- | --- | --- | --- |
| JSX / `{expr}` / import-export | mask + 序列化(自研) | **MDX 原生** | mask/序列化整层删除 |
| attrs(标题/块/行内 id、class、键值) | `@mdit/plugin-attrs` + `((…))` 接线 | remark-attributes / remark-attrs(P0 验证) | ⚠️ **时序风险**:MDX 可能先把 `{#id}` 解析成表达式,插件未必能消费;P0 必须出结论(§5.1) |
| 自定义容器 `::: …` | 自研 containers | **自研**(remark-directive 之上) | 保留 fence-line attrs/no-title/嵌套/code-group 语义 |
| `<<<` 片段 / include | 自研 include/snippet | **自研** | 行号映射、依赖收集、watch 恢复 |
| PageData.headers 大纲 | `@mdit-vue/plugin-headers` | 自研小件(mdast 遍历) | 层级+纯文本 title+slug,契约稳定 |
| permalink | `@mdit/plugin-anchor` | rehype-slug + 小适配 | header-anchor DOM/样式对齐默认主题 |
| 代码高亮/行高亮 `{4,7}`/焦点 | 自研 highlight(+preWrapper) | @shikijs/rehype 或 rehype-pretty-code(P0 选型) | meta 语法对齐 Shiki |
| 代码组/复制按钮/行号 | 自研 preWrapper/lineNumbers | Shiki transformer 覆盖行号/焦点;代码组待定 | |
| 数学 `$…$`/`$$…$$` | markdown-it-mathjax3 + 自研 v-pre | remark-math + rehype-katex(P0 验证) | 渲染器更换,默认主题样式适配 |
| 表格/删除线/tasklist | md-it + tasklist 插件 | remark-gfm | checkbox 结构适配 |
| emoji / footnote | @mdit/plugin-emoji/-footnote | remark-emoji / remark-footnotes | |
| frontmatter/title 推断 | @mdit-vue/plugin-frontmatter/-title | remark-frontmatter + 自研小件 | D4 |
| `[[toc]]` | `@mdit-vue/plugin-toc` | 用 headers 采集渲染(自研小件) | |
| 内部链接/图片重写 + dead-link | 自研 link/image(env.links) | **主仓库框架层**实现(mdast/hast 遍历) | 不属渲染包;dead-link 行号映射 |
| `<script>` page-scope / `<style>` 提取 | maskScriptBlocks + plugin-sfc | **废弃(D3)** | 教学页 using-react/md-react-rules 需重写(P3) |
| `{{ }}` / eagerFrontmatterInterpolation | Vue 遗留(默认关)+ 字面豁免 | **废弃(D1)** | |

### 5.1 attrs 时序风险(必答问题)

`remark-attributes` 以 markdown-it-attrs 风格消费 `{#id}` / `{.cls}`;而 MDX 的 micromark 扩展可能把正文文本里的 `{…}` 先解析成 `mdxExpression`(非法 JS 报错)。P0 实验必须回答:

1. `## 标题 {#id}` 与 `段落 {.cls}` 在 `@mdx-js/mdx compile` + remark-attributes 下:正常消费?报错?静默失效?
2. 若失效:remark-attributes 放 remark 链的前/后是否有差异?是否需要先对 `{#id}` 形态掩码?
3. 若可行:产物中 attrs 是否注入到对应节点(h2 id / p class)。

## 6. 阶段与里程碑

| 阶段 | 内容 | 出口标准 |
| --- | --- | --- |
| **P0 选型 POC(进行中)** | 最小 mdxjs 站点:remark-attributes 时序、remark-math+rehype-katex、Shiki 行高亮 meta、remark-frontmatter;纯文档页产物对比 | 四问有结论,写入本文档 §P0;决策 attrs 走社区还是回退自研 |
| P1 内核替换 | compile 入口替换;PageData(headers/frontmatter/title)采集改 mdast;dead-link/行号重算;缓存适配 | 无 JSX 的纯文档页全量回归(对照 docs 现有页) |
| P2 能力落地 | 自研件(containers、include/snippet、headers、permalink)+ 生态件接线 | 现有单测(markdown/containers/include/…)语义级验收 + docs 逐页对比 |
| P3 文档迁移 | 教学页重写:`<script>`→import/export、attrs 语法、`{{}}` 移除、表达式作用域说明 | zh 文档全部页面 200 且语义与新规则一致 |
| P4 收尾 | 删 mask/序列化/md-it 层与依赖、错误定位改 mdast position、性能/产物回归 | typecheck/build/单测/e2e、页面 200 |

## 7. 主要影响与风险

1. attrs 社区方案在 MDX 下时序不确定(§5.1,P0 决出);
2. D3 连锁:正文 `{expr}` 失去 page-scope,表达式只能引用模块级 import 绑定;using-react / md-react-rules 的 live 教学(编辑器示例)整体重写;
3. 数学渲染器 MathJax → KaTeX(或自研 MathJax rehype),默认主题里公式样式/复制行为变化;
4. 高亮产物 DOM 变化(Shiki 与 md-it 高亮不同),代码相关主题 CSS 适配;
5. 与已发布自研包(`@10coding/vite-plugin-jsx-scoped` 等)的接线不变(jsx-scoped 在 vite transform 层,解耦);
6. 单测体系从 md-it 语义转向 mdast/生态语义:旧 markdown.test/containers.test 等改为新管线的验收基线(行为契约)而非实现镜像。

## 8. 否决记录(供追溯)

- **路线 B/C(保持 markdown-it、补 MDX 语法缺口)**——已否决:目标明确走真 MDX;
- **自研 attrs mdast 注入 + 编译前掩码**(`((…))` 保留)——降级为 P0 回退方案(仅当 remark-attributes 不可用时启用);
- **`<script>`/`<style>` 提取的页级协议**(保留 page-scope)——否决(D3),不迁移;
- **`((…))` 分隔符维持**——随 D2 由社区包语法取代,不再承诺。

## 附录

- 决策与自研件细节:`packages/mdx-kernel/README.md`
- P0 实验目录:`temp/p0-mdx`(gitignored)
