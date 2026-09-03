import * as React from 'react'

import s from './VPSwitch.module.css'

/** 开关(外观切换用;children 为图标) */
export function VPSwitch({ children }: { children?: React.ReactNode }) {
  return (
    <button className={cx(s.switch, 'VPSwitch')} type="button" role="switch">
      <span className={s.check}>
        {children ? <span className={s.icon}>{children}</span> : null}
      </span>
    </button>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
