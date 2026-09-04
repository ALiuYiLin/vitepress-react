---
description: 在 VitePress React 版的 Markdown 文件中编写 React 组件与表达式,让静态内容获得交互能力。
---

# 在 Markdown 中使用 React {#using-react-in-markdown}

在本 React 版 VitePress(vitepress-react)中,每个 Markdown 文件都会被编译成静态 HTML,再经 JSX 序列化器生成页面组件。正文里的**普通文本与 HTML 是字面量**:不存在 Vue 版的 `{{ }}` 插值、指令或 `v-pre`。要加入动态能力,使用 `<script>` 块编写 React 组件/表达式。

::: tip SSR 兼容性
所有用法都要兼容 SSR。避免在组件顶层直接读写 `window` / `document`,浏览器专属逻辑请放进 `useEffect` 或客户端专属封装里。参见 [SSR 兼容性](./ssr-compat)。
:::

## 正文求值规则 {#templating}

Vue 版文档里的 `{{ }}` 在这里不存在。**单层 `{…}`** 按下列规则处理:

- **求值为 JSX 表达式**,当它
  - 引用了 `<script>` 里的绑定(例如 `{count}`、`{fmt(page.title)}`),或
  - 是纯数值/字面量表达式(例如 `{1 + 1}`、`{'hi'}`);
- **保持为字面花括号文本**,当它
  - 含中文(如 `{统计}`),
  - 含顶层逗号/分号(如 `{1, 2}` 这类列举),
  - 是 attrs 语法(`{#id}` / `{.class}`,交给 `@mdit/plugin-attrs`)。

例如:

**输入**

```md
{1 + 1}
```

**输出**

```text
2
```

想显示"看起来像模板"的字面 `{…}` 文本,把它放进**行内代码**或使用含中文/序列的内容即可;代码块天然字面,无需转义。

## `<script>` 块:组件与页面作用域 {#script-and-style}

根级 `<script>` 块放在 frontmatter **之后**。块内容按两种位置编译:

- **import 语句与具名导出(`export function/const`)** → 提升到模块顶层,可作为正文组件标签(`<Counter />`)使用;
- **其余语句(含 `useState`/`useEffect` 与普通变量)** → 注入到页面组件 `Page()` 函数体内,和正文 `{…}` 表达式**共享同一作用域**。

因此正文里的 `{count}` 和你在 script 里声明的 `useState` 是同一份状态:

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

**说明**:`count` 随 `setCount`/`useEffect`/路由数据更新而**响应式重渲染**;它等价于把这段代码写进一个 React 组件函数再返回 JSX。

### 直接在正文写一行 JSX {#inline-jsx}

独立成行、**含 `={` 的 HTML 标签**会被当作真正的 JSX 处理(整行先占位、渲染后恢复给 oxc 编译),因此 `onClick={…}` 事件与 `{expr}` 绑定都会生效。

下面的计数就同时用到了 page-scope 的 `{count}` 显示与"直接写 JSX 行"的按钮:

**实际渲染**

<script>
import { useState } from 'react'

const [count, setCount] = useState(100)
</script>

当前计数: {count}

<button onClick={() => setCount(count + 1)}>+1</button>

写成 Markdown 就是:

```md
<script>
import { useState } from 'react'

const [count, setCount] = useState(100)
</script>

当前计数: {count}

<button onClick={() => setCount(count + 1)}>+1</button>
```

**注意**:page-scope 的 script 要先声明 `setCount`,`onClick` 才能引用到它;交互更复杂时仍建议用具名组件(见上文 `<Counter />`)。

不含 `={` 的普通 HTML(如 `<b>bold</b>`、`<Badge type="tip" text="x" />`)仍走 HTML→JSX 序列化:属性保持字符串;`<Badge>` 会自动从主题导入。

### 在 Markdown 中导入并使用组件 {#using-components}

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

### 在标题中使用组件 {#using-components-in-headers}

可以在标题中放组件,但解析出的标题只取纯文本:

| Markdown                                        | 解析出的标题 |
| ----------------------------------------------- | ------------ |
| `# 文档 <Badge type="info" text="new" />`       | `文档`       |
| `# 文档 \`<Badge/>\``                           | `文档 <Badge/>` |

`<code>` 里的内容不会被解析成组件。

## 代码块与指令 {#code-blocks}

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

Vue 指令(`v-if`、`v-pre`、`@click`、`:class` 等)不属于 React:序列化时会剔除或按字面处理并给出提示,请不要依赖。

## 样式与客户端专属内容 {#styles-and-client-only}

::: warning 根级 `<style>` 是全局的
本 React 版没有 Vue SFC 的 `<style module>` / `<style scoped>` 语义。Markdown 里的 `<style>` 按普通 HTML 输出为全局样式;需要局部作用域样式时,请在组件文件里使用 CSS Modules 或内联样式。
:::

VitePress [内置支持](https://cn.vite.dev/guide/features.html#css-pre-processors) CSS 预处理器(`.scss`、`.sass`、`.less`、`.styl`、`.stylus`),在组件文件(如 `Counter.tsx` 旁的 `Counter.module.scss`)中按 Vite 常规方式使用即可。

组件在 SSR 与浏览器都会渲染。需要"只在浏览器出现"的内容(读取 `window`、用 portal 挂到 `body`),把副作用放进 `useEffect` 或借助 `ClientOnly` 延迟渲染:

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
