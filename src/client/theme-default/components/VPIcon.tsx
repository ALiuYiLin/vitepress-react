import '../styles/components/VPIcon.scoped.css'
import { useIcon } from '../composables/use-icon'

export type VPIconProps = {
  icon: string | { svg: string }
}

/**
 * 对应 Vue VPIcon.vue。
 * - 对象形态({svg})直接内联 SVG;
 * - 字符串形态交 `useIcon()`:解析成 `vpi-<collection>-<name>` 类,并在
 *   SSR 登记图标名(build 生成 CSS)、dev 按需取 `/_vpi/...svg`。
 */
export function VPIcon({ icon }: VPIconProps) {
  const { iconClass, ref } = useIcon(icon)

  if (typeof icon === 'object') {
    return (
      <span className="VPIcon" dangerouslySetInnerHTML={{ __html: icon.svg }} />
    )
  }

  return <span ref={ref} className={iconClass} />
}
