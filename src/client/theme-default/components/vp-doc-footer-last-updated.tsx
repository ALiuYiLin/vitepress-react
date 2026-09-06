import { useEffect, useState } from 'react'
import { useData } from '@10coding/vitepress-react'

import '../styles/components/vp-doc-footer-last-updated.scoped.css'

/** 页脚"最后更新"时间(theme.lastUpdated 且 page.lastUpdated 存在时) */
export function VPDocFooterLastUpdated() {
  const { site, page, theme, lang } = useData()
  const show = (site as { lastUpdated?: boolean })?.lastUpdated
  const ts = (page as { lastUpdated?: number })?.lastUpdated
  const lastUpdatedCfg = (theme as {
    lastUpdated?: {
      text?: string
      formatOptions?: Intl.DateTimeFormatOptions
      forceLocale?: boolean
    }
  })?.lastUpdated

  const [datetime, setDatetime] = useState('')

  useEffect(() => {
    if (!ts) return
    const date = new Date(ts)
    if (Number.isNaN(date.getTime())) return
    const useLang = lastUpdatedCfg?.forceLocale
      ? (lang ?? undefined)
      : (navigator.language || undefined)
    const fmt = lastUpdatedCfg?.formatOptions ?? {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }
    try {
      setDatetime(new Intl.DateTimeFormat(useLang, fmt).format(date))
    } catch {
      // 无效 locale 时退回默认格式
      setDatetime(date.toLocaleString())
    }
  }, [ts, lang, lastUpdatedCfg])

  if (!show || !ts) return null

  const label = lastUpdatedCfg?.text || 'Last updated'
  return (
    <p className="VPLastUpdated">
      <span className="prefix">{label}:</span>
      <time className="datetime" dateTime={new Date(ts).toISOString()}>
        {datetime}
      </time>
    </p>
  )
}
