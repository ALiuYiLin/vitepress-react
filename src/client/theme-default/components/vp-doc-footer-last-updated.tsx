import { useData } from 'vitepress'

import s from './vp-doc-footer-last-updated.module.css'

/** 页脚"最后更新"时间(theme.lastUpdated 且 page.lastUpdated 存在时) */
export function VPDocFooterLastUpdated() {
  const { site, page } = useData()
  const show = (site as { lastUpdated?: boolean }).lastUpdated
  const ts = (page as { lastUpdated?: number })?.lastUpdated
  if (!show || !ts) return null
  const date = new Date(ts)
  const text = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString()
  return (
    <div className="VPDocFooterLastUpdated">
      <span className={s.prefix}>最后更新:</span>
      <span className={s.datetime}>{text}</span>
    </div>
  )
}
