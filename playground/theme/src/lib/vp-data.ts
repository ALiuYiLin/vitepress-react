// ============================================================================
// mock 的 VitePress 数据层(调试用,无 JSX)
//
// 结构刻意对齐上游 VitePress(vitepress-react 主仓库 types/shared.d.ts):
//   site(站点级,含 themeConfig 与 locales) / page(页面级,含 frontmatter 与
//   headers) —— 未来由真实框架的 useData()/useRoute() 提供,这里先用固定假数据
//   驱动布局开发,便于在接入框架前手动调试文档站 UI。
// ============================================================================

// ---------- 与上游 DefaultTheme.Config 对齐的窄化类型 ----------
export interface VpNavItem {
  text: string
  link: string
  /** 可选:用于高亮判定的正则/前缀(简化实现里支持字符串前缀) */
  activeMatch?: string
}

export interface VpSidebarItem {
  text: string
  link?: string
  items?: VpSidebarItem[]
}

export interface VpSidebarGroup {
  text?: string
  items: VpSidebarItem[]
}

export interface VpThemeConfig {
  nav: VpNavItem[]
  sidebar: Record<string, VpSidebarGroup[]>
  footer?: { message?: string; copyright?: string }
}

export interface VpLocale {
  label: string
  lang: string
  dir?: 'ltr' | 'rtl'
  link?: string
}

export interface VpSiteData {
  base: string
  cleanUrls: boolean
  lang: string
  dir: 'ltr' | 'rtl'
  title: string
  description: string
  appearance: boolean | 'dark' | 'force-dark'
  themeConfig: VpThemeConfig
  locales: Record<string, VpLocale>
}

// ---------- 页面内容块(便于生成可滚动的长正文) ----------
export type VpBlock =
  | { type: 'h'; level: 2 | 3; id: string; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; head: string[]; rows: string[][] }

export interface VpHeader {
  level: number
  title: string
  slug: string
  children: VpHeader[]
}

export interface VpPageData {
  /** 公网路径,如 /guide/getting-started */
  path: string
  /** 相对源码路径(对齐上游 relativePath) */
  relativePath: string
  title: string
  description: string
  frontmatter: Record<string, unknown>
  headers: VpHeader[]
  blocks: VpBlock[]
}

// ============================================================================
// 站点数据(对齐 SiteData / DefaultTheme.Config)
// ============================================================================

export const site: VpSiteData = {
  base: '/',
  cleanUrls: true,
  lang: 'zh-CN',
  dir: 'ltr',
  title: 'VitePress-React',
  description: '用 React + shadcn 重建文档站的调试台',
  appearance: true,
  themeConfig: {
    // 顶部导航(数据顺序即展示顺序:指南 → 参考),多语言与外观按钮固定在右端
    nav: [
      { text: '指南', link: '/guide/' },
      { text: '参考', link: '/reference/site-config' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '介绍', link: '/guide/' },
            { text: '快速开始', link: '/guide/getting-started' }
          ]
        },
        {
          text: '主题',
          items: [
            { text: '主题化', link: '/guide/theming' }
          ]
        }
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '站点配置', link: '/reference/site-config' },
            { text: '主题配置(占位)', link: '/reference/default-theme-config' }
          ]
        }
      ]
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2025 VitePress-React Playground'
    }
  },
  locales: {
    root: { label: 'English', lang: 'en-US' },
    zh: { label: '简体中文', lang: 'zh-CN' }
  }
}

// ============================================================================
// 示例页面数据(blocks 驱动正文与大纲,保证两者 id 一致)
// ============================================================================

const introBlocks: VpBlock[] = [
  {
    type: 'h',
    level: 2,
    id: 'what-is-this',
    text: '这个调试台是什么'
  },
  {
    type: 'p',
    text: '这是 VitePress-React 迁移计划中「shadcn 主题」的先行调试环境:在尚未接入真实框架前,先用一份 mock 的 useData 数据,把文档站的页面布局与基础交互做出来,便于手工验证结构与信息顺序。'
  },
  {
    type: 'p',
    text: '页面顶部的导航、左侧的侧边栏、右侧的"本页目录"、以及暗色/语言切换,全部由 src/lib/vp-data.ts 中的假数据驱动——这些数据在真实框架里的形状与上游 VitePress 一致,所以将来只需把数据源从 mock 换成框架注入即可。'
  },
  {
    type: 'list',
    items: [
      '顶部导航顺序:指南 → 参考,语言与外观按钮在最右端',
      '侧边栏分组与当前页高亮',
      '右侧大纲随滚动高亮(滚动侦测)',
      '上一页 / 下一页导航',
      '暗色模式持久化 + 语言下拉'
    ]
  },
  {
    type: 'h',
    level: 2,
    id: 'layout-map',
    text: '布局对应关系'
  },
  {
    type: 'table',
    head: ['上游(参考)', '本调试台', '数据来源'],
    rows: [
      ['VPNav', 'TopNav(顶栏)', 'themeConfig.nav / locales'],
      ['VPSidebar', 'Sidebar(左栏)', 'themeConfig.sidebar'],
      ['VPDocAsideOutline', 'AsideOutline(右栏)', 'page.headers'],
      ['VPContent / VPDoc', '正文区', 'page.blocks'],
      ['VPDocFooter', 'PrevNext(页脚上)', '侧边栏扁平顺序']
    ]
  },
  {
    type: 'h',
    level: 2,
    id: 'tips',
    text: '调试建议'
  },
  {
    type: 'list',
    items: [
      '切换浏览器宽度,观察移动端抽屉菜单',
      '点击右侧目录条目,验证平滑滚动与滚动高亮',
      '切换暗色模式后刷新,主题应保持',
      '在 vp-data.ts 中增删侧边栏项,观察导航/面包屑联动'
    ]
  }
]

