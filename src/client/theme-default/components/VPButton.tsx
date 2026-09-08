import * as React from 'react'

import { useData } from '@10coding/vitepress-react'

import { normalizeLink } from '../support/utils'
import '../styles/components/VPButton.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) =>
  c.filter(Boolean).join(' ')

const EXTERNAL_URL_RE = /^(https?:|mailto:|tel:|\/\/)/

export interface VPButtonProps {
  tag?: string
  size?: 'medium' | 'big'
  theme?: 'brand' | 'alt' | 'sponsor'
  text?: string
  href?: string
  target?: string
  rel?: string
  children?: React.ReactNode
}

/** VitePress 默认主题按钮(Vue 原版结构) */
export function VPButton({
  tag,
  size = 'medium',
  theme = 'brand',
  text,
  href,
  target,
  rel,
  children
}: VPButtonProps) {
  // 与上游 Vue VPButton 一致:内部链接 href 一律经 normalizeLink(补 .html/base)
  const { site } = useData()
  const siteForLink = site as { cleanUrls?: boolean; base?: string }
  const external = href ? EXTERNAL_URL_RE.test(href) : false
  const Comp: any = tag || (href ? 'a' : 'button')
  const resolvedTarget = target ?? (external ? '_blank' : undefined)
  const resolvedRel = rel ?? (external ? 'noreferrer' : undefined)
  const useHtml = Boolean(text) && children === undefined
  return (
    <Comp
      data-direct-scoped
      className={cx('VPButton', size, theme, 'no-icon')}
      href={href ? normalizeLink(href, siteForLink) : undefined}
      target={resolvedTarget}
      rel={resolvedRel}
      dangerouslySetInnerHTML={useHtml ? { __html: text } : undefined}
    >
      {useHtml ? null : (children ?? text)}
    </Comp>
  )
}
