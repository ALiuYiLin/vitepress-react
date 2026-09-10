import { useEffect, useRef, type RefObject } from 'react'

import { useSSRIconRegistry } from '../../app/ssr-icons'
import { withBase } from '../../app/utils'
import { inBrowser, parseIconName } from '../../shared'

export interface UseIconResult {
  /** `vpi-<collection>-<name>`(或字面类名);无法解析时为 undefined */
  iconClass?: string
  ref: RefObject<HTMLSpanElement | null>
}

/**
 * 把图标名解析成 `vpi-<collection>-<name>` 类,并按环境补齐图标本体
 * (对齐上游 Vue `app/composables/icon.ts` 的 useIcon):
 *
 * - **SSR / build**:没有样式表可依赖,只把名字登记进 {@link SSRIconsContext},
 *   由 build 收尾时生成 `vp-icons.{hash}.css` 的 mask 规则;
 * - **dev**:dev server 没有生成的样式表,挂载后按需取
 *   `/_vpi/<collection>/<name>.svg` 并把 `--icon` 内联到元素上;主题若没带
 *   默认图标规则(自定义主题),再补一份 mask 基础设置。
 *
 * 兼容旧行为:形如类名的字符串(如 `vpi-languages`)按字面类名使用,不做登记
 * (否则会被 generateIconsCSS 当成"缺少 collection 前缀"而误报)。
 */
export function useIcon(icon: string | { svg: string }): UseIconResult {
  const ref = useRef<HTMLSpanElement | null>(null)
  const applied = useRef<string | undefined>(undefined)
  const registry = useSSRIconRegistry()

  const parsed = typeof icon === 'string' ? parseIconName(icon) : null
  const iconClass = parsed
    ? `vpi-${parsed.collection}-${parsed.icon}`
    : typeof icon === 'string' && /^[\w-]+$/.test(icon)
      ? icon
      : undefined

  // SSR:登记图标名,build 期据此生成图标 CSS
  if (!inBrowser && registry && parsed) {
    registry.add(icon as string)
  }

  const key = parsed ? `${parsed.collection}/${parsed.icon}` : undefined
  useEffect(() => {
    if (!inBrowser || !import.meta.env.DEV || !key) return
    const el = ref.current
    if (!el || applied.current === key) return
    applied.current = key
    el.style.setProperty('--icon', `url('${withBase(`/_vpi/${key}.svg`)}')`)

    // 自定义主题不一定带默认图标规则 → 内联补上(基于 mask 的图标渲染)
    const styles = getComputedStyle(el)
    const maskImage =
      styles.maskImage || styles.getPropertyValue('-webkit-mask-image')
    if (!maskImage || maskImage === 'none') {
      el.style.display = 'inline-block'
      el.style.width = '1em'
      el.style.height = '1em'
      el.style.setProperty('mask', 'var(--icon) no-repeat')
      el.style.setProperty('-webkit-mask', 'var(--icon) no-repeat')
      el.style.setProperty('mask-size', '100% 100%')
      el.style.setProperty('-webkit-mask-size', '100% 100%')
      el.style.backgroundColor = 'currentColor'
    }
  }, [key])

  return { iconClass, ref }
}