const gettingStartedBlocks: VpBlock[] = [
  {
    type: 'p',
    text: '本调试台就是"快速开始"的最佳示例:依赖 Vite + React + TypeScript + Tailwind v4 + shadcn/ui。下面用它说明一个文档站通常需要的步骤。'
  },
  {
    type: 'h',
    level: 2,
    id: 'install',
    text: '安装依赖'
  },
  {
    type: 'code',
    lang: 'bash',
    code: '# 在仓库外或独立目录中初始化\nnpm create vite@latest my-docs -- --template react-ts\ncd my-docs\nnpm install\n# Tailwind v4 + shadcn 基础库\nnpm install tailwindcss @tailwindcss/vite class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot @radix-ui/react-dropdown-menu'
  },
  {
    type: 'p',
    text: 'Tailwind v4 使用 @tailwindcss/vite 插件,无需 tailwind.config.js;设计令牌直接写在 CSS 变量里(见 src/index.css)。'
  },
  {
    type: 'h',
    level: 2,
    id: 'add-theme',
    text: '把"主题"挂到应用上'
  },
  {
    type: 'p',
    text: '本调试台把整套布局收敛在 src/theme/ 目录(即未来框架中"主题"的对应物)。App 只需包一层数据 Provider 再渲染 Layout。'
  },
  {
    type: 'code',
    lang: 'tsx',
    code: 'import { DataProvider } from "./lib/vp-store"\nimport { Layout } from "./theme/Layout"\n\nexport default function App() {\n  return (\n    <DataProvider>\n      <Layout />\n    </DataProvider>\n  )\n}'
  },
  {
    type: 'h',
    level: 3,
    id: 'theme-contract',
    text: '主题与框架的约定(未来)'
  },
  {
    type: 'list',
    items: [
      'useData() 返回 site / theme / page / frontmatter 等(当前为快照语义,mock)',
      'useRoute() 返回当前路径与页面数据',
      '导航/侧边栏是数据驱动:改 themeConfig 即可重排'
    ]
  },
  {
    type: 'h',
    level: 2,
    id: 'run-dev',
    text: '启动开发服务器'
  },
  {
    type: 'code',
    lang: 'bash',
    code: 'npm run dev\n# 打开 http://127.0.0.1:5199\n# 本调试台即这一整套布局,可直接改动主题组件热更新预览'
  },
  {
    type: 'h',
    level: 2,
    id: 'directory',
    text: '目录结构'
  },
  {
    type: 'code',
    lang: 'text',
    code: 'playground/theme\n├─ src\n│  ├─ lib\n│  │  ├─ vp-data.ts        # mock 站点/主题配置/页面数据(上游同构)  \n│  │  ├─ vp-store.tsx      # DataProvider + useData/useRoute(mock 实现)\n│  │  └─ utils.ts          # cn()\n│  ├─ theme                # 主题:布局 + 各区块组件\n│  │  ├─ Layout.tsx        # 整体骨架\n│  │  ├─ TopNav.tsx        # 顶部导航(导航项/语言/外观/移动端菜单)\n│  │  ├─ Sidebar.tsx       # 侧边栏\n│  │  ├─ MobileNav.tsx     # 移动端抽屉\n│  │  ├─ AsideOutline.tsx  # 右侧"本页目录" + 滚动高亮\n│  │  ├─ PrevNext.tsx      # 上一页/下一页\n│  │  └─ Footer.tsx\n│  ├─ content/render.tsx   # blocks → 正文 JSX\n│  └─ components/ui        # shadcn 基础组件(button/dropdown-menu)\n├─ src/index.css           # Tailwind v4 + shadcn 令牌(明暗)\n└─ vite.config.ts'
  },
  {
    type: 'h',
    level: 3,
    id: 'longer-section',
    text: '更长的三级小节(演示大纲嵌套)'
  },
  {
    type: 'p',
    text: '大纲(本页目录)会按 h2/h3 的层级渲染嵌套列表;滚动到对应标题时右侧条目会高亮,点击可平滑滚动。'
  },
  {
    type: 'p',
    text: '下面再放一些占位段落,让页面足够长、滚动侦测更直观。文档站正文通常包含标题层级、列表、代码块、表格与引用等块级元素。'
  },
  {
    type: 'h',
    level: 2,
    id: 'faq',
    text: '常见问题'
  },
  {
    type: 'list',
    items: [
      '为什么用 mock 数据?——先把 UI/UX 打磨到位,避免与框架接入互相干扰',
      '什么时候替换为真实数据?——迁移计划 M4 阶段,把 DataProvider 换成框架实现即可',
      '视觉是否与上游 VitePress 一致?——不需要,结构近似、内容顺序一致即可'
    ]
  }
]

