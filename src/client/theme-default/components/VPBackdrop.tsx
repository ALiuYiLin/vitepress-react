import s from './VPBackdrop.module.css'

export type VPBackdropProps = {
  show: boolean
  onClick?: () => void
}

/**
 * 对应 Vue VPBackdrop.vue(Vue <transition name="fade"> 的进出场动画,
 * React 侧近似:挂载淡入,卸载即时)。
 */
export function VPBackdrop({ show, onClick }: VPBackdropProps) {
  if (!show) return null
  return <div className={s.VPBackdrop} onClick={onClick} />
}
