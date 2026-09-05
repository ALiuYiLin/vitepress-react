import * as React from 'react'

import '../styles/components/VPSwitch.scoped.css'

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
      className={cx('VPSwitch', 'switch', className)}
      type="button"
      role="switch"
      title={title}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-checked={ariaChecked}
      onClick={onClick}
    >
      <span className="check">
        {children ? <span className="icon">{children}</span> : null}
      </span>
    </button>
  )
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
