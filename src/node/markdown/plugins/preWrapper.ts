import type { MarkdownItAsync } from 'markdown-it-async'

import type { MarkdownEnv, MarkdownLocaleOptions } from '../../shared'

export interface Options {
  codeCopyButton: { tooltipText: string; copiedText: string }
  languageLabel?: Record<string, string>
  /**
   * Per-locale overrides for the copy button strings, keyed by locale index.
   */
  locales?: Record<string, MarkdownLocaleOptions | undefined>
}

export function preWrapperPlugin(md: MarkdownItAsync, options: Options) {
  const langLabel = Object.fromEntries(
    Object.entries(options.languageLabel || {}) //
      .map(([k, v]) => [k.toLowerCase(), v])
  )

  const fence = md.renderer.rules.fence!
  md.renderer.rules.fence = (...args) => {
    const [tokens, idx, , env] = args
    const token = tokens[idx]

    // 代码块标题(```lang [title]):先于剥离捕获;code-group 内块由容器
    // 插件打 data-no-title 标记(标题已作 tab 名),只剥不渲染
    const title = token.info.match(/\[(.*)\]/)?.[1]
    // remove title from info
    token.info = token.info.replace(/\[.*\]/, '')

    const active = / active( |$)/.test(token.info) ? ' active' : ''
    token.info = token.info.replace(/ active$/, '').replace(/ active /, ' ')

    const lang = extractLang(token.info)
    const label = langLabel[lang.toLowerCase()] || lang.replace(/_/g, ' ')

    const { localeIndex } = (env ?? {}) as MarkdownEnv
    const localeButton = localeIndex
      ? options.locales?.[localeIndex]?.codeCopyButton
      : undefined
    const tooltipText =
      localeButton?.tooltipText || options.codeCopyButton.tooltipText
    // rendered by the theme via `content: attr(data-copied)`
    const copiedText =
      localeButton?.copiedText || options.codeCopyButton.copiedText

    const titleBlock =
      title && !token.attrGet('data-no-title')
        ? `<div class="vp-code-block-title">${md.utils.escapeHtml(title)}</div>`
        : ''

    return (
      `<div class="language-${lang}${active}">` +
      `<button title="${tooltipText}" data-copied="${copiedText}" class="copy"></button>` +
      `<span class="lang">${label}</span>` +
      titleBlock +
      fence(...args) +
      '</div>'
    )
  }
}

export function extractTitle(info: string, html = false) {
  if (html) {
    return (
      info.replace(/<!--[^]*?-->/g, '').match(/data-title="(.*?)"/)?.[1] || ''
    )
  }
  return info.match(/\[(.*)\]/)?.[1] || extractLang(info) || 'txt'
}

function extractLang(info: string): string {
  return (
    /^[a-zA-Z0-9-_]+/
      .exec(info)?.[0]
      .replace(/-vue$/, '') // remove -vue suffix
      .replace(/^vue-html$/, 'template')
      .replace(/^ansi$/, '') || ''
  )
}
