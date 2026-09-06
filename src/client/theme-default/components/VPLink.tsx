import { createElement, type ReactNode } from 'react'
import { useData } from '@10coding/vitepress-react'

import { cx } from '../lib/cx'
import { isLinkExternal, normalizeLink } from '../support/utils'

export type VPLinkProps = {
  tag?: string
  href?: string
  noIcon?: boolean
  external?: boolean
  target?: string
  rel?: string
  className?: string
  children?: ReactNode
} & Record<string, unknown>

/**
 * 对应 Vue VPLink.vue:`tag ?? (href ? 'a' : 'span')`,href 归一化,
 * 外链加 `vp-external-link-icon`,noIcon 可关闭外链图标。
 * 类名 VPLink/link/no-icon 与 vue 侧一致(CSS Modules 输出同名类)。
 */
export function VPLink(props: VPLinkProps) {
  const { tag, href, noIcon, external, target, rel, className, children, ...rest } =
    props
  const { site } = useData()
  const siteForLink = site as { cleanUrls?: boolean; base?: string }
  const Tag = tag ?? (href ? 'a' : 'span')
  const isExternalLink = isLinkExternal(href, target, external)

  const elementProps: Record<string, unknown> = {
    className: cx(
      'VPLink',
      className,
      href && 'link',
      isExternalLink && 'vp-external-link-icon',
      noIcon && 'no-icon'
    ),
    ...rest
  }

  if (Tag === 'a') {
    if (href) elementProps.href = normalizeLink(href, siteForLink)
    if (elementProps.target == null) {
      elementProps.target = target ?? (isExternalLink ? '_blank' : undefined)
    }
    if (elementProps.rel == null) {
      elementProps.rel = rel ?? (isExternalLink ? 'noreferrer' : undefined)
    }
  }

  return createElement(Tag, elementProps, children)
}
