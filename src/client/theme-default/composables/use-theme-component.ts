// 默认主题内部组件注册表(机制 B):
// 对齐 Vue 用 Vite alias 替换 VPNavBar.vue 等内部组件的能力——本项目
// 以编译产物发布、内部都是相对路径 import,alias 无法稳定命中,因此把
// “按内部组件名覆盖”从构建期依赖改写移到渲染期组件解析:
//
//   Theme.components = { VPNavBar: MyNavBar }
//
// 内部组合组件渲染子组件前经 useThemeComponent(name, fallback) 解析:
// 命中注册表用注册组件,否则用默认 fallback —— 不注册时行为与打包零变化。
//
// 覆盖面“开放到叶子”:所有参与主题内部组合的 VP* 组件都进名单,
// 包括 VPNavMenuLink / VPSidebarItem / VPIcon 等深层叶子。

import { createContext, useContext, type ComponentType } from 'react'

/** 默认主题内部组件的注册名单(与 internal 组合树一一对应,含叶子) */
export const THEME_COMPONENT_NAMES = [
  // Layout 直接组合
  'VPBackdrop',
  'VPContent',
  'VPFooter',
  'VPLocalNav',
  'VPNav',
  'VPSidebar',
  'VPSkipLink',
  // 正文链路
  'VPPage',
  'VPHome',
  'VPDoc',
  'VPDocAside',
  'VPDocAsideOutline',
  'VPDocFooter',
  'VPDocFooterLastUpdated',
  'VPDocOutlineItem',
  // 导航链路(含叶子)
  'VPNavBar',
  'VPNavBarTitle',
  'VPNavBarExtra',
  'VPNavBarHamburger',
  'VPNavBarSearch',
  'VPNavMenu',
  'VPNavMenuGroup',
  'VPNavMenuLink',
  'VPNavAppearance',
  'VPNavTranslations',
  'VPNavSocialLinks',
  'VPNavScreen',
  // 移动端大纲
  'VPLocalNavOutlineDropdown',
  // 侧栏链路(含叶子)
  'VPSidebarGroup',
  'VPSidebarItem',
  // 首页链路
  'VPHomeContent',
  'VPHomeHero',
  'VPHomeFeatures',
  'VPHero',
  'VPFeatures',
  'VPFeature',
  // 通用叶子/原语
  'VPButton',
  'VPImage',
  'VPLink',
  'VPIcon',
  'VPFlyout',
  'VPMenu',
  'VPMenuGroup',
  'VPMenuLink',
  'VPSocialLink',
  'VPSwitch',
  'VPSwitchAppearance'
] as const

export type ThemeComponentName = (typeof THEME_COMPONENT_NAMES)[number]

/** 用户主题的 components 覆盖表(Theme.components) */
export type ThemeComponents = Partial<Record<ThemeComponentName, ComponentType>>

/** 由 app 根提供(值为 resolveThemeExtends 深合并后的 Theme.components) */
export const ThemeComponentsContext = createContext<
  ThemeComponents | undefined
>(undefined)

/**
 * 解析一个内部组件名:注册表命中返回注册组件,否则返回 fallback(默认实现)。
 * 返回类型跟随 fallback,保证 JSX 处 props 类型不变。
 */
export function useThemeComponent<
  N extends ThemeComponentName,
  C extends ComponentType<any>
>(name: N, fallback: C): C {
  const registry = useContext(ThemeComponentsContext)
  return (registry?.[name] ?? fallback) as C
}
