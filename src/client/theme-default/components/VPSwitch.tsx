import * as React from 'react'

import s from './VPSwitch.module.css'

/** 开关(外观切换用;children 为图标) */
export function VPSwitch({
  children,
  title,
  ariaLabel,
  ariaLabelledby,
  ariaChecked,
  onClick,
  className
}: {
  children?: React.ReactNode
  title?: string
  ariaLabel?: string
  ariaLabelledby?: string
  ariaChecked?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      className={cx(s.switch, 'VPSwitch', className)}
      type="button"
      role="switch"
      title={title}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-checked={ariaChecked}
      onClick={onClick}
    >
      <span className={s.check}>
        {children ? <span className={s.icon}>{children}</span> : null}
      </span>
    </button>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
