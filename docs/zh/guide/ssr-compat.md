---
outline: deep
description: 确保 VitePress 主题组件和自定义代码兼容服务端渲染 (SSR)。
---

# SSR 兼容性 {#ssr-compatibility}

VitePress 使用 React 的服务端渲染能力，在生产构建期间于 Node.js 中预渲染整个应用。这意味着主题组件、页面 `<script>` 里的组件以及任何自定义代码都要考虑 **SSR 兼容性**。

[React 官方 SSR 文档](https://react.dev/reference/react-dom/server) 介绍了 SSR / SSG 是什么以及如何编写服务端/客户端都能运行的代码。原则非常简单：**只在 effect（`useEffect`/`useLayoutEffect`）里访问浏览器或 DOM API**——服务端预渲染不会执行 effect，因此写在 effect 内的副作用天然 SSR 安全；`<script>` 的 page-scope 代码只放 hooks 调用与纯计算。

::: tip 顶层副作用要谨慎
模块顶层或组件渲染体内的 `window`/`document`/`navigator` 访问会在服务端抛错并导致构建失败。所有浏览器专属逻辑请放进 `useEffect` 或专门的客户端组件（下节）。
:::

## `<ClientOnly>`

如果正在使用或演示不支持 SSR 的组件（例如依赖 `window` 的库、视频/图表组件），可以用内置的 `<ClientOnly>` 把它包起来——内容只在浏览器渲染：

```md
<ClientOnly>
  <BrowserOnlyWidget />
</ClientOnly>
```

`ClientOnly` 在主题与 md 页面里都可直接使用（见[样式与客户端专属内容](./using-react#styles-and-client-only)）。

## 在导入时访问浏览器 API 的库 {#libraries-that-access-browser-api-on-import}

一些库在**模块导入时**就读取 `window`/`document`。要安全使用它们，请延迟到浏览器端再 `import()`。

### 在 effect 中导入 {#importing-in-effect}

页面 `<script>` 里定义组件，把动态导入放进 `useEffect`：

```md
<script>
import { useEffect, useState } from 'react'

export function WindowLibDemo() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    import('./lib-that-access-window-on-import').then((module) => {
      if (alive) {
        setReady(true) // 在这里使用 module
      }
    })
    return () => {
      alive = false
    }
  }, [])

  return ready ? <p>已加载</p> : null
}
</script>

<WindowLibDemo />
```

### 条件导入 {#conditional-import}

也可以使用 `import.meta.env.SSR`（[Vite 环境变量](https://cn.vite.dev/guide/env-and-mode.html#env-and-mode)）在客户端才导入依赖：

```js
if (!import.meta.env.SSR) {
  import('./lib-that-access-window-on-import').then((module) => {
    // 仅浏览器执行
  })
}
```

`Theme.enhanceApp` 可以是异步的（见[构建自定义主题](./custom-theme#theme-interface)），因此也可以在主题入口里做客户端的按需导入：

```ts [.vitepress/theme/index.ts]
import type { Theme } from 'vitepress'

export default {
  // ...
  async enhanceApp({ router }) {
    if (!import.meta.env.SSR) {
      const module = await import('lib-that-access-window-on-import')
      // 例如注册路由钩子 / 启动副作用
    }
  }
} satisfies Theme
```

> 本 fork 没有 Vue 的插件（plugin/`app.use`）概念；对应注册行为通过 `enhanceApp` 或主题组件的 effect 完成。

### 懒加载客户端组件(`React.lazy`) {#lazy-client-components}

VitePress 的 Vue 版提供了 `defineClientComponent` 辅助函数；React fork 用标准的 `React.lazy` + `Suspense` 即可，再配合 `<ClientOnly>` 保证 SSR 不解析该组件：

```md
<script>
import { lazy, Suspense } from 'react'

const ClientComp = lazy(() => import('component-that-access-window-on-import'))
</script>

<ClientOnly>
  <Suspense fallback={null}>
    <ClientComp propA={1}>默认 children</ClientComp>
  </Suspense>
</ClientOnly>
```

给目标组件传 props/children 就是普通的 React 写法；懒加载仅在浏览器首次需要渲染时触发（`ClientOnly` 之外的内容不会在服务端执行到该组件）。
