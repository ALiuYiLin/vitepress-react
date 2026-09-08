import type { ComponentType } from 'react'

import type { ThemeComponents } from '../theme-default/composables/use-theme-component'
import type { Awaitable, SiteData } from '../shared'
import type { Router } from './router'

export interface EnhanceAppContext {
  /**
   * The router instance (SPA navigation etc).
   */
  router: Router
  /**
   * The site data.
   */
  siteData: SiteData
  /**
   * Register extra components usable by markdown-generated pages
   * (future-proof; unused in the M0 skeleton).
   */
  registerComponent?: (name: string, component: ComponentType) => void
}

export interface Theme {
  /**
   * 每个页面的根布局组件。props 不限(框架只以无参方式渲染);
   * 默认主题的 Layout 接受具名插槽 props(类型见 theme 包的 LayoutProps)。
   */
  Layout?: ComponentType<any>
  enhanceApp?: (ctx: EnhanceAppContext) => Awaitable<void>
  extends?: Theme

  /**
   * Runs on the client inside the root component's effect (SSR-safe body:
   * guard DOM access). With `extends`, setups run base-first.
   */
  setup?: () => void

  /**
   * @deprecated Render not found page by checking `useData().page.isNotFound` in Layout instead.
   */
  NotFound?: ComponentType

  /**
   * 默认主题内部组件覆盖注册表(机制 B;对齐 Vue 用 alias 替换内部组件的
   * 能力):渲染期内核组件经 useThemeComponent(name, fallback) 解析,命中
   * 本表即用注册组件替代默认实现。名单见 THEME_COMPONENT_NAMES(开放到叶子)。
   * 仅对内部组合树生效;markdown 自动注入的 VPBadge/VPTeam* 走静态 import,
   * 不在本表覆盖范围。
   */
  components?: ThemeComponents
}

/**
 * 定义自定义主题的类型约束入口。
 *
 * 直接 `export default { extends: Theme, … }` 是裸对象字面量,TS 只做字面量
 * 推断、不做 Theme 形状检查——拼错键(如 `compnents`)、`components` 里写了
 * 非注册名单的组件名、把字段值类型写错,都不会报错。包一层本函数(或用
 * `export default { … } satisfies Theme`)后,全部字段受 Theme 类型约束,
 * 编辑期即可发现错误并拿到补全。
 */
export function defineTheme(theme: Theme): Theme {
  return theme
}
