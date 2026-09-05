import { useEffect, useRef, useState } from 'react'

import { useData } from 'vitepress'

import { LocalSearchDialog, resolveLocalSearchText } from './local-search'
import s from './vp-nav-bar-search.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 顶栏搜索(Vue VPNavBarSearch.vue 的 React 版)。
 *
 * - `themeConfig.search === false` → 不渲染;
 * - `provider: 'algolia'`(或旧版 `theme.algolia`)→ 渲染触发器,点击后按需
 *   懒加载 @docsearch/js(运行时不联网构建);
 * - 其余(含未配置,与上游一致默认本地搜索)→ 打开本地搜索弹层
 *   (@localSearchIndex + minisearch,纯本地离线)。
 */
export function VPNavBarSearch({ className }: { className?: string }) {
  const { theme, lang, localeIndex } = useData()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const provider = (theme as { search?: unknown; algolia?: unknown }).search
  const isAlgolia =
    ((provider as { provider?: string } | undefined)?.provider ?? 'local') ===
    'algolia' ||
    !!(theme as { algolia?: unknown }).algolia
  const text = resolveLocalSearchText(theme, lang, localeIndex ?? '')

  // Ctrl/Cmd+K(本地搜索):打开/关闭
  useEffect(() => {
    if (isAlgolia) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAlgolia])

  if (provider === false) return null

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onTriggerClick = () => {
    if (isAlgolia) {
      // 运行时按需加载 docsearch(不静态引入,避免构建/SSG 联网)
      void import('@docsearch/js').catch(() => {})
      return
    }
    setOpen(true)
  }

  return (
    <div className={cx('VPNavBarSearch', className)}>
      <button
        ref={triggerRef}
        className={s.btn}
        type="button"
        aria-label={text.buttonAriaLabel}
        onClick={onTriggerClick}
      >
        <span className="vpi-search icon" />
        <span className={s.text}>{text.buttonText}</span>
        <kbd className={s.kbd}>Ctrl K</kbd>
      </button>
      {!isAlgolia && <LocalSearchDialog open={open} onClose={close} />}
    </div>
  )
}

/** 兼容旧名(内部即本地/algolia 分发的 VPNavBarSearch) */
export const VPNavBarSearchButton = VPNavBarSearch
