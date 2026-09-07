---
description: '在 Markdown 中使用 React 的完整规则:表达式、JSX 区域、::: react 容器、编译产物与真实渲染。'
---

# 在 Markdown 中使用 React 的规则 {#react-markdown-rules}

本文是 [在 Markdown 中使用 React](./using-react) 的“规则手册”。先看速查表,再逐条看**代码示例 → 真实渲染 → 编译后的 TSX(示意)**。

::: tip 前置
页面动态能力来自三个机制:
1. `<script>` 里的 **page-scope 状态**(注入到 `Page()` 函数体,正文 JSX(`<>{…}</>` 等)与其共享);
2. `<script>` 具名导出的**组件**(`<Counter />`);
3. 正文/容器中的 **JSX 区域**(原样恢复,由 React/oxc 编译)。
:::

## 0. 规则速查表

| 写法/位置 | 处理结果 |
| --- | --- |
| 普通正文(含 `{x}`、`{{x}}`、CSS 片段 `.a { … }`) | 字符串字面量:一律按**字面文本**原样显示,不求值、不报错 |
| 正文 `<>{expr}</>`(Fragment) | **显式 JSX**:求值并渲染(引用 page-scope 绑定 `{count}`、纯字面 `{1 + 1}`、任意 JS);可独立成行或嵌在句子中间 |
| 正文 `<Comp />` / `::: react` / 独立标签行 | React 接管:原样恢复成 JSX 编译(见 §3/§4) |
| 字面花括号(想显示 `{x}` 本身) | **直接写即可**:`{x}` 就是字面文本;`\{` 退化为 md 默认显示 `{`,不再承担语义 |
| 独立成行的 `<标签 …>` 块 | React 接管:整行(可跨行配平)占位 → 原样恢复成 JSX |
| 正文行内的 `<b>`/`<Badge/>`/`<>{x}</>` | React 接管:同句片段占位 → 恢复成 JSX(片段前后文字仍是普通 md) |
| ATX 标题行内的标签(`## 标题 <Badge/>`) | **不接管**:markdown-it + anchor 生成干净 id 与大纲纯文本;已知组件名由序列化器还原(标题内不支持 `<>{expr}</>` 动态) |
| `::: react … :::` 容器 | 任意多行 JSX(含 `items.map(...)` 表达式),原样交给 React |
| Vue 指令(`:members`/`@click`/`#slot`/`v-*`) | **不接管**,退回旧 HTML→JSX 路径(丢弃并提示) |
| 代码 fence / 行内代码 | 字面量,永不求值/接管 |
| `<script>` | import/具名导出 → 模块顶层;其余(useState 等)→ `Page()` 体 |
| attrs 加类/id | `{#id}` / `{.class}`(分隔符已恢复花括号,与上游一致) |

**React 接管意味着属性按 JSX 写**:`class` → `className`,`style` → 对象,事件 → 驼峰函数(`onClick`)。写错即作者语法错误,oxc 报错并带 md 行号注释。

## 1. page-scope 状态 + 正文 Fragment

### 代码(写在 md 中)

````md
<script>
import { useState } from 'react'

const [count, setCount] = useState(10)
</script>

当前计数: <>{count}</>

<button onClick={() => setCount(count + 1)}>+1</button>
````

### 真实渲染

<script>
import { useState } from 'react'

const [count, setCount] = useState(10)
const items = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' }
]
</script>

当前计数: <>{count}</>

<button onClick={() => setCount(count + 1)}>+1</button>

### 编译后的 TSX(示意)

```tsx
// 模块顶层(import / 具名导出)
import { useState } from 'react'

export default function Page() {
  // ---- page scope(script 中非 import/export 的语句)----
  const [count, setCount] = useState(10)
  const items = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
    { id: 3, name: 'Gamma' }
  ]

  return (
    <div className="vp-doc">
      <p>{/* JSX md:… */}当前计数: <>{count}</></p>
      <p>
        <button onClick={() => setCount(count + 1)}>+1</button>
      </p>
    </div>
  )
}
```

要点:`const [count, setCount] = useState(10)` 注入 **Page() 函数体**,正文 `<>{count}</>`、`onClick` 引用的是同一份闭包状态 → 点击按钮即响应式重渲染。

## 2. 正文 `<>{expr}</>` 显式求值;裸 `{…}` 一律字面

- **裸 `{…}` 是字面文本**:正文里 `{count}`、`{1 + 1}`、`{{…}}`、CSS 片段 `.a { color: red }` 都按原样显示,不求值、不报错,也不需要转义;
- **要动态值就显式包 Fragment**:`<>{count}</>`、`<>{fmt(x)}</>`、`<>{items.length > 0 ? '有' : '无'}</>`——引用 page-scope/module 绑定或任意 JS,与 React 组件内写 JSX 一致;
- **attrs 恢复花括号**:给元素加类/id 用 `{#id}` / `{.class}`;留意别把段落/标题**末尾**的字面 `{…}` 写在会被 attrs 消费的位置(与上游 VitePress 行为一致)。

