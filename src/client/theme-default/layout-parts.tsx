import { useData, useRoute } from 'vitepress'

import {
  flattenSidebar,
  isExternal,
  normalizePath,
  sidebarForPath
} from './theme-utils'
import type { SidebarConfig } from './theme-utils'

/** 页脚(themeConfig.footer) */
export function Footer() {
  const { theme } = useData()
  const footer = (theme as any)?.footer as
    | { message?: string; copyright?: string }
    | undefined
  if (!footer?.message && !footer?.copyright) return null
  return (
    <footer className="vp-footer">
      {footer.message ? <p>{footer.message}</p> : null}
      {footer.copyright ? <p>{footer.copyright}</p> : null}
    </footer>
  )
}

/** 上一页/下一页(按当前 sidebar 展平顺序) */
export function PrevNext() {
  const { theme } = useData()
  const route = useRoute()
  const cfg = theme as { sidebar?: SidebarConfig; docFooter?: { prev?: string | boolean; next?: string | boolean } }
  const items = flattenSidebar(sidebarForPath(cfg.sidebar, route.path))
  const idx = items.findIndex((i) => normalizePath(i.link) === normalizePath(route.path))
  if (idx < 0 || items.length < 2) return null

  const prev = idx > 0 ? items[idx - 1] : undefined
  const next = idx < items.length - 1 ? items[idx + 1] : undefined
  const labels = {
    prev: cfg.docFooter?.prev,
    next: cfg.docFooter?.next
  }
  if (labels.prev === false && !prev) return null
  if (labels.next === false && !next) return null

  return (
    <div className="vp-prev-next">
      {prev && labels.prev !== false ? (
        <a href={prev.link} className="prev" rel="prev">
          <span className="label">
            {typeof labels.prev === 'string' ? labels.prev : 'Previous page'}
          </span>
          <span className="title">{prev.text}</span>
        </a>
      ) : (
        <span />
      )}
      {next && labels.next !== false ? (
        <a href={next.link} className="next" rel="next">
          <span className="label">
            {typeof labels.next === 'string' ? labels.next : 'Next page'}
          </span>
          <span className="title">{next.text}</span>
        </a>
      ) : (
        <span />
      )}
    </div>
  )
}

/** 404 视图(默认主题缺省;Layout 内容区渲染) */
export function NotFound() {
  const { site } = useData()
  return (
    <div className="vp-404">
      <code>404</code>
      <h1>Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      {site.title ? (
        <p>
          <a href="/">Go to {site.title} home</a>
        </p>
      ) : null}
    </div>
  )
}

export { isExternal }
