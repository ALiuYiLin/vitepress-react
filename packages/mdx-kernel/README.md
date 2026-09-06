# @10coding/mdx-kernel(规划中 · 包骨架)

> 状态:**目录占位 + 目标说明(已按 2026-09-06 决策更新)**。尚未接线(pnpm workspace / package.json / 源码均未创建)。
> 命名可改;最终 npm 名拟定 `@10coding/mdx-kernel`(与已发布自研包 `@10coding/*` 同一 scope)。
> 背景:`MDX-MIGRATION.md`(仓库根,markdown-it → @mdx-js/mdx 内核迁移评估)。

## 0. 定位

vitepress-react **不是 VitePress 的 fork**,后续开发自己的独有能力。文档渲染内核切换为 **MDX(@mdx-js/mdx + remark/rehype)** 后,md-it 时代承载的能力大部分由 **MDX/remark 生态直接提供**,本包只承担生态空缺、且与 Vitepress-React 文档站契约强相关的自研件。

**结论(2026-09-06):真正需要自研的只有「自定义容器」与「`<<<` 片段引入」两件核心;其余要么生态已有,要么随本次切换一并废弃。**

## 1. 决策记录(2026-09-06)

| # | 决定 | 影响 |
| --- | --- | --- |
| D1 | **`{{ }}` / Vue 模板语法不保留**。Vue 版 VitePress 相当于"在 md 中用 Vue 语法",React 版不支持 Vue 语法 | 现有 `{{…}}` 双花括号字面豁免、eagerFrontmatterInterpolation 一并废弃;正文表达式按 MDX 标准 |
| D2 | **attrs 用 MDX 社区解法**:拟用 [remark-attributes](https://github.com/manuelmeister/remark-attributes)(npm 另有 `remark-attrs`,P0 二选一验证)。不再自研 | `((…))` 分隔符按所选包的实际语法迁移(可能回退 `{#id}`/`{.cls}` 大括号形态);见 §4 |
| D3 | **不支持 `<script>`/`<style>` 提取**。MDX 天然支持顶层 `import`/`export`,样式直接 `import './x.css'`;即使后续需要也不在本次 md-it→MDX 切换范围 | md-it 版 page-scope(useState 注入 Page 体)能力不迁移;正文 `{expr}` 作用域 = MDX 标准(引用本模块 import 的绑定);scoped 样式语义(jsx-scoped)不在本次讨论 |
| D4 | **frontmatter 用生态提取**:`remark-frontmatter`(官方,剥离 YAML)或 `remark-mdx-frontmatter`(暴露为导出),供 PageData/主题使用 | frontmatter 契约(PageData.frontmatter/title 等)对外不变,实现换生态 |

## 2. 能力来源总览

| 能力 | 来源 | 说明 |
| --- | --- | --- |
| JSX / `{expr}` / 顶层 import-export | **MDX 原生** | 不再需要任何 mask/序列化 |
| 数学 `$…$` / `$$…$$` | remark-math + rehype-katex(或 MathJax 渲染器) | LaTeX `{…}` 不再与表达式冲突 |
| attrs(标题/块 id、class、键值) | remark-attributes / remark-attrs(拟,待 POC) | 见 §4 |
| frontmatter | remark-frontmatter / remark-mdx-frontmatter | D4 |
| GFM 表格 / 删除线 / 自动链接 | remark-gfm | |
| tasklist | remark-gfm(或小适配) | |
| emoji / footnote | remark-emoji / remark-footnotes | |
| 代码高亮、行高亮 meta(`{4,7}`)、焦点行 | @shikijs/rehype 或 rehype-pretty-code(待 P0 选型) | 高亮 meta 语法与 Shiki 一致 |
| 标题 slug / 自动链接锚点 | rehype-slug(+ autolink-headings 适配) | permalink DOM 细节需对齐默认主题(小适配) |
| 自定义容器 `::: tip …` | **自研**(remark-directive 之上) | 保留 fence-line attrs、no-title、嵌套、code-group 语义(§3) |
| `<<< @/path` 片段引入 / include | **自研** | §3 |
| PageData.headers 大纲采集 | 自研(小:mdast 遍历 heading,产出 level/title/slug/children 层级) | 生态无直接等价,契约需稳定 |
| 内部链接/图片 URL 重写 + dead-link 收集 | **主仓库框架层**(非本包) | 属路由/构建职责,mdast 上遍历实现,不在渲染包内 |

## 3. 自研件清单(仅两件核心 + 两个小件)

### 3.1 containers(对标 Vue 版 VitePress 的 containers 能力)

```md
::: tip 标题
内容
:::

::: details ((open)) 更多
...
:::
```

规则:继承 md-it 版已验收语义——fence-line attrs(open/no-title/类)、标题、嵌套(长 fence)、`code-group`、`v-pre`/`raw`;渲染为 `custom-block` DOM 与主题样式对齐。实现:remark-directive 之上自研容器处理。

### 3.2 include / snippet(`<<<`,对标 Vue 版 include/snippet 插件)

```md
<<< @/snippets/snippet.js{2}

<<< @/snippets/region.js#region{1,3 ts:line-numbers} [标题]
```

规则:行首 `<<<` 指令整行处理——读取文件、可选行高亮 meta/语言/标题、`#region` 区域选择、递归 include、include 依赖收集(供 vite watch)与 md 行号映射(错误定位)。

### 3.3 小件(可与主仓库一起做,不一定独立成包)

- **PageData.headers 采集**:mdast heading → `{level, title, slug, children[]}`,大纲/页面 title 推断;
- **permalink 注入**:在 rehype-slug 基础上按默认主题 DOM(header-anchor、aria-label)注入,样式复用主题。

## 4. attrs:社区方案评估(替代自研)

**结论(v1,2026-09-06)**:采用 **[remark-attributes](https://github.com/manuelmeister/remark-attributes)**,作者**手动转义花括号**书写:

```md
# 标题 \{#my-anchor\}

段落 \{.lead\}

[链接](https://a.com)\{target=_blank\}
```

- P0 实测(`@mdx-js/mdx` + remark-attributes `{mdx:true}`):标题/段落/链接/块级独立行均消费生效(见 `MDX-MIGRATION.md` §P0);
- 裸 `{#id}` 会被 MDX 当表达式解析报 acorn 错——**必须转义**;
- `key=val` 的 `key` 被插件按 React key 特殊处理;标题 children 可能带尾随空格(实现细节 P1 再核对);
- **backlog(后续优化方向)**:自动转义适配层(位置状态机复用 `maskJsxExpressions` 保护清单 + 内容判别:acorn 必败形态与后缀位 `k=v` 才转义,行尾真表达式如 `{count}` 绝不转义 + 已转义 `\{…\}` 不二次转义),待核心切换稳定后评估。
- ⚠️ 包为 WIP,支持面可能窄于 markdown-it-attrs:P1 需对每类节点做"转义→消费"矩阵实测,缺口处记录。

## 5. 已废弃/不迁移(相对 md-it 版)

| 能力 | 去向 |
| --- | --- |
| `<script>` page-scope 提取(useState 注入 Page 体、具名导出提升) | 废弃(D3);改用 MDX 顶层 import/export。**连带影响**:using-react / md-react-rules 里基于 `<script>` 的 live 示例与"page-scope"教学需在文档迁移时重写 |
| `<style>` / `<style scoped>` / `*.scoped.css` 提取 | 本次不做(D3);样式直接 `import 'x.css'`;scoped 语义后续单独设计 |
| `{{…}}` 双花括号字面豁免 | 废弃(D1);Vue 语法 |
| eagerFrontmatterInterpolation | 废弃(D1) |
| maskJsxExpressions / maskJsxHtmlLines / serializeHtmlToJsx / restoreHeaderExpressions | 整层删除(MDX 原生处理) |
| attrs `((…))` 自研实现 | 由社区包取代(D2),语法待 POC |

## 6. 开放问题(待 P0 决策)

1. remark-attributes 在 MDX 下的阶段/语法兼容性(§4);
2. 正文 `{expr}` 去掉 page-scope 后的**推荐写法**定稿:仅模块级 import?页面专属状态如何组织(组件文件 + import?`export const`?)——直接决定文档教学(using-react)怎么写;
3. 代码组(vp-code-group)/复制按钮/行号是否保留(Shiki transformer 覆盖行号/焦点,代码组可能要小自研);
4. 单包 vs 多包(默认单包 `@10coding/mdx-kernel` 导出多插件)。

## 7. 里程碑(引用 MDX-MIGRATION.md §4)

P0 选型 POC(验证 remark-attributes 时序、Shiki、math)→ P1 内核替换(纯文档页回归)→ P2 能力落地(§3 自研件 + §2 生态件接线)→ P3 文档迁移(教学页重写:<script>→import、attrs 语法、{{}} 移除)→ P4 收尾(删 mask/序列化层、错误定位改 mdast position)。
