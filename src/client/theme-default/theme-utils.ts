// 默认主题内部工具:themeConfig(nav/sidebar)结构的访问与路径匹配。
// 参考主题用最小结构接口(运行时按 DefaultTheme 语义解读),不依赖 Vue 类型。

/** 顶层 nav 项 */
export interface NavItem {
  text?: string
  link?: string
  items?: NavItem[]
  activeMatch?: string
  rel?: string
  target?: string
  component?: string
}

/** 侧栏单项(可嵌套) */
export interface SidebarItem {
  text?: string
  link?: string
  items?: SidebarItem[]
  collapsed?: boolean
  docFooterText?: string
  rel?: string
  target?: string
}

/** sidebar 配置:数组,或多路径映射(值可为数组或 { items, base }) */
export type SidebarConfig =
  | SidebarItem[]
  | Record<
      string,
      SidebarItem[] | { items: SidebarItem[]; base?: string }
    >

/**
 * 路由路径归一(供活动态/相等比较):去掉 .md/.html、末尾 index 与尾斜杠。
 * 对齐上游 normalize 语义——构建期首页键是 '/index',而浏览器访问 '/',
 * 两端必须归一一致(否则 nav/sidebar 高亮在 SSR 与客户端不同 → hydrate
 * mismatch)。
 */
export function normalizePath(p: string): string {
  let r = p.replace(/\.(md|html)$/i, '')
  r = r.replace(/(^|\/)index$/, '$1')
  r = r.replace(/\/+$/, '')
  return r || '/'
}

export function isExternal(link: string): boolean {
  return /^(https?:)?\/\//i.test(link) || link.startsWith('mailto:')
}

export function isActivePath(
  link: string,
  path: string,
  activeMatch?: string
): boolean {
  if (activeMatch) {
    try {
      return new RegExp(activeMatch).test(path)
    } catch {
      /* fallthrough */
    }
  }
  return normalizePath(path) === normalizePath(link)
}

/** 把 item.link 按父级 base 解析成站内绝对路径 */
function resolveItemLink(item: SidebarItem, base: string | undefined): string {
  if (!item.link) return ''
  if (base && item.link.startsWith('/')) return item.link
  if (base) {
    const joined = `${base.replace(/\/+$/, '')}/${item.link.replace(/^\/+/, '')}`
    return joined || '/'
  }
  return item.link
}

/**
 * 取出当前路由匹配的 sidebar 配置;multi 形态按最长路径前缀匹配,
 * 并把 { items, base } 展开(子项 link 前置 base)。
 */
export function sidebarForPath(
  sidebar: SidebarConfig | undefined,
  path: string
): SidebarItem[] {
  if (!sidebar) return []
  if (Array.isArray(sidebar)) return sidebar
  const keys = Object.keys(sidebar).sort((a, b) => b.length - a.length)
  const norm = normalizePath(path)
  const key =
    keys.find((k) => norm === '/' ? k === '/' : norm.startsWith(normalizePath(k))) ??
    keys[0]
  if (key == null) return []
  const val = sidebar[key]
  const items = Array.isArray(val) ? val : val?.items ?? []
  const base = !Array.isArray(val) ? val?.base : undefined
  if (!base) return items
  return items.map((item) => ({
    ...item,
    items: item.items?.map((sub) => ({
      ...sub,
      link: resolveItemLink(sub, base)
    }))
  }))
}

/** 展平当前 sidebar(保留分组顺序)成有序链接项,供 PrevNext 与活动态判定 */
export function flattenSidebar(
  items: SidebarItem[],
  parentText?: string
): { text: string; link: string; item: SidebarItem }[] {
  const out: { text: string; link: string; item: SidebarItem }[] = []
  for (const item of items) {
    const label = item.docFooterText || item.text || parentText || ''
    if (item.link) {
      out.push({ text: label, link: item.link, item })
    }
    if (item.items?.length) {
      out.push(...flattenSidebar(item.items, label))
    }
  }
  return out
}
