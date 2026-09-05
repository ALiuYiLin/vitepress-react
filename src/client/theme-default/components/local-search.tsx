/**
 * 本地搜索弹层(Vue VPLocalSearchBox.vue 的 React 版)。
 *
 * 数据源:服务端 localSearchPlugin 生成的虚拟模块 `@localSearchIndex`
 * (按 locale 懒加载,payload 为 MiniSearch 序列化 JSON)。全部本地离线:
 * minisearch 查询、关键词 <mark> 高亮、键盘/鼠标导航、sessionStorage
 * 持久化(disableQueryPersistence 可关)。样式结构对齐 Vue 版
 * (vp-local-search.module.css,使用 --vp-local-search-* 变量)。
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

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

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
interface RawTranslations {
  button?: ButtonText
  modal?: ModalText
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
      noResultsText: zh ? '未找到相关结果' : 'No results for',
      resetButtonTitle: zh ? '清除查询' : 'Reset search',
      backButtonTitle: zh ? '关闭搜索' : 'Close search',
      displayDetails: zh ? '展开详细列表' : 'Display detailed list',
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
            selectKeyAriaLabel: 'enter',
            navigateUpKeyAriaLabel: 'up arrow',
            navigateDownKeyAriaLabel: 'down arrow',
            closeKeyAriaLabel: 'escape'
          }
    }
  }
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
// 工具:实体解码 + 高亮
// ---------------------------------------------------------------------------

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

function escapeRe(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightParts(text: string, query: string): ReactNode[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0 || !text) return [text]
  const re = new RegExp(`(${tokens.map((t) => escapeRe(t)).join('|')})`, 'gi')
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

// ---------------------------------------------------------------------------
// 索引 / 查询
// ---------------------------------------------------------------------------

interface Hit {
  id: string
  title: string
  titles: string[]
}

const BASE_FIELDS = ['title', 'titles', 'text']
const BASE_STORE_FIELDS = ['title', 'titles']

type SearchQueryOptions = NonNullable<Parameters<MiniSearch['search']>[1]>
const BASE_SEARCH_OPTIONS: SearchQueryOptions = {
  prefix: true,
  fuzzy: 0.2,
  combineWith: 'AND',
  boost: { title: 4, text: 2, titles: 1 }
}

const FILTER_STORAGE_KEY = 'vitepress:local-search-filter'

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
  const [active, setActive] = useState(-1)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLUListElement>(null)
  const initializedStorageRef = useRef(false)

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
      ? ((index.search(query.trim(), searchOptions) as unknown as Hit[]).slice(
          0,
          16
        ) as Hit[])
      : []

  // 打开时加载当前 locale 索引(懒加载,进程内仅一次);恢复 sessionStorage
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

    if (!initializedStorageRef.current && !disableQueryPersistence) {
      initializedStorageRef.current = true
      try {
        const stored = sessionStorage.getItem(FILTER_STORAGE_KEY)
        if (stored) setQuery(stored)
      } catch {
        /* ignore */
      }
    }
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localeKey])

  // query → sessionStorage 持久化(上游 disableQueryPersistence 开关)
  useEffect(() => {
    if (disableQueryPersistence) return
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, query)
    } catch {
      /* ignore */
    }
  }, [query, disableQueryPersistence])

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
    setSearched(Boolean(query.trim()))
  }, [query])

  useEffect(() => {
    setActive(hits.length ? 0 : -1)
  }, [query, hits.length])

  // 高亮项滚动到可视区
  useEffect(() => {
    const el = resultsRef.current?.querySelector<HTMLElement>(
      '[data-selected="true"]'
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
      if (!hits.length) return
      setActive((v) => (v + 1 >= hits.length ? 0 : v + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!hits.length) return
      setActive((v) => (v <= 0 ? hits.length - 1 : v - 1))
      return
    }
    if (e.key === 'Enter' && e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement
      if (target instanceof HTMLButtonElement) return
      if (hits.length === 0) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      choose(active >= 0 ? active : 0)
    }
  }

  const noResultsText = translations.modal.noResultsText ?? 'No results for'

  const modal = (
    <div className={s.overlayRoot}>
      <div className={s.backdrop} onClick={onClose} />

      <div className={s.shell} onKeyDown={onKeyDown}>
        <form
          className={s.searchBar}
          role="search"
          onSubmit={(e) => e.preventDefault()}
        >
          <span
            aria-hidden="true"
            className={cx('vpi-search', s.searchIcon, 'local-search-icon')}
          />
          <input
            ref={inputRef}
            className={s.input}
            type="search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-autocomplete="both"
            aria-label={
              translations.button.buttonAriaLabel ??
              translations.button.buttonText ??
              'Search'
            }
            placeholder={translations.button.buttonText ?? 'Search'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="go"
            maxLength={64}
            spellCheck={false}
          />
          <div className={s.actions}>
            <span
              className={cx(s.spinner, (!loaded && !loadError) && s.active)}
              role={!loaded && !loadError ? 'status' : undefined}
              aria-live="polite"
            />
            <button
              className={s.clearButton}
              type="reset"
              disabled={query.length === 0}
              title={translations.modal.resetButtonTitle ?? 'Reset search'}
              aria-label={translations.modal.resetButtonTitle ?? 'Reset search'}
              onClick={() => {
                setQuery('')
                requestAnimationFrame(() => inputRef.current?.focus())
              }}
            >
              <span className="vpi-delete local-search-icon" />
            </button>
          </div>
        </form>

        {loaded && !loadError && (
          <ul ref={resultsRef} className={s.results} role="listbox">
            {hits.map((hit, i) => {
              const selected = i === active
              const ancestors = (hit.titles ?? []).filter(Boolean)
              const mainTitle = (hit.title ?? '').trim()
              const ariaLabel = [...ancestors, mainTitle].join(' > ')
              return (
                <li key={hit.id} className={s.resultItem} role="option">
                  <a
                    className={cx(s.result, selected && s.selected)}
                    data-selected={selected || undefined}
                    href={resultHref(hit.id)}
                    aria-label={ariaLabel}
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.button !== 0
                      )
                        return
                      e.preventDefault()
                      choose(i)
                    }}
                  >
                    <div className={s.resultBody}>
                      <div className={s.titles}>
                        <span className={s.titleIcon} aria-hidden="true">
                          #
                        </span>
                        {ancestors.map((t, ai) => (
                          <span key={ai} className={s.title}>
                            <span className={s.titleText}>
                              {highlightParts(decodeHtmlEntities(t), query)}
                            </span>
                            <span
                              aria-hidden="true"
                              className={cx(
                                'vpi-chevron-right',
                                s.separatorIcon
                              )}
                            />
                          </span>
                        ))}
                        {mainTitle && (
                          <span className={cx(s.title, s.titleMain)}>
                            <span className={s.titleText}>
                              {highlightParts(decodeHtmlEntities(mainTitle), query)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                </li>
              )
            })}
            {searched && hits.length === 0 && (
              <li className={s.noResults}>
                {noResultsText} <strong>“{query.trim()}”</strong>
              </li>
            )}
          </ul>
        )}
        {loadError && (
          <ul className={s.results}>
            <li className={s.noResults}>{noResultsText}</li>
          </ul>
        )}

        <div className={s.shortcuts}>
          <span>
            <kbd
              aria-label={translations.modal.footer?.navigateUpKeyAriaLabel}
            >
              <span className={cx('vpi-arrow-up', s.navigateIcon)} />
            </kbd>
            <kbd
              aria-label={translations.modal.footer?.navigateDownKeyAriaLabel}
            >
              <span className={cx('vpi-arrow-down', s.navigateIcon)} />
            </kbd>
            {translations.modal.footer?.navigateText ?? 'to navigate'}
          </span>
          <span>
            <kbd aria-label={translations.modal.footer?.selectKeyAriaLabel}>
              <span className={cx('vpi-corner-down-left', s.navigateIcon)} />
            </kbd>
            {translations.modal.footer?.selectText ?? 'to select'}
          </span>
          <span>
            <kbd aria-label={translations.modal.footer?.closeKeyAriaLabel}>
              esc
            </kbd>
            {translations.modal.footer?.closeText ?? 'to close'}
          </span>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
