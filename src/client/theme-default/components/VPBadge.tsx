import type { ReactNode } from 'react'

import { cx } from '../lib/cx'
import s from './VPBadge.module.css'

export type VPBadgeType =
  | 'info'
  | 'note'
  | 'tip'
  | 'important'
  | 'caution'
  | 'warning'
  | 'danger'

export type VPBadgeProps = {
  text?: string
  type?: VPBadgeType
  children?: ReactNode
}

/** 对应 Vue VPBadge.vue(注意其样式在 Vue 侧是全局 <style>)。 */
export function VPBadge({ text, type = 'tip', children }: VPBadgeProps) {
  return (
    <span className={cx(s.VPBadge, type && s[type])}>
      {children ?? text}
    </span>
  )
}
