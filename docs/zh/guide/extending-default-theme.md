---
outline: deep
description: 通过自定义 CSS、组件与布局包装来定制和扩展 VitePress（React 实现）默认主题。
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

本项目 是 React，**没有 Vue 的 `app.component` 全局注册机制**（`EnhanceAppContext` 里的 `registerComponent` 为未来预留，当前不会渲染到 md 页面）。可用方案：

1. **页面级导入**（推荐）：在用到该组件的每个 md 页面的 `<script>` 顶层 `import`，正文用大写标签（见[在 Markdown 中使用 React](./using-react#using-components)）。默认主题导出的组件（`VPBadge`、`VPTeamMembers`、`VPTeamPage` 等）也按此导入，或在 markdown 里直接用 `@10coding/vitepress-react/theme` 自动导入的标签名。
2. **Layout 插槽**：若组件需要出现在“每个页面”的固定位置（例如全站横幅、大纲上方卡片），用下一节的 Layout 具名插槽。
3. **内部组件覆盖**：想替换默认主题某个内部组件（如 `VPNavBar`）本身，用[内部组件覆盖](#overriding-internal-components)的 `Theme.components` 注册表。

## Layout 具名插槽 {#layout-slots}

Vue 默认主题的 `<Layout/>` 提供具名插槽（如 `<template #aside-outline-before>`）；React 实现 用等价的**具名 props**（统一 camelCase）挂在 `DefaultTheme.Layout` 上，支持两种值形态：

- `ReactNode`：静态节点（等价于 Vue 的模板内容）；
- `(ctx) => ReactNode`：渲染函数（插槽可带参数；当前各挂载点无额外数据，`ctx` 为空对象，后续扩展时调用处不变）。

接线方式：在自定义主题的 `Layout` 里包一层默认 `Layout`，把插槽作为 props 传入（主题对象用 `defineTheme` 定义以获得类型约束，见[自定义主题](./custom-theme#theme-interface)）：

```ts [.vitepress-react/theme/index.ts]
import { defineTheme } from '@10coding/vitepress-react'
import Theme from '@10coding/vitepress-react/theme'
import { MyLayout } from './MyLayout.tsx'

export default defineTheme({
  ...Theme,
  Layout: MyLayout
})
```

```tsx [.vitepress-react/theme/MyLayout.tsx]
import { Layout } from '@10coding/vitepress-react/theme'

/** 大纲上方注入的内容(等价 Vue 的 #aside-outline-before) */
function MyOutlineTop() {
  return <div className="outline-tip">My custom sidebar top content</div>
}

export function MyLayout() {
  return (
    <Layout
      asideOutlineBefore={<MyOutlineTop />}
      navBarContentAfter={() => <a href="https://github.com">GitHub</a>}
    />
  )
}
```

也支持把多个插槽放进 `slots` 表（直传 prop 与 `slots` 同名时，直传 prop 优先）：

```tsx
<Layout slots={{ docFooterBefore: <ShareButtons />, layoutBottom: <FooterNote /> }} />
```

**插槽挂载点（全部可选，未提供时渲染零变化）**：

| React prop（camelCase） | Vue 插槽名 | 挂载位置 |
| --- | --- | --- |
| `layoutTop` / `layoutBottom` | `layout-top` / `layout-bottom` | `.Layout` 根首/末（全站最外层） |
| `navBarTitleBefore` / `navBarTitleAfter` | `nav-bar-title-before` / `nav-bar-title-after` | 顶栏站点标题链接前后 |
| `navBarContentBefore` / `navBarContentAfter` | `nav-bar-content-before` / `nav-bar-content-after` | 顶栏 content-body 前后 |
| `navScreenContentBefore` / `navScreenContentAfter` | `nav-screen-content-before` / `nav-screen-content-after` | 移动端全屏导航容器前后 |
| `sidebarNavBefore` / `sidebarNavAfter` | `sidebar-nav-before` / `sidebar-nav-after` | 侧栏 `<nav>` 前后 |
| `docBefore` / `docAfter` | `doc-before` / `doc-after` | 文档正文 `.doc` 根首/末 |
| `docTop` / `docBottom` | `doc-top` / `doc-bottom` | 正文 `.content-container` 首/末 |
| `docFooterBefore` | `doc-footer-before` | 文档页脚（`<VPDocFooter/>`）前 |
| `asideTop` / `asideBottom` | `aside-top` / `aside-bottom` | 右侧栏根首/末 |
| `asideOutlineBefore` / `asideOutlineAfter` | `aside-outline-before` / `aside-outline-after` | 右侧栏大纲前后 |
| `asideAdsBefore` / `asideAdsAfter` | `aside-ads-before` / `aside-ads-after` | 右侧栏广告区前后（仅在 `themeConfig.carbonAds` 存在时渲染） |

- 插槽内容渲染在**默认主题既有 DOM 容器内部**（如 `asideOutlineBefore` 与大纲同处 `.asideContent` 滚动区），不套新外壳、不破坏布局；需要留白时由自定义节点自带 class/margin。
- 需要按页面条件注入（如只对 `layout: 'home'` 显示）时，在自定义 `Layout` 里用 `useData()` 的 `frontmatter` 分支后再把插槽传给 `<Layout …/>`。
- 插槽注入点是固定的；想替换某个内部组件本身，用下一节的**内部组件覆盖**。

## 重写内部组件 {#overriding-internal-components}

Vue 版用 Vite alias 替换 `VPNavBar.vue` 等内部组件；React 实现 以编译产物发布、内部都是相对路径 import，alias 无法稳定命中，因此提供等价的**主题级组件注册表** `Theme.components`——把“按内部组件名覆盖”移到渲染期解析（用 `defineTheme` 包一层可让 `components` 的 key 受 `THEME_COMPONENT_NAMES` 约束，拼错组件名会立即报错）：

```ts [.vitepress-react/theme/index.ts]
import { defineTheme } from '@10coding/vitepress-react'
import Theme from '@10coding/vitepress-react/theme'
import { MyNavBar } from './MyNavBar.tsx'

export default defineTheme({
  extends: Theme,
  components: {
    VPNavBar: MyNavBar, // 替换整个顶栏;其余内部组件保持默认
    VPSidebarItem: MySidebarItem // 叶子组件同样可覆盖
  }
})
```

要点：

- **注册表开放到叶子**：`components` 的 key 覆盖默认主题内部组合树的全部 `VP*` 组件（`VPNav`/`VPNavBar`/`VPNavMenuLink`/`VPSidebarItem`/`VPIcon` 等，完整名单见导出的 `THEME_COMPONENT_NAMES`）。内部组合组件渲染子组件前经 `useThemeComponent(name, fallback)` 解析：命中注册表用你的实现，否则用默认——不传 `components` 时渲染与打包零变化。
- **与 `extends` 叠加**：`components` 按 key 合并（子主题只覆盖自己列出的名字，`extends` 链上其它覆盖保留）。
- **替换组件的 props 契约**：覆盖的组件必须接受默认内部组件被调用时的同名 props（半公开契约，与 Vue 上游内部组件同性质）；需要数据时用 `useData`/`useLayout` 等公开 hook 即可。
- **不在覆盖范围**：markdown 自动注入的 `VPBadge`/`VPTeam*` 走静态 import，不受注册表影响；想换掉它们请直接在 md 页面的 `<script>` 里导入你自己的组件（见[在 Markdown 中使用 React](./using-react#using-components)）。
- **取舍顺序**：只想加一块内容用上一节插槽；想替换某个内部组件的行为/结构用注册表；想改变整体骨架（如去掉侧栏自己排）则自定义/自绘 `Layout`（见[自定义主题](./custom-theme#composing-with-the-default-layout)）。

> 内部组件仍是实现细节，即便上游也可能在小版本中改名或调整 props；覆盖层数越深，升级成本越高。请优先使用公开配置项 → Layout 插槽 → 注册表覆盖 → 自绘 Layout 的优先级顺序。
