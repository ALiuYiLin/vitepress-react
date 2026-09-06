# @10coding/mdx-kernel(规划中 · 包骨架)

> 状态:**目录占位 + 目标说明**。尚未接线(pnpm workspace / package.json / 源码均未创建)。
> 命名可改;最终 npm 名拟定 `@10coding/mdx-kernel`(与已发布的自研包 `@10coding/vite-plugin-jsx-scoped` 等同一 scope)。
> 背景文档:`MDX-MIGRATION.md`(仓库根,markdown-it → @mdx-js/mdx 内核迁移评估)。

## 0. 定位(为什么会有这个包)

vitepress-react **不是 VitePress 的 fork**,后续也不会同步上游功能,将开发自己的独有能力。
文档渲染内核若重构为以 **MDX(@mdx-js/mdx + remark/rehype)** 为核心,当前由 markdown-it 承载、而 remark 生态没有等价或等价不保真的能力,都需自研——本包(族)就是这批自研渲染件的落点。

一句话:**把 Vue 版 VitePress 里"markdown-it 插件链"提供的全部文档站能力,在 mdast/rehype 世界里原样重建并超越**。

## 1. 包族地图(自研件 → 对标)

| 自研件 | 职责 | 对标(Vue 版 VitePress / 上游) | 内核落点 |
| --- | --- | --- | --- |
| `extract-script-style` | fence 感知提取 `<script>` / `<style>`:import/具名导出 → 模块顶层;其余(useState 等)→ 页面 `Page()` 体;`<style scoped>` / `*.scoped.css` 接线 jsx-scoped | Vue 版天然支持(整页即 SFC);md-it 版对 `@mdit-vue/plugin-sfc` | **MDX 编译前**(MDX 会把裸 `<script>` 当 JSX 元素) |
| `heading-ids`(含 slug 与 permalink) | 标题 slug、`header-anchor` permalink、大纲 headers 收集(PageData.headers 契约) | `@mdit/plugin-anchor` + `@mdit-vue/plugin-headers` | mdast 采集 / rehype 注入 |
| `attrs` | `((…))` 后缀属性(id/class/裸属性/键值)注入标题、块、行内元素 | `@mdit/plugin-attrs` | **编译前掩码 + mdast 属性注入**(见 §3) |
| `containers` | `::: tip|info|warning|…` 自定义容器:fence-line attrs、no-title、嵌套、`code-group`、`v-pre`/`raw` | Vue 版 `vitepress` 的 markdown containers 实现 | remark-directive 之上自研 |
| `code` | 代码高亮、行高亮 meta(`{4,7}`)、焦点行、代码组、复制按钮、行号 | Vue 版 markdown 高亮接线 + preWrapper/lineNumbers | rehype(高亮引擎待 P0 选型) |
| `math` | `$…$` / `$$…$$` → MathJax/KaTeX;`{…}` LaTeX 分组不与 `{expr}` 冲突 | Vue 版 `markdown.math`(markdown-it-mathjax3) | remark-math + 渲染器 |
| `links-images` | 内部链接/图片重写(`.md→.html`)、dead-link 收集(带行号)、外链 `target/rel` | Vue 版 markdown 的 link/image 插件 | rehype 自研遍历 |
| `include-snippet` | `<<< @/path{…}` 与 `<!-- @include -->`,含区域选择/递归/行号映射 | Vue 版 include/snippet 插件 | remark 预处理自研 |
| `toc-title-frontmatter` | `[[toc]]` 块、title 推断、frontmatter 剥离(env/PageData 契约) | `@mdit-vue/plugin-toc/-title/-frontmatter` | remark/mdast 自研 |
| `jsx-facade`(可选) | 少量私有语法的"编译前掩码":`((…))` attrs、`$` 数学、字面花括号处理 | 无上游对标(md-it 版散在 `maskJsxExpressions` 等) | MDX 编译前 |

> 现状 md-it 版对应源码位置(migrate 时对照):`src/node/markdownToReact.ts`(mask/序列化)、`src/node/markdown/*`(md-it 装配与自研插件)、`src/node/markdown/plugins/*`。

## 2. 目标验收:示例 → 编译后结果

以下为目标形态(规划;以 P0 POC 实测为准),每个能力给「md 输入 → 期望产物」。

### 2.1 attrs(对标 `@mdit/plugin-attrs`)

```md
## API ((#api-ref))

正文加类: ((.lead)) 段落

| 表头 | 值 |
| --- | --- |
| a | b |

((.tbl))
```

匹配规则(继承 md-it 版已拍板语义):

- 分隔符 `((` … `))`,内容为 `#id` / `.class` / `key=value` / 裸属性;
- 消费位置:heading、段落、表格、列表、hr、行内元素、容器 fence line、tasklist;
- **fence 不消费**(行高亮 meta `{…}` 保留给高亮插件);
- `{}` 一律留给 `{expr}`(JSX 表达式)——分隔符不占用花括号,这是 React 版与 Vue 版的关键差异,必须保留。

