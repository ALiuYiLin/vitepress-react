import { useEffect, useRef, useState } from 'react'

import { useData } from '@10coding/vitepress-react'

import { LocalSearchDialog, resolveLocalSearchText } from './local-search'
import '../styles/components/vp-nav-bar-search.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

function isEditingContent(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    el.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'TEXTAREA'
  )
}

/**
 * 顶栏搜索(Vue VPNavBarSearch.vue 的 React 版)。
 *
 * - `themeConfig.search === false` → 不渲染;
 * - `provider: 'algolia'`(或旧版 `theme.algolia`)→ 触发器点击后按需懒加载
 *   @docsearch/js(不联网构建);
 * - 其余(未配置 / 'local',与上游一致默认本地搜索)→ 打开本地搜索弹层
 *   (@localSearchIndex + minisearch,纯本地离线);Ctrl/Cmd+K 与 `/` 触发。
 */
export function VPNavBarSearch({ className }: { className?: string }) {
  const { theme, lang, localeIndex } = useData()
  const [open, setOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const provider = (theme as { search?: unknown; algolia?: unknown }).search
  const isAlgolia =
    ((provider as { provider?: string } | undefined)?.provider ?? 'local') ===
    'algolia' ||
    !!(theme as { algolia?: unknown }).algolia
  const text = resolveLocalSearchText(theme, lang, localeIndex ?? '')

  // 全局快捷键(本地搜索):Ctrl/Cmd+K、`/`;mac 检测供键帽文案
  useEffect(() => {
    if (isAlgolia) return
    try {
      if (
        typeof navigator !== 'undefined' &&
        /mac/i.test(navigator.platform ?? '')
      ) {
        setIsMac(true)
      }
    } catch {
      /* ignore */
    }
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (key === 'k') {
          e.preventDefault()
          setOpen((v) => !v)
        }
      } else if (key === '/' && !isEditingContent(e)) {
        e.preventDefault()
        setOpen(true)
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
        className="button"
        type="button"
        aria-label={text.buttonAriaLabel}
        aria-keyshortcuts="'/' control+k meta+k"
        onClick={onTriggerClick}
      >
        <span className="vpi-search" aria-hidden="true" />
        <span className="text">{text.buttonText}</span>
        <span className="keys" aria-hidden="true">
          <kbd className="key-mod">{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd className="key-k">K</kbd>
        </span>
      </button>
      {!isAlgolia && <LocalSearchDialog open={open} onClose={close} />}
    </div>
  )
}

/** 兼容旧名(内部即本地/algolia 分发的 VPNavBarSearch) */
export const VPNavBarSearchButton = VPNavBarSearch
