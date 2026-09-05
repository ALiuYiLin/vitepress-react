import { useData, useRoute } from 'vitepress'

import { flattenSidebarItems, normalizePath, sidebarGroupsFor } from '../theme-utils'

type PrevNextEntry = {
  text?: string
  link?: string
  target?: string
  rel?: string
}

type FmEntry = string | boolean | PrevNextEntry

/**
 * 上一页/下一页(对齐 Vue composables/prev-next.ts):
 * - 数据来自侧栏扁平链接的相邻项(去 hash、按链接去重);
 * - frontmatter 的 prev/next 可覆盖为 字符串(标题)/对象(text+link+target+rel)/false(隐藏);
 * - themeConfig.docFooter.prev/next 仅当 === false 且无 frontmatter 时隐藏该侧;
 *   它作为 caption 的文案由 VPDocFooter 直接取 theme.docFooter 渲染,这里不参与标题。
 */
export function usePrevNext(): { prev?: PrevNextEntry; next?: PrevNextEntry } {
  const { theme, frontmatter } = useData()
  const route = useRoute()

  const cfg = theme as { sidebar?: unknown; docFooter?: { prev?: unknown; next?: unknown } }
  const fm = frontmatter as { prev?: FmEntry; next?: FmEntry }

  const current = normalizePath(route.path)
  const flat = flattenSidebarItems(sidebarGroupsFor(cfg.sidebar as never, route.path))
  const idx = flat.findIndex((l) => normalizePath(l.link) === current)
  if (idx < 0) return {}

  function resolve(dir: 'prev' | 'next'): PrevNextEntry | undefined {
    const f = dir === 'prev' ? fm.prev : fm.next
    const df = dir === 'prev' ? cfg.docFooter?.prev : cfg.docFooter?.next
    const hide =
      (df === false && f == null) || f === false
    if (hide) return undefined

    const cand = flat[idx + (dir === 'prev' ? -1 : 1)]
    const fromFm =
      typeof f === 'string'
        ? { text: f }
        : f && typeof f === 'object'
          ? f
          : undefined

    return {
      text: fromFm?.text ?? cand?.text,
      link: fromFm?.link ?? cand?.link,
      target: fromFm?.target ?? (cand as PrevNextEntry | undefined)?.target,
      rel: fromFm?.rel ?? (cand as PrevNextEntry | undefined)?.rel
    }
  }

  return { prev: resolve('prev'), next: resolve('next') }
}
