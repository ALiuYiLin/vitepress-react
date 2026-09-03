// 参考默认主题(React 版;样式复用上游 VitePress theme-default 的 styles
// 资产——vars/base/fonts/utils 与 vp-doc/vp-code/custom-block 等,布局组件
// 样式在本目录 layout.css,全部 import 顺序即生效顺序)。
import './styles/vars.css'
import './styles/base.css'
import './styles/fonts.css'
import './styles/utils.css'
import './styles/components/vp-doc.css'
import './styles/components/vp-code.css'
import './styles/components/vp-code-group.css'
import './styles/components/custom-block.css'
import './layout.css'

import Layout from './Layout'
import { NotFound } from './layout-parts'

export { Layout, NotFound }

const theme = {
  Layout,
  NotFound
}

export default theme
