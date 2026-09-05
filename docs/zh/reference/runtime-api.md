---
description: VitePress（React fork）运行时 API 参考，包括 hooks、辅助方法与内置组件。
---

# 运行时 API {#runtime-api}

VitePress 提供若干内置 API 以访问站点/页面数据，并内置少量组件。它们统一从 `vitepress` 导入，用于自定义主题组件，也可以在 `.md` 页面内使用（在 `<script>` 里导入）。

以 `use*` 开头的是 **React hooks**：只能在 React 组件体内或 md 页面的 `<script>`（编译进 `Page()` 作用域）里调用，不能在模块顶层执行。

## `useData` <Badge type="info" text="hook" />

返回当前页面的数据快照（**普通值，不是 Ref 包装**）。返回对象具有以下类型：

```ts
interface VitePressData<T = any> {
  /** 站点级元数据 */
  site: SiteData<T>
  /** .vitepress/config.js 中的 themeConfig */
  theme: T
  /** 页面级元数据 */
  page: PageData
  /** 页面 frontmatter */
  frontmatter: PageData['frontmatter']
  /** 动态路由参数 */
  params: PageData['params']
  title: string
  description: string
  lang: string
  isDark: boolean
  dir: string
  localeIndex: string
}

interface PageData {
  title: string
  titleTemplate?: string | boolean
  description: string
  relativePath: string
  filePath: string
  headers: Header[]
  frontmatter: Record<string, any>
  params?: Record<string, any>
  isNotFound?: boolean
  lastUpdated?: number
}
```

**在主题组件中使用：**

```tsx [.vitepress/theme/SomeWidget.tsx]
import { useData } from 'vitepress'

export function SomeWidget() {
  const { theme } = useData()
  return <h1>{theme.footer.copyright}</h1>
}
```

**在 md 页面中使用（page-scope）：**

```md
<script>
import { useData } from 'vitepress'

const { theme } = useData()
</script>

页脚版权：{theme.footer.copyright}
```

## `useRoute` <Badge type="info" text="hook" />

返回当前路由对象（普通值）：

```ts
interface Route {
  path: string
  hash: string
  query: string
  data: PageData
  component: ComponentType | null
}
```

## `useRouter` <Badge type="info" text="hook" />

返回路由实例，以便编程式导航。

```ts
interface Router {
  route: Route
  /** 导航到新 URL */
  go: (to: string) => Promise<void>
  onBeforeRouteChange?: (to: string) => Awaitable<void | boolean>
  onBeforePageLoad?: (to: string) => Awaitable<void | boolean>
  onAfterPageLoad?: (to: string) => Awaitable<void>
  onAfterRouteChange?: (to: string) => Awaitable<void>
}
```

## `withBase` <Badge type="info" text="helper" />

- **Type**: `(path: string) => string`

把配置的 [`base`](./site-config#base) 追加到给定 URL 路径。另见 [Base URL](../guide/asset-handling#base-url)。

## `<Content />` <Badge type="info" text="component" />

渲染当前页面的 markdown 内容，在[创建自定义主题](../guide/custom-theme)时使用：

```tsx
import { Content } from 'vitepress'

export default function Layout() {
  return (
    <>
      <h1>Custom Layout!</h1>
      <Content />
    </>
  )
}
```

## `<ClientOnly />` <Badge type="info" text="component" />

只在客户端渲染其 children。

站点在构建时于 Node.js 中服务端渲染，因此任何代码都须 SSR 安全——浏览器/DOM 访问请放在 `useEffect` 或 `ClientOnly` 内（见 [SSR 兼容性](../guide/ssr-compat)）：

```md
<ClientOnly>
  <BrowserOnlyWidget />
</ClientOnly>
```

在自定义主题/组件里也可以这样用：

```tsx
import { ClientOnly } from 'vitepress'

export function Demo() {
  return (
    <ClientOnly>
      <BrowserOnlyWidget />
    </ClientOnly>
  )
}
```

## frontmatter / 参数（在页面中读取） {#data-access}

Vue 版曾经提供的 `$frontmatter` / `$params` 模板全局与 `{{ }}` 插值在本 fork 不再可用。请在页面 `<script>` 的 page-scope 中通过 `useData()` 读取后，用正文 `{expr}` 引用——示例见 [frontmatter](../guide/frontmatter#accessing-frontmatter-data) 与[路由参数](../guide/routing#accessing-params-in-page)。
