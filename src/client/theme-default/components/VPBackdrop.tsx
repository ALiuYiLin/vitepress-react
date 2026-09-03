import s from './VPBackdrop.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

export type VPBackdropProps = {
  show: boolean
  onClick?: () => void
  className?: string
}

/**
 * 对应 Vue VPBackdrop.vue(Vue <transition name="fade"> 的进出场动画,
 * React 侧近似:挂载淡入,卸载即时)。
 */
export function VPBackdrop({ show, onClick, className }: VPBackdropProps) {
  if (!show) return null
  return (
    <div className={cx(s.VPBackdrop, 'VPBackdrop', className)} onClick={onClick} />
  )
}