const themingBlocks: VpBlock[] = [
  {
    type: 'p',
    text: '主题化的核心是"数据驱动 + 令牌化样式":导航、侧边栏来自 themeConfig;颜色、圆角来自 CSS 变量(shadcn 令牌)。'
  },
  {
    type: 'h',
    level: 2,
    id: 'theme-config',
    text: 'themeConfig 结构(与上游对齐)'
  },
  {
    type: 'code',
    lang: 'ts',
    code: 'export const themeConfig = {\n  nav: [\n    { text: "指南", link: "/guide/" },\n    { text: "参考", link: "/reference/site-config" },\n  ],\n  sidebar: {\n    "/guide/": [\n      { text: "入门", items: [{ text: "介绍", link: "/guide/" }] },\n    ],\n  },\n}'
  },
  {
    type: 'h',
    level: 2,
    id: 'sidebar-rule',
    text: '侧边栏归属规则'
  },
  {
    type: 'p',
    text: '当前路径匹配 sidebar 中"最长前缀"的分组作为激活分组,激活分组内的条目顺序用于计算"上一页/下一页"。例如 /guide/getting-started 命中 /guide/ 分组。'
  },
  {
    type: 'h',
    level: 2,
    id: 'mapping',
    text: '上游 → 新主题 映射表(决策 D6 产物)'
  },
  {
    type: 'table',
    head: ['上游布局/组件', '新主题组件', '状态'],
    rows: [
      ['VPNav / VPNavBar', 'TopNav(shadcn + 自定义)', '本调试台已实现'],
      ['VPSidebar / VPSidebarGroup / VPSidebarItem', 'Sidebar(分组递归)', '本调试台已实现'],
      ['VPDocAsideOutline', 'AsideOutline(滚动高亮)', '本调试台已实现'],
      ['VPNavTranslations', 'TopNav 内 Languages 下拉', '本调试台已实现'],
      ['VPNavAppearance', 'TopNav 内 外观按钮', '本调试台已实现'],
      ['VPContent/VPDoc 正文排版', '正文渲染 + 排版 CSS', '随页面打磨'],
      ['VPLocalSearchBox / docsearch', '后续按真实框架接入', '未实现(占位)']
    ]
  },
  {
    type: 'h',
    level: 2,
    id: 'design-tokens',
    text: '设计令牌'
  },
  {
    type: 'p',
    text: '颜色/圆角等令牌集中在 src/index.css 的 :root 与 .dark,组件只使用语义类名(bg-background、text-muted-foreground、border-border 等),因此换肤只需改 CSS 变量。'
  },
  {
    type: 'code',
    lang: 'css',
    code: '.dark {\n  --background: oklch(0.141 0.005 285.823);\n  --foreground: oklch(0.985 0 0);\n  --primary: oklch(0.92 0.004 286.32);\n  /* …其余令牌 */\n}'
  }
]

const siteConfigBlocks: VpBlock[] = [
  {
    type: 'p',
    text: '站点配置与上游 site 字段同构(标题、描述、外观、多语言、主题配置)。本页以参考文档的方式展示常用字段。'
  },
  {
    type: 'h',
    level: 2,
    id: 'basic-fields',
    text: '基础字段'
  },
  {
    type: 'table',
    head: ['字段', '说明', '示例'],
    rows: [
      ['base', '站点基础路径', '/'],
      ['title', '站点标题(用于导航与页标题)', 'VitePress-React'],
      ['description', '站点描述', '…'],
      ['appearance', '暗色模式行为', 'true / "dark" / "force-dark"'],
      ['lang', '默认语言', 'zh-CN']
    ]
  },
  {
    type: 'h',
    level: 2,
    id: 'locales',
    text: '多语言'
  },
  {
    type: 'p',
    text: 'locales 以目录键组织,root 为默认语言。语言下拉把可用语言列出来,选择后切换页面 lang/dir 等属性。'
  },
  {
    type: 'code',
    lang: 'ts',
    code: 'locales: {\n  root: { label: "English", lang: "en-US" },\n  zh:   { label: "简体中文", lang: "zh-CN" },\n}'
  },
  {
    type: 'h',
    level: 2,
    id: 'head-meta',
    text: 'head 元信息'
  },
  {
    type: 'p',
    text: 'head 数组项为 [tag, attrs, innerHTML?] 三元组,由框架在渲染期合并输出。当前调试台未渲染 head,接入真实框架后按上游逻辑补齐。'
  }
]

