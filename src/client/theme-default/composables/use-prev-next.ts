import { useData, useRoute } from 'vitepress'

import { flattenSidebarItems, normalizePath, sidebarGroupsFor } from '../theme-utils'

type PrevNextEntry = { text?: string; link?: string }

/** 上一页/下一页:由当前页在侧栏扁平链接中的前后项推导,frontmatter/theme 可覆盖 */
export function usePrevNext(): { prev?: PrevNextEntry; next?: PrevNextEntry } {
  const { theme, frontmatter } = useData()
  const route = useRoute()
  const cfg = theme as {
    sidebar?: unknown
    docFooter?: { prev?: boolean | PrevNextEntry; next?: boolean | PrevNextEntry }
  }
  const fm = frontmatter as {
    prev?: boolean | string | PrevNextEntry
    next?: boolean | string | PrevNextEntry
  }
  const current = normalizePath(route.path)
  const flat = flattenSidebarItems(
    sidebarGroupsFor(route.path, cfg.sidebar as never)
  )
  const idx = flat.findIndex((l) => normalizePath(l.link) === current)
  if (idx < 0) return {}
  const prevRaw = flat[idx - 1]
  const nextRaw = flat[idx + 1]

  const resolve = (
    raw: PrevNextEntry | undefined,
    override: boolean | string | PrevNextEntry | undefined,
    fallbackLabel: string
  ): PrevNextEntry | undefined => {
    if (override === false) return undefined
    if (typeof override === 'string') return { text: override, link: raw?.link }
    if (override && typeof override === 'object') {
      return { text: override.text ?? raw?.text, link: override.link ?? raw?.link }
    }
    if (!raw) return undefined
    return { text: raw.text ?? fallbackLabel, link: raw.link }
  }

  const docFooter = cfg.docFooter
  const prev = resolve(prevRaw, fm.prev ?? docFooter?.prev, '上一页')
  const next = resolve(nextRaw, fm.next ?? docFooter?.next, '下一页')
  return { prev, next }
}
