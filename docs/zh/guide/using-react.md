---
description: '在 VitePress React 版的 Markdown 文件中编写 React 组件与表达式:字面/动态边界、script 块、react 容器、样式与客户端专属内容。'
outline: deep
---

# 在 Markdown 中使用 React {#using-react-in-markdown}

在本 React 版 VitePress(vitepress-react)中,每个 Markdown 文件都会被编译成静态 HTML,再经 JSX 序列化器生成页面组件。正文(含 `{…}`、`{{…}}`)与 HTML 一律是**字面量**,与标准 Markdown / 上游 VitePress 一致;不存在 Vue 版的 `{{ }}` 插值、指令或 `v-pre`,也不需要转义。

页面动态能力来自三个机制,先用 §0 速查表给结论,再逐条看**代码示例 → 真实渲染 → 编译后的 TSX(示意)**:

::: tip 三个机制
1. `<script>` 里的 **page-scope 状态**(注入到 `Page()` 函数体,正文 JSX(`<>{…}</>` 等)与其共享);
2. `<script>` 具名导出的**组件**(`<Counter />`);
3. 正文/容器中的 **JSX 区域**(原样恢复,由 React/oxc 编译)。
:::

::: tip SSR 兼容性
所有用法都要兼容 SSR。避免在组件顶层直接读写 `window` / `document`,浏览器专属逻辑请放进 `useEffect` 或客户端专属封装里。参见 [SSR 兼容性](./ssr-compat)。
:::

## 0. 规则速查表

| 写法/位置 | 处理结果 |
| --- | --- |
| 普通正文(含 `{x}`、`{{x}}`、CSS 片段 `.a { … }`) | 字符串字面量:一律按**字面文本**原样显示,不求值、不报错 |
| 正文 `<>{expr}</>`(Fragment) | **显式 JSX**:求值并渲染(引用 page-scope 绑定 `{count}`、纯字面 `{1 + 1}`、任意 JS);可独立成行或嵌在句子中间 |
| 字面花括号(想显示 `{x}` 本身) | **直接写即可**:`{x}` 就是字面文本;`\{` 退化为 md 默认显示 `{`,不再承担语义 |
| 独立成行的 `<标签 …>` 块 | React 接管:整行(可跨行配平)占位 → 原样恢复成 JSX |
| 正文行内的 `<b>`/`<Badge/>`/`<>{x}</>` | React 接管:同句片段占位 → 恢复成 JSX(片段前后文字仍是普通 md) |
| ATX 标题行内的标签(`## 标题 <Badge/>`) | **不整行接管**:markdown-it + anchor 生成干净 id 与大纲纯文本;已知组件名由序列化器还原(标题内不支持 `<>{expr}</>` 动态) |
| `::: react … :::` 容器 | 任意多行 JSX(含 `items.map(...)` 表达式),原样交给 React |
| Vue 指令(`:members`/`@click`/`#slot`/`v-*`) | **不接管**,退回旧 HTML→JSX 路径(丢弃并提示) |
| 代码 fence / 行内代码 | 字面量,永不求值/接管 |
| `<script>` | import/具名导出 → 模块顶层;其余(useState 等)→ `Page()` 体 |
| `<style scoped>` / `*.scoped.css` 导入 | 不是 JSX 区域:页面级 scoped 样式方案,见 [md 页面 scoped 样式](./md-scoped-demo) |
| attrs 加类/id | `{#id}` / `{.class}`(分隔符为花括号,与上游一致) |

**React 接管意味着属性按 JSX 写**:`class` → `className`,`style` → 对象,事件 → 驼峰函数(`onClick`)。写错即作者语法错误,oxc 报错并带 md 行号注释(见 §9)。

## 1. 正文字面与 JSX 动态 {#templating}

Vue 版文档里的 `{{ }}` 在这里不存在,正文也**不做 `{expr}` 求值**——正文里的花括号一律按字面输出:

- `{count}`、`{{x}}`、`\{x\}`、CSS 片段 `.a { color: red }` 都是**字面文本**,分别原样显示 `{count}` / `{{x}}` / `{x}`,不报错、不需要转义;
- 要显示动态内容,显式包成 JSX Fragment:**`<>{count}</>`**、**`<>{fmt(page.title)}</>`**、`<>{items.length > 0 ? '有' : '无'}</>`,可独立成行,也可嵌在句子中间;
- 完整交互(带状态/事件)仍写组件标签 `<Counter />`(见 §2)。

