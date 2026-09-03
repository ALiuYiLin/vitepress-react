import { useEffect, useState } from 'react'

/** 焦点是否位于 el 内(供 flyout 关闭判断) */
export function useFlyout(
  el: React.RefObject<HTMLElement | null>,
  onFocus?: () => void,
  onBlur?: () => void
) {
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    const node = el.current
    if (!node) return
    const handleFocus = () => {
      setFocus(true)
      onFocus?.()
    }
    const handleBlur = () => {
      setFocus(false)
      onBlur?.()
    }
    node.addEventListener('focusin', handleFocus)
    node.addEventListener('focusout', handleBlur)
    return () => {
      node.removeEventListener('focusin', handleFocus)
      node.removeEventListener('focusout', handleBlur)
    }
  }, [el, onFocus, onBlur])
  return { focus }
}
