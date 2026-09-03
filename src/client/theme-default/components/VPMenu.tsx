import * as React from 'react'

import { VPMenuGroup } from './VPMenuGroup'
import { VPMenuLink } from './VPMenuLink'
import s from './VPMenu.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export interface VPMenuProps {
  items?: any[]
  children?: React.ReactNode
}

/** 下拉菜单容器 */
export function VPMenu({ items, children }: VPMenuProps) {
  return (
    <div className={cx(s.menu, 'VPMenu')}>
      {items ? (
        <ul className={s.items}>
          {items.map((item, i) => {
            if ('link' in item) return <VPMenuLink key={i} item={item} />
            if ('component' in item) return null
            return (
              <VPMenuGroup key={i} text={item.text} items={item.items ?? []} />
            )
          })}
        </ul>
      ) : null}
      {children}
    </div>
  )
}
