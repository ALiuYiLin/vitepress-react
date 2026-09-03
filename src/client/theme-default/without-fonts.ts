// 参考默认主题(React 版;shadcn/ui 风格页面骨架 + md 正文用上游 vp-doc 排版)。
// 页面骨架样式由 index.css 经 scripts/build-theme-css.mjs 预编译成 tailwind.css
// (Tailwind v4 + shadcn tokens);md 正文 .vp-doc 排版复用上游 vars.css 与
// components/vp-*.css。
import './tailwind.css'
import './styles/vars.css'
import './styles/icons.css'
import './styles/components/vp-doc.css'
import './styles/components/vp-code.css'
import './styles/components/vp-code-group.css'
import './styles/components/custom-block.css'

import { Layout } from './Layout'
import { NotFound } from './NotFound'

export { Layout, NotFound }

const theme = {
  Layout,
  NotFound
}

export default theme
