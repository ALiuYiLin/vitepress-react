---
description: 在 VitePress（React fork）中创建和使用自定义主题，全面控制站点的外观和风格。
---

# 自定义主题 {#using-a-custom-theme}

## 解析主题 {#theme-resolving}

可以通过创建一个 `.vitepress/theme/index.ts` 文件（即“主题入口文件”）来启用自定义主题：

```
.
├─ docs                # 项目根目录
│  ├─ .vitepress
│  │  ├─ theme
│  │  │  └─ index.ts   # 主题入口
│  │  └─ config.ts     # 配置文件
│  └─ index.md
└─ package.json
```

当检测到存在主题入口文件时，VitePress 总会使用自定义主题而不是默认主题。但你可以[扩展默认主题](./extending-default-theme)来在其基础上实现更高级的自定义。

::: tip 本 fork 的主题是 React
主题入口与组件是普通的 `.tsx`（React）文件，构建由 Vite 完成（TSX 自动 JSX runtime，无需额外插件）。不再有 `.vue` 文件或 Vue 应用实例。
:::

## 主题接口 {#theme-interface}

VitePress 自定义主题是一个对象，该对象具有如下接口：

```ts
import type { ComponentType, ReactNode } from 'react'
import type { Router, SiteData } from '@10coding/vitepress-react'

interface Theme {
  /** 每个页面的根布局组件 */
  Layout?: ComponentType<{ children?: ReactNode }>
  /**
   * 在客户端增强应用（可异步；服务端阶段也会在 SSR 中运行，注意 `import.meta.env.SSR`）
   */
  enhanceApp?: (ctx: EnhanceAppContext) => Awaitable<void>
  /** 运行在根组件 effect 中的客户端逻辑（SSR 安全：内部请自行守卫 DOM） */
  setup?: () => void
  /** 扩展另一个主题：先执行其 enhanceApp/setup */
  extends?: Theme
}

interface EnhanceAppContext {
  router: Router // VitePress 路由实例
  siteData: SiteData // 站点级数据
}
```

主题入口文件需要将主题对象作为默认导出来导出：

```ts [.vitepress/theme/index.ts]
import Layout from './Layout.tsx'

export default {
  Layout,
  enhanceApp({ router }) {
    // ...
  }
}
```

默认导出是自定义主题的唯一方式；`Layout` 也是最常用的属性——从技术上讲，一个 VitePress 主题可以只是一个 React 布局组件。注意主题同样需要保证 [SSR 兼容](./ssr-compat)。

## 构建布局 {#building-a-layout}

最基本的布局组件需要渲染 [`<Content />`](../reference/runtime-api#content)，它负责输出当前页面的 markdown 内容：

```tsx [.vitepress/theme/Layout.tsx]
import { Content } from '@10coding/vitepress-react'

export default function Layout() {
  return (
    <div className="vp-layout">
      <h1>Custom Layout!</h1>
      <Content />
    </div>
  )
}
```

上面的布局只是把每个页面的 markdown 渲染为 HTML。我们添加的第一个改进是处理 404 错误：

```tsx [.vitepress/theme/Layout.tsx]
import { Content, useData } from '@10coding/vitepress-react'

export default function Layout() {
  const { page } = useData()

  if (page.isNotFound) {
    return (
      <div className="vp-layout">
        <h1>Custom Layout!</h1>
        <p>Custom 404 page!</p>
      </div>
    )
  }
  return (
    <div className="vp-layout">
      <h1>Custom Layout!</h1>
      <Content />
    </div>
  )
}
```

[`useData()`](../reference/runtime-api#usedata) 提供了全部运行时数据（返回值是当前快照的**普通值**，不是响应式包装），方便根据条件渲染不同布局。另一个常用字段是当前页面的 frontmatter——借助它可以让用户通过 frontmatter 控制每页布局，例如标记某页使用特殊首页布局：

```md
---
layout: home
---
```

主题据此分支渲染：

```tsx [.vitepress/theme/Layout.tsx]
import { Content, useData } from '@10coding/vitepress-react'

export default function Layout() {
  const { page, frontmatter } = useData()

  if (page.isNotFound) {
    return (
      <div className="vp-layout">
        <h1>Custom Layout!</h1>
        <p>Custom 404 page!</p>
      </div>
    )
  }
  if (frontmatter.layout === 'home') {
    return (
      <div className="vp-layout">
        <h1>Custom Layout!</h1>
        <p>Custom home page!</p>
      </div>
    )
  }
  return (
    <div className="vp-layout">
      <h1>Custom Layout!</h1>
      <Content />
    </div>
  )
}
```

当然你可以把布局拆成多个组件：

```tsx [.vitepress/theme/Layout.tsx]
import { useData } from '@10coding/vitepress-react'
import NotFound from './NotFound.tsx'
import Home from './Home.tsx'
import Page from './Page.tsx'

export default function Layout() {
  const { page, frontmatter } = useData()
  return (
    <div className="vp-layout">
      <h1>Custom Layout!</h1>
      {page.isNotFound ? (
        <NotFound />
      ) : frontmatter.layout === 'home' ? (
        <Home />
      ) : (
        <Page />
      )}
    </div>
  )
}
```

```tsx [.vitepress/theme/Page.tsx]
import { Content } from '@10coding/vitepress-react'

export default function Page() {
  return <Content />
}
```

请查看[运行时 API 参考](../reference/runtime-api)获取主题组件中所有可用的内容。此外，可以利用[构建时数据加载](./data-loading)生成数据驱动布局——例如，一个列出当前项目中所有文章入口的页面。

## 分发自定义主题 {#distributing-a-custom-theme}

分发自定义主题最简单的方式是将其作为 [GitHub 模版仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository)。

如果希望将主题作为 npm 包分发，请按下面的步骤：

1. 在包入口把主题对象作为默认导出（文件为 `.ts`/`.tsx`）。

2. 如果合适，把主题配置类型作为 `ThemeConfig` 导出。

3. 如果主题需要调整 VitePress 配置，请在包的子路径下（例如 `my-theme/config`）导出该配置，以便用户扩展。

4. 记录主题配置选项（配置文件与 frontmatter 两处）。

5. 提供清晰的使用说明（见下节）。

## 使用自定义主题 {#consuming-a-custom-theme}

要使用外部主题，请导入它并重新导出：

```ts [.vitepress/theme/index.ts]
import Theme from 'awesome-vitepress-theme'

export default Theme
```

如果主题需要扩展：

```ts [.vitepress/theme/index.ts]
import Theme from 'awesome-vitepress-theme'

export default {
  ...Theme,
  enhanceApp(ctx) {
    // ...
  }
}
```

> 注意：fork 的主题对象用对象展开/覆盖组合（`extends` 主题字段也可用，语义见[主题接口](#theme-interface)），不是 Vue 的“extends 组件再包装”那套写法。

如果主题需要特殊的 VitePress 配置，在站点配置中扩展它：

```ts [.vitepress/config.ts]
import baseConfig from 'awesome-vitepress-theme/config'

export default {
  extends: baseConfig
}
```

如果主题提供了 `ThemeConfig` 类型：

```ts [.vitepress/config.ts]
import baseConfig from 'awesome-vitepress-theme/config'
import { defineConfig } from '@10coding/vitepress-react'
import type { ThemeConfig } from 'awesome-vitepress-theme'

export default defineConfig({
  extends: baseConfig,
  themeConfig: {
    // 类型为 ThemeConfig
  } as ThemeConfig
})
```
