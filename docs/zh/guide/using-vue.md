---
description: 在 VitePress React 版的 Markdown 文件中编写 React 组件,让静态内容获得交互能力。
---

# 在 Markdown 中使用 React {#using-react-in-markdown}

在本 React 版 VitePress(vitepress-react)中,每个 Markdown 文件都会被编译成静态 HTML,再经过 JSX 序列化器生成页面。**正文里的文本与 HTML 都是字面量**:不存在 Vue 版的 `{{ }}` 插值、指令或 `v-pre`,文本表达式不会在运行时求值。

要在页面中加入交互逻辑,可以在 Markdown 里放一个 `<script>` 块,**用 React 编写并导出组件**,然后在正文中以大写开头的标签(如 `<Counter />`)引用。序列化器会把命中的组件名解析成真实组件。

::: tip SSR 兼容性
所有组件用法都要兼容 SSR。避免在组件顶层直接读写 `window` / `document`,浏览器专属逻辑请放进 `useEffect` 或客户端专属封装里。参见 [SSR 兼容性](./ssr-compat)。
:::

## 文本与 HTML 都是字面量 {#templating}

Vue 版文档里的插值语法在这里**不会求值**,会原样显示为文本:

**输入**

```md
{{ 1 + 1 }}
```

**输出**

<script>
const [count, setCount] = useState(100) 
</script>
# Count demo: {count}

{1+1}

内联 HTML 同样按字面输出;Vue 指令(`v-if`、`v-pre`、`@click`、`:class` 等)不属于 React,请勿在页面中依赖它们(序列化时会按字面处理或剔除并给出提示)。

## `<script>` 块:编写页面组件 {#script-and-style}

根级 `<script>` 块放在 frontmatter **之后**。块内顶层 `import`、`function` / `const` 声明的 **PascalCase 组件**都可以在正文中直接引用:

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

<Counter />

在组件里同样可以读取 VitePress 运行时数据,例如 [`useData`](../reference/runtime-api#usedata):

**输入**

````md
<script>
import { useData } from 'vitepress'

export function PageTitle() {
  const { page } = useData()
  return <p>当前页面: {page.title}</p>
}
</script>

<PageTitle />
````

::: warning 根级 `<style>` 是全局的
本 React 版没有 Vue SFC 的 `<style module>` / `<style scoped>` 语义。Markdown 里的 `<style>` 会按普通 HTML 输出为全局样式;需要局部作用域样式时,请在组件文件里使用 CSS Modules 或内联样式。
:::

## 使用组件 {#using-components}

### 在 Markdown 中导入组件 {#importing-in-markdown}

如果某个组件只在少数页面使用,建议在使用它的页面里显式导入,这样它能被正确代码分割、仅在相关页面加载:

````md
<script>
import CustomComponent from '../../components/CustomComponent.tsx'
</script>

# Docs

This is a .md using a custom component

<CustomComponent />
````

### 注册全局组件 {#registering-components-globally}

如果组件要在绝大多数页面使用,可以在自定义主题/布局层统一包装与注入。相关做法参见[扩展默认主题](./extending-default-theme)。

::: warning 重要
确保自定义组件的名称是 **PascalCase**,并且出现在 `<script>` 块的具名导出中。否则序列化器无法把它识别为组件。
:::

### 在标题中使用组件 {#using-components-in-headers}

可以在标题中放组件,但请注意解析出的标题只取纯文本:

| Markdown                                      | 解析出的标题 |
| --------------------------------------------- | ------------ |
| `# 文档 <Badge type="info" text="new" />`     | `文档`       |
| `# 文档 \`<Badge/>\``                         | `文档 <Badge/>` |

标题解析与 HTML 渲染由不同环节完成(标题用于侧边栏与文档大纲),`<code>` 里的内容不会被解析成组件。

## 转义 {#escaping}

不需要特意转义:正文是字面量,`{{ }}`、`<div>` 等按书写内容原样输出。想给读者展示一段"看起来像模板"的文本,直接写即可:

```text
{{ will be displayed as-is }}
```

## 代码块 {#code-blocks}

代码块天然是字面量,不需要任何 `v-pre` 包装:

**输入**

````md
```text
Hello {{ 1 + 1 }}
```
````

**输出**

```text
Hello {{ 1 + 1 }}
```

## 使用 CSS 预处理器 {#using-css-pre-processors}

VitePress [内置支持](https://cn.vite.dev/guide/features.html#css-pre-processors) CSS 预处理器(`.scss`、`.sass`、`.less`、`.styl`、`.stylus`)。无需安装 Vite 专用插件,但需要安装对应的预处理器:

```bash
# .scss / .sass
npm install -D sass

# .less
npm install -D less

# .styl / .stylus
npm install -D stylus
```

在组件文件(如 `Counter.tsx` 旁的 `Counter.module.scss`)与主题中按 Vite 常规方式使用即可。

## 客户端专属内容与 Portals {#client-only-and-portals}

组件在 SSR 与浏览器都会渲染。需要"只在浏览器出现"的内容(例如读取 `window`、用 portal 挂到 `body`)时,请把副作用放进 `useEffect`,或借助 `ClientOnly` 延迟到客户端渲染:

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

<script>
import { useState } from 'react'

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

记住:所有客户端专属代码都要兼容 SSR——如果它在服务端抛错,站点构建会失败。