期望产物(编译后,概念):

```html
<h2 id="api-ref"><a class="header-anchor" …></a>API</h2>
<p class="lead">正文加类: 段落</p>
<table class="tbl">…</table>
```

### 2.2 标题锚点 permalink(对标 `@mdit/plugin-anchor`)

```md
## Quick Start
```

规则:slug 化(`Quick Start` → `quick-start`,细节与 `@mdit-vue/shared` slugify 对齐)→ id 注入 + permalink 符号(默认主题 `header-anchor`)。

```html
<h2 id="quick-start">Quick Start <a class="header-anchor" href="#quick-start" aria-label="Permalink to "Quick Start"">​</a></h2>
```

同时把标题(文本层)录入 PageData.headers,驱动右侧大纲。

### 2.3 `<script>` / `<style>` 预提取(对标 Vue 版整页 SFC 能力)

```md
<script>
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>count: {count}</button>
}
</script>

<Counter />
```

规则(编译前,MDX 解析器介入之前):

- fence/行内码内的 `<script>` 是示例,不提取;
- `<script>` 块整体占位;渲染结束后按现行语义回填:具名导出/import → 模块顶层,其余语句 → 注入页面组件函数体(与正文 `{expr}` 同作用域);
- `<style scoped>` / `*.scoped.css` → 交给 `@10coding/vite-plugin-jsx-scoped`(选择器带 `data-v-{hash}`)。

期望产物(编译后,概念 TSX):

```tsx
// 模块顶层:import、export function Counter…
export default function Page() {
  const __pageData = JSON.parse(…)
  return (
    <div className="vp-doc">
      <p><Counter /></p>
    </div>
  )
}
```

### 2.4 匹配规则总表(从 md-it 版继承、MDX 化时需保持/迁移)

| 语法 | 规则(md-it 版现状) | MDX 化后 |
| --- | --- | --- |
| 正文 `{expr}` | 一律 JSX 表达式 | **MDX 原生**,无需掩码(掩码层可删) |
| 字面 `\{` | 转义,留给解析器去反斜杠 | MDX 同规则,对齐即可 |
| `{{…}}` | 双花括号按字面输出 | ⚠️ MDX 下 `{{ x: 1 }}` 是对象表达式——**行为差异需决策**(见 §5) |
| fence / 行内码 | 内容永不解析/求值 | 同 |
| `$…$` / `$$…$$` | 行内成对保护,LaTeX `{…}` 不进表达式 | 由 remark-math 接管,`$` 不再是 mask 状态机问题 |
| `((…))` attrs | 默认分隔符 | 需编译前掩码保留(见 §3) |
| `<script>`/`<style>` | md-it 前预提取 | 同(仍须先于 MDX) |
| `<<<` snippet / `<!-- @include -->` | 行首指令整行保留 | remark 预处理阶段处理 |

## 3. 关键设计决策(待 POC 确认)

1. **attrs 不走"MDX 表达式"**:`((#id))` 在纯 MDX 里会被当表达式解析失败,必须在 **MDX 编译前**把 `((…))` 掩码成占位,mdast 阶段定位目标节点并注入属性,再还原——与现行 mask 同哲学,作用点从 markdown-it 换成 mdast;
2. **数学由 remark-math 接管后**,`{…}` LaTeX 分组不再与 `{expr}` 冲突,math 的掩码保护逻辑可以删除(简化);
3. **script/style 提取永远先于 MDX** 编译;
4. PageData 契约(headers/frontmatter/title/params/deadLinks/includes)对外**不变**,只换内部采集实现。

## 4. 非目标(本包不做)

- 不做通用 MDX 运行时/编译器(直接用 `@mdx-js/mdx`);
- 不做默认主题(主题是站点/另一包职责);
- 不维护 markdown-it 兼容层(内核切换后 md-it 插件退役)。

## 5. 待决策/开放问题

- `{{…}}` 双花括号在 MDX 语义下的去向(保留字面需要一层掩码,还是接受对象表达式语义并改文档教学);
- attrs 分隔符最终形态:`((…))` 保留(推荐,212 处迁移不回滚)还是随 MDX 走社区语法;
- 高亮引擎选型(Shiki / rehype-pretty-code / 其他),需 P0 产物与构建时间对比;
- 单包 vs 多包:当前按"一个 `@10coding/mdx-kernel` 导出多插件"规划;若某件独立性/发布节奏需要拆包,再在 `packages/` 下分目录。

## 6. 里程碑(引用 MDX-MIGRATION.md §4)

P0 选型 POC → P1 内核替换(纯文档页回归)→ P2 能力迁移(本包族逐件落地,以现有 100+ 单测 + docs 逐页为验收)→ P3 协议改造(script/style/attrs)→ P4 收尾(删 mask/序列化旧层、错误定位改 mdast position)。