::: tip 两个常见坑
- Fragment 标签必须是无空格开标签 `<>`、带斜杠的闭标签 `</>`;写成 `< >…` 或漏掉 `/`(如只写 `<>` 收尾)都不会被识别,整行会按**字面文本**原样输出。
- `<>{expr}</>` 里只能放可渲染值(字符串/数字/元素/数组);`useData()` 返回的 `theme`/`page`/`frontmatter` 是**对象**,直接放 `<>{data.theme}</>` 会整页崩溃(React: "Objects are not valid as a React child")。要看对象请 `JSON.stringify` 包一层,或只取标量字段:
  `<>{JSON.stringify(data.theme)}</>` / `<>{data.theme.title}</>`
:::

**输入 / 输出对比**

输入:

```md
{1 + 1}          ← 字面文本
<>{1 + 1}</>     ← JSX 表达式
```

输出:

{1 + 1}          ← 字面文本

<>{1 + 1}</>     ← JSX 表达式

`{统计}`、`{#foo}`、`{.cls}` 这类写法也是**字面文本**,原样显示;给元素加类/id 用 attrs 语法 `{#id}` / `{.class}`(见 [md 页面 scoped 样式](./md-scoped-demo))。唯一注意点是**段落/标题末尾**的 `{…}` 可能被 attrs 当作 `{#id}`/`{.cls}` 消费(同上游行为):想展示字面花括号时,把它放到句子中间即可。

## 2. `<script>` 块:组件与页面作用域 {#script-and-style}

根级 `<script>` 块放在 frontmatter **之后**。块内容按两种位置编译:

- **import 语句与具名导出(`export function/const`)** → 提升到模块顶层,可作为正文组件标签(`<Counter />`)使用;
- **其余语句(含 `useState`/`useEffect` 与普通变量)** → 注入到页面组件 `Page()` 函数体内,和正文 JSX(`<>{…}</>`、`::: react`)共享同一作用域。

因此正文 `<>{count}</>` 里引用的 `count` 和你在 script 里声明的 `useState` 是同一份状态。注意交互更复杂时仍建议用具名组件封装状态逻辑。

### 2.1 具名导出组件:`<Counter />`

**输入**

````md
<script>
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>count: {count}</button>
}
</script>

## Markdown Content

<Counter />
````

**输出(实际渲染)**

<script>
// useState 由本文 §2.2 的真实 page-scope 脚本 import(import 提升到模块顶层,
// 全模块可见),这里只做具名导出
export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button
      style={{ border: '1px solid var(--vp-c-brand-1)', borderRadius: 8, padding: '4px 14px', cursor: 'pointer' }}
      onClick={() => setCount(count + 1)}
    >
      count: {count}
    </button>
  )
}
</script>

<Counter />

### 2.2 page-scope 状态 + 正文 `<>{expr}</>`

下面的实时计数把 `useState` 写在 **page-scope**(非具名导出),正文用 `<>{count}</>` 显示、直接写 JSX 按钮行:

**输入**

````md
<script>
import { useState } from 'react'

const [count, setCount] = useState(0)
const items = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' }
]
</script>

当前计数: <>{count}</>

<button onClick={() => setCount(count + 1)}>+1</button>
````

**输出(实际渲染)**

<script>
import { useState } from 'react'

const [count, setCount] = useState(0)
const items = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' }
]
</script>

当前计数: <>{count}</>

<button onClick={() => setCount(count + 1)}>+1</button>

**编译后的 TSX(示意)**

