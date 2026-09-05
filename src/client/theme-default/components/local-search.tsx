/**
 * 本地搜索弹层(Vue LocalSearch.vue 的 React 版)。
 *
 * 数据源:服务端 localSearchPlugin 生成的虚拟模块 `@localSearchIndex`
 * (按 locale 懒加载,payload 为 MiniSearch 序列化 JSON)。全部本地离线:
 * minisearch 查询、关键词高亮、键盘导航、URL query 持久化(可关闭)。
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import MiniSearch from 'minisearch'
import { useData, useRouter, withBase } from 'vitepress'

import s from './vp-local-search.module.css'

// ---------------------------------------------------------------------------
// 翻译(与 types/local-search.d.ts 对齐;缺省按 lang 提供 zh/en 兜底)
// ---------------------------------------------------------------------------

interface ButtonText {
  buttonText?: string
  buttonAriaLabel?: string
}
interface FooterText {
  selectText?: string
  navigateText?: string
  closeText?: string
  selectKeyAriaLabel?: string
  navigateUpKeyAriaLabel?: string
  navigateDownKeyAriaLabel?: string
  closeKeyAriaLabel?: string
}
interface ModalText {
  noResultsText?: string
  resetButtonTitle?: string
  backButtonTitle?: string
  displayDetails?: string
  footer?: FooterText
}

function defaultTranslations(lang: string): {
  button: ButtonText
  modal: ModalText
} {
  const zh = lang.toLowerCase().startsWith('zh')
  return {
    button: zh
      ? { buttonText: '搜索', buttonAriaLabel: '搜索' }
      : { buttonText: 'Search', buttonAriaLabel: 'Search' },
    modal: {
      noResultsText: zh ? '未找到相关结果。' : 'No results for your search query.',
      resetButtonTitle: zh ? '清除查询' : 'Clear query',
      backButtonTitle: zh ? '返回上一级' : 'Go back',
      displayDetails: zh ? '展开详细结果' : 'Display detailed list',
      footer: zh
        ? {
            selectText: '选择',
            navigateText: '切换',
            closeText: '关闭',
            selectKeyAriaLabel: '回车键',
            navigateUpKeyAriaLabel: '向上箭头',
            navigateDownKeyAriaLabel: '向下箭头',
            closeKeyAriaLabel: 'Esc 键'
          }
        : {
            selectText: 'to select',
            navigateText: 'to navigate',
            closeText: 'to close',
            selectKeyAriaLabel: 'Enter',
            navigateUpKeyAriaLabel: 'Arrow up',
            navigateDownKeyAriaLabel: 'Arrow down',
            closeKeyAriaLabel: 'Escape'
          }
    }
  }
}

interface RawTranslations {
  button?: ButtonText
  modal?: ModalText
}

/** 深度合并按钮/弹层/底部翻译(配置 > 当前 locale 覆盖 > lang 兜底) */
function mergeTranslations(
  lang: string,
  ...overrides: (RawTranslations | undefined)[]
): { button: ButtonText; modal: ModalText } {
  const base = defaultTranslations(lang)
  const patch = (a: FooterText, b?: FooterText): FooterText => ({ ...a, ...b })
  const apply = (acc: { button: ButtonText; modal: ModalText }, o?: RawTranslations) => {
    if (!o) return acc
    acc.button = { ...acc.button, ...o.button }
    acc.modal = { ...acc.modal, ...o.modal }
    acc.modal.footer = patch(acc.modal.footer ?? {}, o.modal?.footer)
    return acc
  }
  return overrides.reduce(apply, {
    button: { ...base.button },
    modal: { ...base.modal, footer: { ...base.modal.footer } }
  })
}

// ---------------------------------------------------------------------------
// 查询高亮
// ---------------------------------------------------------------------------

function highlightParts(text: string, query: string): ReactNode[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0 || !text) return [text]
  const re = new RegExp(
    `(${tokens.map((t) => escapeRe(t)).join('|')})`,
    'gi'
  )
  const parts = text.split(re)
  return parts.map((part, i) => {
    re.lastIndex = 0
    return re.test(part) ? (
      // eslint-disable-next-line react/no-array-index-key
      <mark key={i}>{part}</mark>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{part}</span>
    )
  })
}

