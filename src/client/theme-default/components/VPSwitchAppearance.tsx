import { useAppearance, useData } from 'vitepress'

import { VPSwitch } from './VPSwitch'
import s from './VPSwitchAppearance.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 外观切换开关(稳定名称 + aria-checked;标题为操作提示) */
export function VPSwitchAppearance({ ariaLabelledby }: { ariaLabelledby?: string }) {
  const { theme } = useData()
  const { isDark, toggle } = useAppearance()
  const t = theme as {
    lightModeSwitchTitle?: string
    darkModeSwitchTitle?: string
    darkModeSwitchLabel?: string
  }
  const title = isDark
    ? t.lightModeSwitchTitle || 'Switch to light theme'
    : t.darkModeSwitchTitle || 'Switch to dark theme'
  return (
    <VPSwitch
      className="VPSwitchAppearance"
      title={title}
      ariaLabel={ariaLabelledby ? undefined : t.darkModeSwitchLabel || 'Appearance'}
      ariaLabelledby={ariaLabelledby}
      ariaChecked={isDark}
      onClick={toggle}
    >
      <span className={cx('vpi-sun', s.sun)} aria-hidden="true" />
      <span className={cx('vpi-moon', s.moon)} aria-hidden="true" />
    </VPSwitch>
  )
}
