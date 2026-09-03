// 正文复制按钮交互(markdown preWrapper 输出 `<button class="copy">`)。
//
// 与 React 渲染无关:内容区域每次导航由 React 重建,但事件在 document 层
// 委托注册一次即可,重建后依然有效(等价于上游 Vue 版的全局 click 监听)。
// 无第三方依赖(迁移 D7:此功能简单,无需等价库)。
export function setupCopyButtons(): () => void {
  if (typeof document === 'undefined') return () => {}

  const copyTextFallback = (text: string) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* ignore */
    }
    ta.remove()
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element | null
    const btn = target?.closest?.('button.copy') as HTMLButtonElement | null
    if (!btn) return
    const wrapper = btn.closest(
      'div[class*="language-"]'
    ) as HTMLElement | null
    const code = wrapper?.querySelector('pre code')
    if (!code) return
    e.preventDefault()
    const text = code.textContent ?? ''

    const flash = () => {
      btn.classList.add('copied')
      window.setTimeout(() => btn.classList.remove('copied'), 1600)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flash, () => flash())
    } else {
      copyTextFallback(text)
      flash()
    }
  }

  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}