**示例与真实渲染**

```md
1 + 1 = <>{1 + 1}</>,计数 = <>{count}</>

字面 {x} 与 {{双写}} 都原样显示
```

1 + 1 = <>{1 + 1}</>,计数 = <>{count}</>

字面 {x} 与 {{双写}} 都原样显示

编译后(示意):该段文本会输出成

```tsx
<p>
  {'1 + 1 = '}
  <>{1 + 1}</>
  {', 计数 = '}
  <>{count}</>
</p>
<p>{'字面 {x} 与 {{双写}} 都原样显示'}</p>
```

::: tip 想展示字面花括号?
直接写 `{x}` 即可——正文的 `{…}` 本来就是字面文本,不需要转义或双写;`\{` 退化为 Markdown 默认行为(显示 `{`)。唯一的注意点是**段落/标题末尾**的 `{…}` 可能被 attrs 当作 `{#id}`/`{.cls}` 消费(同上游),必要时调整措辞或把字面 `{…}` 放到句子中间。
:::

## 3. 独立标签行 / 行内标签(React 接管)

- 独立成行:只要该行以 `<` 开头且是完整标签块(可跨行配平),整块占位后**原样恢复为 JSX**;
- 行内:一句话里出现 `<b>`、`<Badge …/>` 等同样被接管。

**代码(写在 md 中)**

```html
行内接管: <b>加粗</b> 与 <Badge type="tip" text="new" /> 都生效。
```

**真实渲染**

行内接管: <b>加粗</b> 与 <Badge type="tip" text="new" /> 都生效。

**编译后的 TSX(示意)**

```tsx
// 自动注入:import { VPBadge as Badge } from '@10coding/vitepress-react/theme'
<p>
  {'行内接管: '}
  <b>{'加粗'}</b>
  {' 与 '}
  <Badge type="tip" text="new" />
  {' 都生效。'}
</p>
```

说明:普通 HTML 标签(`<b>`)与主题组件(`<Badge>`/`<VPTeamMembers>`…)都按 JSX 编译;组件会从 `vitepress/theme` 自动导入。

**标题行例外**:`## 标题 <Badge type="tip" text="new" />` 这类 **ATX 标题行不整行接管**——整行占位会让占位串漏进 anchor 插件生成的 heading id(如 `#标题-vp-html-4`)与 aria-label。标题由 markdown-it + anchor 处理(id 干净、大纲只取纯文本),已知组件名再由序列化器还原成 JSX 组件(自定义组件需 `<script>` 顶层 import,主题标签如 `Badge` 会自动导入)。代码与实时示例见 [在标题中使用组件](./using-react#using-components-in-headers)。

## 4. `::: react` 容器(多行 JSX)

需要**跨多行、含 JS 表达式**的 JSX 时,用容器把区域隔离,内容对 markdown-it 完全不透明:

### 代码(写在 md 中)

````md
::: react
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
:::
````

### 真实渲染

::: react
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
:::

### 编译后的 TSX(示意)

```tsx
export default function Page() {
  const items = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
    { id: 3, name: 'Gamma' }
  ]

  return (
    <div className="vp-doc">
      {/* JSX md:<行> */}
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

::: tip 为什么有真实 `<ul>` 而没有 `<p>` 包裹
块级占位在 md-it 眼里是一行 `<div data-vp-jsx="…">`(`html_block`,不会被包进段落),序列化器遇到它直接注入原始 JSX——所以 `<ul>` 是真正的块级节点。
:::

## 5. 何时**不**接管(保留字面 / 退回旧路径)

| 场景 | 结果 |
| --- | --- |
| 代码块/行内代码 | 字面展示,示例请这样写 |
| Vue 指令语法(`:members`、`@click`、`<template #slot>`、`v-if`) | 不接管,退回旧 HTML→JSX 路径并给出提示(避免把 Vue 语法当 JSX 编译) |
| `<script>`/`<style>` | 走 plugin-sfc 提取(组件/page-scope/样式注入),不当作 JSX 区域 |
| `<style scoped>` / `*.scoped.css` 导入 | 也不是 JSX 区域:属于**页面级 scoped 样式**方案(需 `themeConfig.markdownScopedCss`,见 [md 页面 scoped 样式](./md-scoped-demo)) |

因此本文的“代码示例”均放在代码 fence 里;真正的 live 演示放在正文/容器里。

## 6. 错误定位

JSX 区域恢复时会在源码前插入:

```tsx
{/* JSX md:12 */}   {/* ← oxc 报错时提示来自 md 第 12 行附近 */}
```

再结合编译错误里的 `page.md.tsx` 行列,即可回到原 md 定位:

```text
[PARSE_ERROR] Unexpected token
   ╭─[ page.md.tsx:…:… ]
```

::: warning SSR 兼容性
所有 live 代码都要兼容 SSR:避免在组件/Page 顶层读写 `window`/`document`;浏览器专属逻辑放 `useEffect` 或客户端专属组件里。
:::
