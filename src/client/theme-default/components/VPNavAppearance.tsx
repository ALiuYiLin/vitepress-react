import { useId } from 'react'
import { useData } from 'vitepress'

import { useAppearanceSwitch } from '../composables/use-nav'
import { useNavOverflow } from '../composables/use-nav-overflow'
import { VPSwitchAppearance } from './VPSwitchAppearance'
const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 外观切换(对应 Vue VPNavAppearance.vue):
 * 默认顶栏内为裸开关(row=false);屏幕内/⋯ 菜单里为带文字行(row=true)。
 */
export function VPNavAppearance({
  row,
  screen,
  className
}: {
  /** 带文字行(屏幕导航/⋯ 菜单)而非裸开关 */
  row?: boolean
  /** 行样式的上下文:屏幕导航 */
  screen?: boolean
  className?: string
}) {
  const { theme } = useData()
  const t = theme as { darkModeSwitchLabel?: string }
  const show = useAppearanceSwitch()
  // 只有顶栏内联开关参与溢出引擎
  const overflow = row ? null : useNavOverflow()
  const isCollapsed = Boolean(overflow) && !overflow!.state.appearance
  const labelId = useId()

  if (!show) return null

  const variant = row
    ? screen
      ? 'VPNavScreenAppearance'
      : 'menu-appearance'
    : 'VPNavBarAppearance'

  return (
    <div
      className={cx('VPNavAppearance', variant, isCollapsed && 'collapsed', className)}
    >
      {row ? (
        <p id={labelId} className="text">
          {t.darkModeSwitchLabel || 'Appearance'}
        </p>
      ) : null}
      <VPSwitchAppearance ariaLabelledby={row ? labelId : undefined} />
    </div>
  )
}
