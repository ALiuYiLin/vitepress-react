import '../styles/components/VPIcon.scoped.css'
import { parseIconName } from '../../shared'

export type VPIconProps = {
  icon: string | { svg: string }
}

/**
 * 对应 Vue VPIcon.vue。
 * - 对象形态({svg})直接 v-html 注入 SVG;
 * - 字符串形态上游用 useIcon() 解析图标类名,React 侧暂无该 hook,
 *   近似实现:parseIconName 解析 `collection:name` → `vpi-<collection>-<name>`。
 */
export function VPIcon({ icon }: VPIconProps) {
  if (typeof icon === 'object') {
    return (
      <span
        className="VPIcon"
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    )
  }

  const parsed = parseIconName(icon)
  const iconClass = parsed
    ? `vpi-${parsed.collection}-${parsed.icon}`
    : /^[\w-]+$/.test(icon)
      ? icon
      : ''
  return <span className={iconClass} />
}