```tsx
// 模块顶层(import / 具名导出)
import { useState } from 'react'

export default function Page() {
  // ---- page scope(script 中非 import/export 的语句)----
  const [count, setCount] = useState(0)
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

要点:`useState` 的返回数组注入 **Page() 函数体**,正文 `<>{count}</>`、`onClick` 引用的是同一份闭包状态 → 点击按钮即响应式重渲染;它等价于把这段代码写进一个 React 组件函数再返回 JSX。上面声明的 `items` 会在 §5 的 `::: react` 示例中复用(page-scope 对本页所有正文可见)。

## 3. 正文里的标签行与行内 JSX {#inline-jsx}

- **独立成行、以 `<` 开头的 HTML 标签或 React 组件行**:整行占位(可跨行配平),渲染后原样恢复成 JSX 交给 React/oxc 编译——不区分是否含 `={`。
- **句子中间**:想要动态值或标签,显式写 Fragment 或标签片段,如 `温度: <>{temp}°C</>`、`行内 <b>加粗</b>`;片段前后的文字仍是普通 Markdown。
- **只有被 `<…>`/`<>…</>` 显式包住的内容按 JSX 求值**;正文其余位置的裸 `{…}` 都是字面文本。
- JSX 属性要按 JSX 写(`class` → `className`、`style` → 对象、事件用驼峰函数)。

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

普通 HTML 标签(`<b>`)与主题组件(`<Badge>`/`<VPTeamMembers>`…)都按 JSX 编译;组件会从 `vitepress/theme` 自动导入。含 Vue 指令(`:members`、`@click`、`<template #slot>`)的行不属于 React 接管范围,仍按旧 HTML 路径处理并提示(见 §7)。

::: tip 多行 / 含 JS 表达式的 JSX 块
正文的标签行规则只处理“整行可配平”的情况;需要跨多行、含表达式(如 `items.map(...)`)时,请用 [`::: react` 容器](#react-container)包裹(内容对 markdown-it 完全不透明、原样交给 React)。
:::

### 3.1 在标题中使用组件 {#using-components-in-headers}

可以在标题中放组件,但解析出的标题只取纯文本:

| Markdown                                        | 解析出的标题 |
| ----------------------------------------------- | ------------ |
| `# 文档 <Badge type="info" text="new" />`       | `文档`       |
| `# 文档 \`<Badge/>\``                           | `文档 <Badge/>` |

`<code>` 里的内容不会被解析成组件。

**标题里不支持 `<>{expr}</>` 动态**:anchor id、aria-label、大纲文本都在编译期由纯文本生成,标题内只放组件标签;需要动态值时,把 `<>{expr}</>` 写在标题下方的正文里。ATX 标题行**不整行占位**——否则占位串会漏进 anchor 生成的 heading id(如 `#标题-vp-html-4`)与 aria-label;标题由 markdown-it + anchor 处理(id 干净、大纲只取纯文本),已知组件名再由序列化器还原成 JSX 组件(自定义组件需 `<script>` 顶层 import,主题标签如 `Badge` 会自动导入)。

等价于 Vue 版 `docs/components/ComponentInHeader.vue` 的最小组件
`docs/components/ComponentInHeader.tsx` 就放在 docs 里,import 后即可用:

````md
<script>
import ComponentInHeader from '../../components/ComponentInHeader.tsx'
</script>

#### 把组件放进标题 <ComponentInHeader />
````

实时效果:

<script>
import ComponentInHeader from '../../components/ComponentInHeader.tsx'
</script>

#### 把组件放进标题 <ComponentInHeader />

上面标题里的 ⚡ 就是 `ComponentInHeader`;大纲标题只取纯文本,不含组件内容。

## 4. 导入与复用组件 {#using-components}

如果组件只被少数页面使用,可以在页面的 `<script>` 里显式导入(可正确代码分割):

````ts
<script>
import CustomComponent from '../../components/CustomComponent.tsx'
</script>

# Docs

This is a .md using a custom component

<CustomComponent />
````

如果组件在绝大多数页面使用,可以在自定义主题/布局层统一包装与注入,参见[扩展默认主题](./extending-default-theme)。

::: warning 重要
自定义组件标签名必须 **PascalCase** 且出现在 `<script>` 顶层(import 或具名导出),否则序列化器无法解析成组件。
:::

默认主题也导出可直接用的组件(`VPBadge`、`VPTeamMembers`、`VPTeamPage` 等),甚至文档里裸写 `<Badge type="tip" text="new" />` 这类 Vue 全局注册标签,编译时会自动从 `vitepress/theme` 导入。

## 5. 多行 JSX:`::: react` 容器 {#react-container}

需要**跨多行、含 JS 表达式**的 JSX(如 `items.map(...)`)时,用容器把区域隔离,内容对 markdown-it 完全不透明:

**代码(写在 md 中)**

````md
::: react
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
:::
````

**真实渲染**

::: react
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
:::

**编译后的 TSX(示意)**

```tsx
export default function Page() {
  // page scope 提供 items(见 §2.2)
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

## 6. 代码块与指令 {#code-blocks}

代码块天然是字面量,不需要 `v-pre` 包装:

**输入**

````md
```text
Hello {1 + 1}
```
````

**输出**

```text
Hello {1 + 1}
```

代码 fence / 行内代码里的任何内容都**永不求值、不接管**;想展示字面 JSX 代码,请这样写。

## 7. 何时**不**接管(保留字面 / 退回旧路径)

| 场景 | 结果 |
| --- | --- |
| 代码块 / 行内代码 | 字面展示(§6) |
| Vue 指令语法(`:members`、`@click`、`<template #slot>`、`v-if`) | 不接管,退回旧 HTML→JSX 路径并给出提示(避免把 Vue 语法当 JSX 编译) |
| `<script>` | 走 plugin-sfc 提取(组件/page-scope),不当作 JSX 区域(§2) |
| `<style>` / `<style scoped>` / `*.scoped.css` 导入 | 不是 JSX 区域:全局样式运行时注入;页面级 scoped 样式见 [md 页面 scoped 样式](./md-scoped-demo) |

## 8. 样式与客户端专属内容 {#styles-and-client-only}

- **全局样式**:不带 `scoped` 的根级 `<style>` 仍是全局样式(运行时注入全站)。
- **页面级 scoped 样式**:想要 Vue-like 的页面级作用域时,用 `<style scoped>` 内联块或导入 `*.scoped.css`——在站点配置开 `themeConfig.markdownScopedCss: true` 并注册 `jsxScopedVitePlugin()`(本示例站点已开启),编译后选择器带 `[data-v-{hash}]` 只作用于对应页面。用法与实时示例见 [md 页面 scoped 样式](./md-scoped-demo)。组件文件内部的局部样式仍用 CSS Modules 或内联样式(Vue SFC 的 `<style module>` 语义不提供)。
- VitePress [内置支持](https://cn.vite.dev/guide/features.html#css-pre-processors) CSS 预处理器(`.scss`、`.sass`、`.less`、`.styl`、`.stylus`),在组件文件(如 `Counter.tsx` 旁的 `Counter.module.scss`)中按 Vite 常规方式使用即可。
- 组件在 SSR 与浏览器都会渲染。需要“只在浏览器出现”的内容(读取 `window`、用 portal 挂到 `body`),把副作用放进 `useEffect` 或借助 `ClientOnly` 延迟渲染:

````md
<script>
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Toast() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(<div className="toast">hello</div>, document.body)
}
</script>

<ClientOnly>
  <Toast />
</ClientOnly>
````

记住:所有客户端专属代码都要兼容 SSR——如果它在服务端抛错,站点构建会失败。

**文件版等价示例**:Vue 版 `ModalDemo.vue`(按钮 + Teleport 弹窗)在 React 里
的等价实现是 `docs/components/ModalDemo.tsx`——用 `createPortal` 挂到
`body`(React 版的 Teleport),样式在 `ModalDemo.css`;弹层默认不渲染,
SSR / 水合安全(Esc 或点遮罩关闭)。页面导入后直接 `<ModalDemo />`:

````md
<script>
import ModalDemo from '../../components/ModalDemo.tsx'
</script>

<ModalDemo />
````

实时效果:

<script>
import ModalDemo from '../../components/ModalDemo.tsx'
</script>

<ModalDemo />

## 9. 出错了怎么办

JSX 区域恢复时会在源码前插入:

```tsx
{/* JSX md:12 */}   {/* ← oxc 报错时提示来自 md 第 12 行附近 */}
```

再结合编译错误里的 `page.md.tsx` 行列,即可回到原 md 定位:

```text
[PARSE_ERROR] Unexpected token
   ╭─[ page.md.tsx:…:… ]
```