export const notFoundPage: VpPageData = {
  path: '/404',
  relativePath: '404.md',
  title: '404',
  description: 'Page Not Found',
  frontmatter: {},
  headers: [],
  blocks: [
    { type: 'h', level: 2, id: 'not-found', text: '页面不存在' },
    { type: 'p', text: '你访问的页面不存在,请通过顶部导航返回。' }
  ]
}

function buildHeaders(blocks: VpBlock[]): VpHeader[] {
  const roots: VpHeader[] = []
  for (const b of blocks) {
    if (b.type !== 'h') continue
    if (b.level === 2) roots.push({ level: 2, title: b.text, slug: b.id, children: [] })
    else if (b.level === 3 && roots.length) {
      roots[roots.length - 1].children.push({
        level: 3,
        title: b.text,
        slug: b.id,
        children: []
      })
    }
  }
  return roots
}

function makePage(
  path: string,
  title: string,
  description: string,
  blocks: VpBlock[]
): VpPageData {
  return {
    path,
    relativePath: path.replace(/^\//, '') + '.md',
    title,
    description,
    frontmatter: { title },
    headers: buildHeaders(blocks),
    blocks
  }
}

const guideLanding = makePage('/guide/', '介绍', 'VitePress-React 主题调试台说明', introBlocks)
const guideGettingStarted = makePage('/guide/getting-started', '快速开始', '如何跑起并调整本调试台', gettingStartedBlocks)
const guideTheming = makePage('/guide/theming', '主题化', '主题数据与样式令牌', themingBlocks)
const refSiteConfig = makePage('/reference/site-config', '站点配置', '站点配置参考', siteConfigBlocks)
const refThemeConfig = makePage('/reference/default-theme-config', '主题配置(占位)', '占位页面,用于演示侧边栏与上一页/下一页', [
  {
    type: 'h',
    level: 2,
    id: 'placeholder',
    text: '占位页面'
  },
  {
    type: 'p',
    text: '本页用于演示:顶部导航"参考"高亮、侧边栏切换与"上一页/下一页"联动。内容将在接入真实框架后替换。'
  }
])

export const pages: VpPageData[] = [
  guideLanding,
  guideGettingStarted,
  guideTheming,
  refSiteConfig,
  refThemeConfig
]

/** 调试台默认首页路径 */
export const defaultPath = guideGettingStarted.path

/** 去掉尾斜杠/查询/哈希后的规范化路径(根路径返回 '/') */
export function normalizePath(p: string): string {
  const [pathname] = p.split(/[?#]/)
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

const pagesByPath = new Map(pages.map((p) => [normalizePath(p.path), p]))

export function getPage(path: string): VpPageData {
  const clean = normalizePath(path)
  const hit = pagesByPath.get(clean)
  if (hit) return hit
  for (const p of pages) {
    if (normalizePath(p.path) === clean) return p
  }
  return notFoundPage
}

/** 找到 path 命中的 sidebar 分组键(最长前缀) */
export function sidebarKeyFor(path: string): string {
  const candidates = Object.keys(site.themeConfig.sidebar).filter((k) =>
    path.startsWith(k)
  )
  if (!candidates.length) return Object.keys(site.themeConfig.sidebar)[0] ?? ''
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0]
}

export function sidebarGroupsFor(path: string): VpSidebarGroup[] {
  return site.themeConfig.sidebar[sidebarKeyFor(path)] ?? []
}

/** 扁平化某分组下所有带 link 的条目(用于上一页/下一页) */
export function flattenSidebarItems(
  groups: VpSidebarGroup[]
): VpSidebarItem[] {
  const out: VpSidebarItem[] = []
  const walk = (items: VpSidebarItem[]) => {
    for (const it of items) {
      if (it.link) out.push(it)
      if (it.items) walk(it.items)
    }
  }
  for (const g of groups) walk(g.items)
  return out
}

/** 顶部导航高亮:link 前缀匹配(activeMatch 为可选正则) */
export function isNavActive(nav: VpNavItem, path: string): boolean {
  if (nav.activeMatch) {
    try {
      return new RegExp(nav.activeMatch).test(path)
    } catch {
      return false
    }
  }
  return path.startsWith(nav.link.replace(/\/$/, ''))
}
