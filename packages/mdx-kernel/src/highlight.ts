// mdx 代码块语法高亮(M2):shiki codeToHast + 与 md-it 线相同语义的
// transformers(meta 行高亮 {1,3-5}、行号 :line-numbers、diff/focus/
// highlight/error 注释记号),输出结构与 M1 preWrapper+lineNumbers 对齐:
//   div.language-<lang>[.active][.line-numbers-mode]
//     > button.copy + span.lang + pre(shiki) [+ div.line-numbers-wrapper]
// 这样默认主题的代码块样式与复制按钮交互无需改动即可复用。
//
// 编译管线配合:compile.ts 在 remarkRehype options 提供自定义 `code`
// handler,把 mdast code 暂存为带 data-lang/data-meta 的占位 pre;本文件的
// rehype 插件(async)随后替换为高亮结构。
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight
} from '@shikijs/transformers'
import type {
  BundledLanguage,
  CodeToHastOptions,
  ShikiTransformer
} from 'shiki'
import {
  createHighlighter,
  guessEmbeddedLanguages,
  isSpecialLang,
  type Highlighter
} from 'shiki'
import type { Element, Root } from 'hast'

/** 与主仓库 markdown.ts 的 ThemeOptions 相同形态(含自定义主题对象) */
export type HighlightTheme =
  | string
  | Record<string, any>
  | {
      light: string | Record<string, any>
      dark: string | Record<string, any>
    }

export interface HighlightTransformersOptions {
  codeTransformers?: ShikiTransformer[]
}

export interface CodeHighlightOptions {
  theme?: HighlightTheme
  /** 自定义语言或预装内置语言(与 markdown.ts languages 同义) */
  languages?: unknown[]
  languageAlias?: Record<string, string>
  defaultHighlightLang?: string
  codeTransformers?: ShikiTransformer[]
  colorReplacements?: CodeToHastOptions['colorReplacements']
  /** 高亮器就绪后的定制回调(如加载更多语言/主题) */
  shikiSetup?: (shiki: Highlighter) => void | Promise<void>
}

export interface CodeHighlightRuntime {
  /** 复制按钮文案(与 markdown.ts codeCopyButton 同义) */
  codeCopyButton?: { tooltipText?: string; copiedText?: string }
  languageLabel?: Record<string, string>
  /** 全局行号开关(meta 里 :line-numbers / :no-line-numbers 可逐块覆盖) */
  lineNumbers?: boolean
}

export interface CodeHighlighter {
  codeToHast(
    str: string,
    lang: string,
    meta: string,
    run: CodeHighlightRuntime
  ): Promise<Element | null>
  dispose(): void
}

export async function createCodeHighlighter(
  options: CodeHighlightOptions = {}
): Promise<CodeHighlighter> {
  const {
    theme,
    languages = [],
    languageAlias = {},
    defaultHighlightLang = 'txt',
    codeTransformers = [],
    colorReplacements = {}
  } = options

  const isDual =
    typeof theme === 'object' &&
    theme !== null &&
    'light' in theme &&
    'dark' in theme
  const isObjectTheme =
    typeof theme === 'object' && theme !== null && !('light' in theme)
  const themes: any[] = isDual
    ? [theme.light, theme.dark]
    : isObjectTheme
      ? [theme]
      : [typeof theme === 'string' ? theme : 'github-dark']

  const highlighter = await createHighlighter({
    themes,
    langs: [...(languages as any[]), ...Object.values(languageAlias)],
    langAlias: languageAlias
  })

  await options.shikiSetup?.(highlighter)

  const transformers: ShikiTransformer[] = [
    transformerMetaHighlight(),
    transformerNotationDiff(),
    transformerNotationFocus({
      classActiveLine: 'has-focus',
      classActivePre: 'has-focused-lines'
    }),
    transformerNotationHighlight(),
    transformerNotationErrorLevel(),
    {
      name: 'vitepress:add-dir',
      pre(node) {
        node.properties.dir = 'ltr'
      }
    }
  ]

  const dualTheme =
    typeof theme === 'object' && theme !== null && 'light' in theme

  return {
    async codeToHast(str, lang, meta, run) {
      const { lineNumbers = false, languageLabel, codeCopyButton } = run
      const tooltip = codeCopyButton?.tooltipText ?? 'Copy code'
      const copied = codeCopyButton?.copiedText ?? 'Copied'

      // 与 M1 preWrapper.extractLang 同步:首词为 lang,其余并入 meta
      const langRE = /^[a-zA-Z0-9-_]+/
      const match = langRE.exec(lang)
      if (match) {
        const orig = lang
        lang = match[0].toLowerCase()
        meta =
          orig.slice(lang.length).replace(/(?<!=)\{/g, ' {') + ' ' + meta
        meta = meta.trim().replace(/\s+/g, ' ')
      }
      lang ||= defaultHighlightLang

      try {
        // https://github.com/shikijs/shiki/issues/952
        if (
          !isSpecialLang(lang) &&
          !highlighter.getLoadedLanguages().includes(lang)
        ) {
          await highlighter.loadLanguage(lang as BundledLanguage)
        }
      } catch {
        lang = defaultHighlightLang
      }

      str = str.trimEnd()

      const embeddedLang = guessEmbeddedLanguages(str, lang, highlighter)
      await highlighter.loadLanguage(...(embeddedLang as BundledLanguage[]))

      const highlighted = await highlighter.codeToHast(str, {
        lang,
        meta: { __raw: meta },
        transformers: [...transformers, ...codeTransformers],
        ...(dualTheme
          ? { themes: theme as any, defaultColor: false }
          : {
              theme: (
                typeof theme === 'string' ? theme : theme ?? 'github-dark'
              ) as any
            }),
        colorReplacements: {
          'github-light': {
            '#959da5': '#6c676f',
            '#28a745': '#0e790b',
            '#b08800': '#846312',
            '#e36209': '#c13617',
            '#3192aa': '#05728b',
            '#d73a49': '#c62739',
            '#22863a': '#11782a',
            '#6a737d': '#62687b',
            '#1b7c83': '#06747a',
            '#0366d6': '#0663d0',
            '#cb2431': '#c82430'
          },
          'github-dark': {
            '#586069': '#5b93a3',
            '#6a737d': '#818e99',
            '#ea4a5a': '#ef5564',
            '#2188ff': '#268bf9'
          },
          ...colorReplacements
        }
      })

      // —— 包装为与 M1 相同的 DOM 结构 ——
      const showLines =
        (lineNumbers && !/:no-line-numbers\b/.test(meta)) ||
        (!lineNumbers && /:line-numbers\b/.test(meta))
      const active = /\bactive\b/.test(meta) ? ' active' : ''

      const label =
        (languageLabel?.[lang.toLowerCase()] ?? '')
          .toString()
          .trim() ||
        lang.replace(/_/g, ' ')

      const wrapper: any = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: [
            `language-${lang}${active}${showLines ? ' line-numbers-mode' : ''}`
          ]
        },
        children: [
          {
            type: 'element',
            tagName: 'button',
            properties: {
              title: tooltip,
              'data-copied': copied,
              className: ['copy']
            },
            children: []
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['lang'] },
            children: [{ type: 'text', value: label }]
          },
          highlighted
        ]
      }

      if (showLines) {
        const lineText = highlighted.children?.length
          ? countCodeLines(highlighted)
          : str.split('\n').length
        const startMatch = meta.match(/=(\d+)/)
        const start = startMatch ? parseInt(startMatch[1], 10) : 1
        const spans: any[] = []
        for (let i = 0; i < lineText; i++) {
          spans.push(
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['line-number'] },
              children: [{ type: 'text', value: String(i + start) }]
            },
            { type: 'element', tagName: 'br', properties: {}, children: [] }
          )
        }
        wrapper.children.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['line-numbers-wrapper'], ariaHidden: 'true' },
          children: spans
        })
      }

      return wrapper as Element
    },
    dispose() {
      highlighter.dispose()
    }
  }
}

