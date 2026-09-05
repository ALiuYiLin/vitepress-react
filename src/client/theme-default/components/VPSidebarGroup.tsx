import { useEffect, useState } from 'react'

import { type VpSidebarItem } from '../theme-utils'
import '../styles/components/VPSidebarGroup.scoped.css'
import { VPSidebarItem } from './VPSidebarItem'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 侧栏分组容器(对应 Vue VPSidebarGroup.vue):每个 item 包一层 .group,
 * 首个 300ms 禁用折叠箭头动画(.no-transition)。
 */
export function VPSidebarGroup({ items }: { items: VpSidebarItem[] }) {
  const [disableTransition, setDisableTransition] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setDisableTransition(false), 300)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      {items.map((item, i) => (
        <div
          key={item.text ?? i}
          className={cx(
            'group',
            disableTransition && cx('noTransition', 'no-transition')
          )}
        >
          <VPSidebarItem item={item} depth={0} />
        </div>
      ))}
    </>
  )
}
