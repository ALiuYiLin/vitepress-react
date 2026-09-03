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
export { VPTeamMembers, VPTeamMembersItem } from './components/vp-team'
export { VPTeamPage } from './components/VPTeamPage'
export { VPTeamPageTitle } from './components/VPTeamPageTitle'
export { VPTeamPageSection } from './components/VPTeamPageSection'

export { Layout, NotFound }

const theme = {
  Layout,
  NotFound
}

export default theme