function escapeRe(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 服务端索引里的标题来自 HTML,含 &lt; 等实体;展示前解码 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

/**
 * 解析当前主题/语言下的搜索文案(按钮 + 弹层),供触发器与弹层共用。
 * 层级:lang 兜底 < root search.options.translations <
 * search.options.locales[locale].translations。
 */
export function resolveLocalSearchText(
  theme: unknown,
  lang: string,
  localeIndex = ''
): { buttonText: string; buttonAriaLabel: string; modal: ModalText } {
  const search = ((theme as { search?: any })?.search ?? {}) as {
    options?: Record<string, any>
    translations?: RawTranslations
  }
  const rootOptions = search.options ?? {}
  const localeOptions =
    (rootOptions.locales as Record<string, { translations?: RawTranslations }> |
      undefined)?.[localeIndex] ?? {}
  const merged = mergeTranslations(
    lang,
    rootOptions.translations,
    localeOptions.translations,
    search.translations
  )
  return {
    buttonText: merged.button.buttonText ?? 'Search',
    buttonAriaLabel: merged.button.buttonAriaLabel ?? 'Search',
    modal: merged.modal
  }
}

// ---------------------------------------------------------------------------
// 索引 / 查询
// ---------------------------------------------------------------------------

interface Hit {
  id: string
  title: string
  titles: string[]
  score: number
}

const BASE_FIELDS = ['title', 'titles', 'text']
const BASE_STORE_FIELDS = ['title', 'titles']

type SearchQueryOptions = NonNullable<Parameters<MiniSearch['search']>[1]>
const BASE_SEARCH_OPTIONS: SearchQueryOptions = {
  prefix: true,
  fuzzy: 0.2,
  combineWith: 'AND'
}

export function LocalSearchDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { theme, lang, localeIndex } = useData()
  const router = useRouter()
  const search = (theme as { search?: any }).search ?? {}
  const rootOptions = (search.options ?? {}) as Record<string, unknown>
  const localeKey = localeIndex ?? ''
  const localeOptions =
    ((rootOptions.locales as Record<string, Record<string, unknown>> | undefined) ??
      {})[localeKey] ?? {}
  const mergedOptions = { ...rootOptions, ...localeOptions }
  const translations = mergeTranslations(
    lang,
    rootOptions.translations as RawTranslations | undefined,
    (localeOptions.translations as RawTranslations | undefined) ?? undefined,
    search.translations as RawTranslations | undefined
  )
  const disableQueryPersistence =
    mergedOptions.disableQueryPersistence === true

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<MiniSearch | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const initializedQueryRef = useRef(false)

  const searchOptions: SearchQueryOptions = {
    ...BASE_SEARCH_OPTIONS,
    ...((mergedOptions.miniSearch as { searchOptions?: object } | undefined)
      ?.searchOptions as SearchQueryOptions | undefined)
  }
  const miniOptions = {
    fields: BASE_FIELDS,
    storeFields: BASE_STORE_FIELDS,
    ...((mergedOptions.miniSearch as { options?: object } | undefined)
      ?.options ?? {})
  }
  const hits: Hit[] =
    index && query.trim()
      ? (index.search(query.trim(), searchOptions) as unknown as Hit[])
      : []

  // 打开时加载当前 locale 索引(懒加载,进程内仅一次)
  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      try {
        if (!index) {
          const mods = (await import('@localSearchIndex')).default
          const loader = mods[localeKey] ?? mods['']
          if (!loader) throw new Error(`no local search index for ${localeKey}`)
          const raw = (await loader()).default
          // loader 的 default 是 MiniSearch 序列化 JSON 文本(插件 export
          // default ${JSON.stringify(indexJSON)}),loadJSON 直接接收字符串
          const mini = MiniSearch.loadJSON(raw, miniOptions)
          if (alive) setIndex(mini)
        }
        if (alive) setLoaded(true)
      } catch {
        if (alive) setLoadError(true)
      }
    })()

    // URL query 恢复上次查询(默认开启;disableQueryPersistence 关闭)
    if (!initializedQueryRef.current && !disableQueryPersistence) {
      initializedQueryRef.current = true
      try {
        const q = new URLSearchParams(window.location.search).get('q')
        if (q) setQuery(q)
      } catch {
        /* ignore */
      }
    }
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localeKey])

  // query → URL 持久化
  useEffect(() => {
    if (!open || disableQueryPersistence || !query) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('q', query)
      history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch {
      /* ignore */
    }
  }, [query, open, disableQueryPersistence])

  // 打开时锁 body 滚动
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    setActive(0)
    if (resultsRef.current) resultsRef.current.scrollTop = 0
  }, [query])

  // 高亮项滚动到可视区
  useEffect(() => {
    const el = resultsRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]'
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const resultHref = (id: string): string => {
    const idx = id.indexOf('#')
    const path = idx === -1 ? id : id.slice(0, idx)
    const hash = idx === -1 ? '' : id.slice(idx)
    return withBase(path) + hash
  }

  const goResult = (id: string) => {
    void router.go(resultHref(id))
    onClose()
  }

  const choose = (i: number) => {
    const hit = hits[i]
    if (hit) goResult(hit.id)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((v) => Math.min(v + 1, Math.max(hits.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((v) => Math.max(v - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      choose(active)
    }
  }

  const hasQuery = query.trim().length > 0
  const empty = loaded && hasQuery && hits.length === 0

  // 分组:同一文档(去掉锚点)的结果相邻时合并为一个 group
  const groups: { docId: string; items: Hit[] }[] = []
  for (const hit of hits) {
    const docId = (hit.id ?? '').split('#')[0] ?? ''
    const last = groups[groups.length - 1]
    if (last && last.docId === docId) last.items.push(hit)
    else groups.push({ docId, items: [hit] })
  }

  const modal = (
    <div className={s.overlay} role="presentation" onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={
          translations.button.buttonAriaLabel ??
          translations.button.buttonText ??
          'Search'
        }
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={s.header}>
          <span className={cx('vpi-search', s.icon)} aria-hidden="true" />
          <input
            ref={inputRef}
            className={s.input}
            type="text"
            role="combobox"
            aria-expanded={hasQuery}
            aria-controls="vp-local-search-results"
            aria-autocomplete="list"
            aria-label={translations.button.buttonAriaLabel ?? 'Search'}
            placeholder={translations.button.buttonText ?? 'Search'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              className={s.reset}
              type="button"
              title={translations.modal.resetButtonTitle ?? 'Clear query'}
              aria-label={translations.modal.resetButtonTitle ?? 'Clear query'}
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
            >
              ×
            </button>
          )}
        </div>

        <div
          ref={resultsRef}
          id="vp-local-search-results"
          className={s.results}
          role="listbox"
          aria-label="Results"
        >
          {loadError && (
            <div className={s.empty}>{translations.modal.noResultsText}</div>
          )}
          {!loaded && !loadError && <div className={s.loading} />}
          {empty && (
            <div className={s.empty}>{translations.modal.noResultsText}</div>
          )}
          {loaded &&
            groups.map((group, gi) => (
              <div key={group.docId} className={s.group}>
                {hits.length > 1 && (
                  <div className={s.docTitle}>
                    {group.docId.replace(/^\//, '')}
                  </div>
                )}
                {group.items.map((hit, ii) => {
                  const globalIndex =
                    groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0) +
                    ii
                  const activeIdx = globalIndex === active
                  const parts = [...(hit.titles ?? []), hit.title]
                    .filter(Boolean)
                    .map(decodeHtmlEntities)
                  return (
                    <a
                      key={hit.id}
                      data-active={activeIdx || undefined}
                      className={s.item}
                      role="option"
                      aria-selected={activeIdx}
                      href={resultHref(hit.id)}
                      onClick={(e) => {
                        if (
                          e.metaKey ||
                          e.ctrlKey ||
                          e.shiftKey ||
                          e.button !== 0
                        )
                          return
                        e.preventDefault()
                        choose(globalIndex)
                      }}
                      onMouseEnter={() => setActive(globalIndex)}
                    >
                      <span className={s.itemText}>
                        {highlightParts(parts.join(' / '), query)}
                      </span>
                    </a>
                  )
                })}
              </div>
            ))}
        </div>

        <div className={s.footer}>
          <span className={s.footerHint}>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {translations.modal.footer?.navigateText ?? 'to navigate'}
          </span>
          <span className={s.footerHint}>
            <kbd>Enter</kbd>
            {translations.modal.footer?.selectText ?? 'to select'}
          </span>
          <span className={s.footerHint}>
            <kbd>Esc</kbd>
            {translations.modal.footer?.closeText ?? 'to close'}
          </span>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')
