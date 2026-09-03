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

import { Layout } from './Layout'
import { NotFound } from './NotFound'

export { Layout, NotFound }

const theme = {
  Layout,
  NotFound
}

export default theme
