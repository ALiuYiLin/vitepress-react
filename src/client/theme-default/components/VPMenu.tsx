import * as React from 'react'

import { useThemeComponent } from '../composables/use-theme-component'
import '../styles/components/VPMenu.scoped.css'
import { VPMenuGroup as VPMenuGroupDefault } from './VPMenuGroup'
import { VPMenuLink as VPMenuLinkDefault } from './VPMenuLink'

const cx = (...c: (string | false | undefined | null)[]) =>
  c.filter(Boolean).join(' ')

export interface VPMenuProps {
  items?: any[]
  children?: React.ReactNode
}

/** 下拉菜单容器 */
export function VPMenu({ items, children }: VPMenuProps) {
  const VPMenuLink = useThemeComponent('VPMenuLink', VPMenuLinkDefault)
  const VPMenuGroup = useThemeComponent('VPMenuGroup', VPMenuGroupDefault)
  return (
    <div className={cx('menu', 'VPMenu')}>
      {items ? (
        <ul className="items">
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