/** shiki codeToHast 结果的行数(pre > code > 每行 span/div 计数) */
function countCodeLines(pre: any): number {
  const code = Array.isArray(pre.children)
    ? pre.children.find(
        (c: any) => c.type === 'element' && c.tagName === 'code'
      )
    : undefined
  if (!code || !Array.isArray(code.children)) return 1
  // shiki 默认把每行包成 span.line/div.line;退化时按文本行数兜底
  const lineish = code.children.filter(
    (c: any) => c.type === 'element' && /(^|\s)line(\s|$)/.test(cls(c))
  )
  if (lineish.length > 0) return lineish.length
  const text = code.children
    .map((c: any) => (c.type === 'text' ? c.value : ''))
    .join('')
  return text.split('\n').length
}

function cls(node: any): string {
  const p = node.properties?.className
  if (typeof p === 'string') return p
  if (Array.isArray(p)) return p.join(' ')
  return ''
}

/**
 * rehype 插件(attacher 形态,供 [plugin, options] 元组使用):
 * 把 compile.ts 生成的占位 pre[data-lang] 替换成高亮结构。
 * options.highlighter 缺省时保持占位 pre 原样(普通代码块)。
 */
export function rehypeCodeHighlight(options: {
  highlighter: CodeHighlighter | null
  runtime?: CodeHighlightRuntime
}) {
  const highlighter = options.highlighter
  const runtime = options.runtime ?? {}
  return async (tree: Root): Promise<void> => {
    if (!highlighter) return
    const walk = async (children: any[]): Promise<void> => {
      for (let i = 0; i < children.length; i++) {
        const node = children[i]
        if (!node || node.type !== 'element') continue
        if (node.tagName === 'pre' && node.properties?.['data-lang'] != null) {
          const lang = String(node.properties['data-lang'])
          const meta = String(node.properties['data-meta'] ?? '').trim()
          const code = Array.isArray(node.children)
            ? node.children.find(
                (c: any) => c.type === 'element' && c.tagName === 'code'
              )
            : undefined
          const text = code
            ? collectText(code.children)
            : ''
          try {
            const wrapper = await highlighter.codeToHast(
              text,
              lang,
              meta,
              runtime
            )
            if (wrapper) children[i] = wrapper
          } catch {
            // 保留占位 pre(普通文本代码块),不中断整页
          }
        } else if (Array.isArray(node.children)) {
          await walk(node.children)
        }
      }
    }
    await walk(tree.children)
  }
}

function collectText(children: any[]): string {
  let out = ''
  for (const c of children ?? []) {
    if (!c) continue
    if (c.type === 'text') out += c.value
    else if (c.type === 'element') out += collectText(c.children)
  }
  return out
}
