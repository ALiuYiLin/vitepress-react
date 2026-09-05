import type { ReactNode } from 'react'

import '../styles/components/VPBadge.scoped.css'
import { cx } from '../lib/cx'

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

/** 对应 Vue VPBadge.vue(样式经 jsx-scoped 构建期转成 [data-v-{hash}])。 */
export function VPBadge({ text, type = 'tip', children }: VPBadgeProps) {
  return (
    <span className={cx('VPBadge', type)}>
      {children ?? text}
    </span>
  )
}
