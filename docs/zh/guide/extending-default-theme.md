---
outline: deep
description: 通过自定义 CSS、组件与布局包装来定制和扩展 VitePress（React fork）默认主题。
---

# 扩展默认主题 {#extending-the-default-theme}

VitePress 默认的主题已经针对文档进行了优化，并且可以进行自定义。请参考[默认主题配置概览](../reference/default-theme-config)获取完整的选项列表。

但是有些情况仅靠配置是不够的。例如：

1. 需要调整 CSS 样式；
2. 需要全站可用的自定义组件；
3. 需要通过自定义 Layout 把内容注入到主题的特定位置。

这些高级自定义需要使用自定义主题来“扩展”默认主题。

::: tip
在继续之前，请确保首先阅读[自定义主题](./custom-theme)以了解其工作原理。
:::

## 自定义 CSS {#customizing-css}

默认主题的样式以 [CSS 变量](https://github.com/ALiuYiLin/vitepress-react/blob/main/src/client/theme-default/styles/vars.css) 为主。在主题入口导入自定义 css 并覆盖变量即可：

```ts [.vitepress-react/theme/index.ts]
import Theme from '@10coding/vitepress-react/theme'
import './custom.css'

export default Theme
```

```css
/* .vitepress-react/theme/custom.css */
:root {
  --vp-c-brand-1: #646cff;
  --vp-c-brand-2: #747bff;
}
```

## 使用自定义字体 {#using-different-fonts}

默认主题使用 [Inter](https://rsms.me/inter/) 作为默认字体并打包进产物。如果不想打包 Inter，请从 `@10coding/vitepress-react/theme-without-fonts` 导入主题：

```ts [.vitepress-react/theme/index.ts]
import Theme from '@10coding/vitepress-react/theme-without-fonts'
import './my-fonts.css'

export default Theme
```

```css
/* .vitepress-react/theme/my-fonts.css */
:root {
  --vp-font-family-base: /* 普通文本字体 */
  --vp-font-family-mono: /* 代码字体 */
}
```

::: warning
如果使用诸如[团队页](../reference/default-theme-team-page)这类组件，也请从 `@10coding/vitepress-react/theme-without-fonts` 导入它们。
:::

若字体是本地 `@font-face` 文件，它会被当作资源放进 `.vitepress-react/dist/assets`（带哈希文件名）。需要预加载时，使用 [transformHead](../reference/site-config#transformhead) 构建钩子：

```js [.vitepress-react/config.js]
export default {
  transformHead({ assets }) {
    // 相应地调整正则表达式以匹配字体
    const myFontFile = assets.find(file => /font-name\.[\w-]+\.woff2/.test(file))
    if (myFontFile) {
      return [
        [
          'link',
          {
            rel: 'preload',
            href: myFontFile,
            as: 'font',
            type: 'font/woff2',
            crossorigin: ''
          }
        ]
      ]
    }
  }
}
```

## 全站可用的组件 {#registering-global-components}

本 fork 是 React，**没有 Vue 的 `app.component` 全局注册机制**（`EnhanceAppContext` 里的 `registerComponent` 为未来预留，当前不会渲染到 md 页面）。可用方案：

1. **页面级导入**（推荐）：在用到该组件的每个 md 页面的 `<script>` 顶层 `import`，正文用大写标签（见[在 Markdown 中使用 React](./using-react#using-components)）。默认主题导出的组件（`VPBadge`、`VPTeamMembers`、`VPTeamPage` 等）也按此导入，或在 markdown 里直接用 `@10coding/vitepress-react/theme` 自动导入的标签名。
2. **Layout 注入**：若组件需要出现在“每个页面”的固定位置（例如全站横幅），把它放进你的自定义 Layout 里（见下一节）。

## 用 Layout 包装注入内容 {#layout-slots}

Vue 默认主题的 `<Layout/>` 提供了具名插槽；React fork 的 `Layout` 不接受插槽 props。等价的做法是**用自己的 Layout 包装默认 `Layout`**，在它前后渲染自定义内容，或按 `useData()` 条件渲染：

```ts [.vitepress-react/theme/index.ts]
import Theme from '@10coding/vitepress-react/theme'
import { MyLayout } from './MyLayout.tsx'

export default {
  ...Theme,
  Layout: MyLayout
}
```

```tsx [.vitepress-react/theme/MyLayout.tsx]
import { useData } from '@10coding/vitepress-react'
import { Layout } from '@10coding/vitepress-react/theme'

/** 站点全局横幅：所有页面顶部显示 */
export function SiteBanner() {
  return <div className="site-banner">New release!</div>
}

export function MyLayout() {
  const { frontmatter } = useData()
  return (
    <>
      <SiteBanner />
      {frontmatter.layout === 'home' ? <HomeExtra /> : null}
      <Layout />
    </>
  )
}
```

- 需要在某一类页面“局部”注入时，用 `useData()` 的 `page`/`frontmatter`/`layout` 分支即可；
- 基于页面的不同区域（如 sidebar 前、outline 前）做精确注入，请 fork 默认主题源码后把对应区域抽成你的 Layout 内容——上游的具名插槽清单不再适用。

## 使用视图过渡 API

### 关于外观切换 {#on-appearance-toggle}

可以扩展默认主题以在切换颜色模式时提供自定义过渡动画。

::: warning 示例已随 React 迁移移除
原示例是 **Vue 默认主题** 的演示（`docs/components/AppearanceToggleTransition.vue`，用 Vue 的 `provide/inject` 包装 `DefaultTheme.Layout` 配合 View Transitions API）已随 React 迁移移除。React fork 暂不提供等价示例；可参考[在 Markdown 中使用 React](./using-react)。
:::

更多视图过渡细节见 [Chrome 文档](https://developer.chrome.com/docs/web-platform/view-transitions/)。

### 路由切换时 {#on-route-change}

即将到来。

## 重写内部组件 {#overriding-internal-components}

Vue 版可以用 Vite alias 替换 `VPNavBar.vue` 等内部组件；**React fork 的默认主题以编译产物发布，暂不支持“按内部组件名覆盖”**。如需调整主题内部结构，推荐：

- 用自定义 Layout 包装并自行实现对应区域（见上节）；
- 或直接 fork/复制主题源码并按需修改后，在站点里以本地主题目录方式使用。

> 内部组件属于实现细节，即便上游也可能在小版本中改名；请优先使用公开的配置项与 Layout 包装。
