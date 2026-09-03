import { useRef } from 'react'
import { useData } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import { resolveTitle, useActiveAnchor } from '../composables/use-active-anchor'
import { VPDocOutlineItem } from './VPDocOutlineItem'
import s from './VPDocAsideOutline.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 右侧页面导航(大纲) */
export function VPDocAsideOutline() {
  const { theme } = useData()
  const container = useRef<HTMLElement | null>(null)
  const marker = useRef<HTMLElement | null>(null)
  const { headers, hasLocalNav } = useLayout()
  useActiveAnchor(container, marker)

  return (
    <nav
      ref={container}
      aria-labelledby="doc-outline-aria-label"
      className={cx(s.aside, 'VPDocAsideOutline', hasLocalNav && 'has-outline')}
    >
      <div className={s.content}>
        <div className={cx(s.marker, 'outline-marker')} ref={marker} />
        <div
          aria-level={2}
          className={cx(s.title, 'outline-title')}
          id="doc-outline-aria-label"
          role="heading"
        >
          {resolveTitle(theme as { outline?: { label?: string } })}
        </div>
        <VPDocOutlineItem headers={headers as any} root />
      </div>
    </nav>
  )
}
