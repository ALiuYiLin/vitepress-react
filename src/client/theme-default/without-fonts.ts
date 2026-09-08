// 默认主题(React 版):DOM 结构与样式严格复刻 Vue 默认主题(al.19 dev 主线)。
// 站点/正文样式全部复用上游 styles/*(与 Vue 主题一致),组件级 scoped 样式
// 在 React 侧用 CSS Modules。
import './styles/vars.css'
import './styles/base.css'
import './styles/icons.css'
import './styles/utils.css'
import './styles/components/custom-block.css'
import './styles/components/vp-code.css'
import './styles/components/vp-code-group.css'
import './styles/components/vp-doc.css'
import './styles/components/vp-sponsor.css'
// 纯字面量类名的导航/外壳组件规则(无本地类会被 CSS Modules 丢弃,故为全局样式)
import './styles/components/theme-nav.css'
// Home 栈(VPHome/VPHomeHero/VPHero/VPHomeFeatures/VPFeatures/VPFeature/VPHomeContent)样式
import './styles/components/theme-home.css'
// 团队页组件样式
import './styles/components/theme-team.css'

import { Layout } from './Layout'
import { NotFound } from './NotFound'

// 文档/markdown 可直接 import 的默认主题组件(与 Vue 默认主题导出一致)
export { VPBadge } from './components/VPBadge'
export { VPTeamMembers, VPTeamMembersItem } from './components/vp-team'
export { VPTeamPage } from './components/VPTeamPage'
export { VPTeamPageTitle } from './components/VPTeamPageTitle'
export { VPTeamPageSection } from './components/VPTeamPageSection'

export { Layout, NotFound }

// 主题扩展机制(机制 A Layout 具名插槽 / 机制 B 内部组件注册表)
export {
  useThemeComponent,
  ThemeComponentsContext,
  THEME_COMPONENT_NAMES
} from './composables/use-theme-component'
export type {
  ThemeComponentName,
  ThemeComponents
} from './composables/use-theme-component'
export {
  LAYOUT_SLOT_NAMES,
  LayoutSlotsContext,
  renderLayoutSlot,
  resolveLayoutSlots,
  useLayoutSlot
} from './layout-slots'
export type {
  LayoutSlotName,
  LayoutSlotContent,
  LayoutSlots,
  LayoutProps,
  LayoutSlotContext
} from './layout-slots'

const theme = {
  Layout,
  NotFound
}

export default theme
