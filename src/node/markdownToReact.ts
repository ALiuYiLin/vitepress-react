import { hash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { resolveTitleFromToken } from '@mdit-vue/shared'
import { LRUCache } from 'lru-cache'
import { createDebug } from 'obug'

import type { SiteConfig } from './config'
import {
  createMarkdownRenderer,
  mergeMarkdownLocales,
  type MarkdownOptions,
  type MarkdownRenderer
} from './markdown/markdown'
import { getPageDataTransformer } from './plugins/dynamicRoutesPlugin'
import {
  EXTERNAL_URL_RE,
  getLocaleForPath,
  slash,
  treatAsHtml,
  type HeadConfig,
  type MarkdownEnv,
  type PageData
} from './shared'
import {
  extractComponentNames,
  serializeHtmlToJsx
} from './markdown/serializeHtmlToJsx'
import { getGitTimestamp } from './utils/getGitTimestamp'

const debug = createDebug('vitepress:md')
const cache = new LRUCache<string, MarkdownCompileResult>({
  maxSize: 64 * 1024 * 1024,
  sizeCalculation(value, key) {
    return Math.max(1, 2 * (key.length + value.reactSrc.length))
  }
})

let __pages: string[] = []
let __dynamicRoutes = new Map<string, [string, string]>()
let __rewrites = new Map<string, string>()
let __ts: number

export interface MarkdownCompileResult {
  /**
   * 生成的 React 页面模块源码(TSX 文本;由 plugin.ts 内的 oxc 以
   * automatic JSX runtime 编译成可执行 JS)。
   *
   * M1 管线(迁移 D1/D2,结构平移自蓝本 ActView markdownToActView.ts):
   *   maskScriptBlocks(占位) → markdown-it render(plugin-sfc 提取 script)
   *   → HTML→JSX 编译期序列化 → 模块组装(script 块顶层提升 + 组件引用)。
   * 正文 {{ }} / {expr} 一律字面文本;动态内容用 script 块导出的组件。
   */
  reactSrc: string
  pageData: PageData
  deadLinks: { url: string; file: string; line?: number }[]
  includes: string[]
}

export function clearCache(relativePath?: string) {
  if (!relativePath) {
    cache.clear()
    return
  }

  cache.find((_, key) => key.endsWith(`:${relativePath}`) && cache.delete(key))
}

function normalizeDriveLetter(file: string) {
  return file.replace(/^[a-z]:/i, (drive) => drive.toLowerCase())
}

function getResolutionCache(siteConfig: SiteConfig) {
  // @ts-expect-error internal
  if (siteConfig.__dirty) {
    __pages = siteConfig.pages.map((p) => slash(p.replace(/\.md$/, '')))

    __dynamicRoutes = new Map(
      siteConfig.dynamicRoutes.map((r) => [
        r.fullPath,
        [slash(path.join(siteConfig.srcDir, r.route)), r.loaderPath]
      ])
    )

    __rewrites = new Map(
      Object.entries(siteConfig.rewrites.map).map(([key, value]) => [
        normalizeDriveLetter(slash(path.join(siteConfig.srcDir, key))),
        normalizeDriveLetter(slash(path.join(siteConfig.srcDir, value!)))
      ])
    )

    __ts = Date.now()

    // @ts-expect-error internal
    siteConfig.__dirty = false
  }

  return {
    pages: __pages,
    dynamicRoutes: __dynamicRoutes,
    rewrites: __rewrites,
    ts: __ts
  }
}

export async function createMarkdownToReactRenderFn(
  srcDir: string,
  options: MarkdownOptions,
  base: string,
  includeLastUpdatedData: boolean,
  cleanUrls: boolean,
  siteConfig: SiteConfig
) {
  const md = await createMarkdownRenderer(
    srcDir,
    mergeMarkdownLocales(options, siteConfig?.site.locales),
    base,
    siteConfig?.logger,
    siteConfig?.publicDir
  )

  return async (src: string, file: string): Promise<MarkdownCompileResult> => {
    const { pages, dynamicRoutes, rewrites, ts } =
      getResolutionCache(siteConfig)

    const dynamicRoute = dynamicRoutes.get(file)
    const fileOrig = dynamicRoute?.[0] || file
    const transformPageData = [
      siteConfig?.transformPageData,
      getPageDataTransformer(dynamicRoute?.[1])
    ].filter((fn) => fn != null)

    file = rewrites.get(normalizeDriveLetter(file)) || file
    const relativePath = slash(path.relative(srcDir, file))

    const srcHash = hash('sha256', src, 'base64url')
    const cacheKey = `${srcHash}:${ts}:${relativePath}`
    if (options.cache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        debug(`[cache hit] ${relativePath}`)
        return cached
      }
    }

    const start = Date.now()

    // resolve params for dynamic routes
    let params
    src = src.replace(
      /^__VP_PARAMS_START([^]+?)__VP_PARAMS_END__/,
      (_, paramsString) => {
        params = JSON.parse(paramsString)
        return ''
      }
    )

    // ★阶段1(M1):<script> 块(fence 感知)替换为占位——markdown-it 的
    // html_block type 7 会被块内任意 `</(script|pre|style|textarea)>` 提前
    // 截断;占位后由 @mdit-vue/plugin-sfc 提取,渲染结束再还原原始内容。
    // <script client>(MPA 专属)不 mask,让它按正文元素处理。
    const maskedScripts: { key: string; inner: string }[] = []
    src = maskScriptBlocks(src, maskedScripts)

    // ★阶段1.5(D2):正文 {expr} 占位——白名单来自 script 顶层绑定;
    // 命中才作为表达式;未命中但非 attrs 语法的花括号保护为字面文本
    const exprStore: { expr?: string; literal?: string }[] = []
    const exprAllowed = new Set<string>()
    for (const block of maskedScripts) {
      collectTopLevelNames(block.inner, exprAllowed)
    }
    src = maskJsxExpressions(src, exprAllowed, exprStore)

    const localeIndex = getLocaleForPath(siteConfig?.site, relativePath)

    // reset env before render; the include plugin fills `includes` and
    // exposes the include-expanded source as `env.src`
    const env: MarkdownEnv = {
      path: file,
      relativePath,
      cleanUrls,
      relativizeUrls: true,
      includes: [],
      realPath: fileOrig,
      localeIndex
    }
    let html: string
    try {
      html = await md.renderAsync(src, env)
    } catch (e) {
      // surface the dependencies collected so far, so that the caller can
      // watch them and a missing snippet or include recovers once created
      ;(e as { includes?: string[] }).includes = env.includes
      throw e
    }
    const {
      content,
      frontmatter = {},
      headers = [],
      includes = [],
      linkLines = [],
      links = [],
      sfcBlocks,
      title = ''
    } = env
    restoreHeaderExpressions(headers as any[], exprStore)
    src = env.src ?? src
    const contentLineOffset = countLineBreaks(
      content && src.endsWith(content) ? src.slice(0, -content.length) : ''
    )

    // validate data.links
    const deadLinks: MarkdownCompileResult['deadLinks'] = []
    const recordDeadLink = (url: string, line?: number) => {
      deadLinks.push(
        line == null ? { url, file: fileOrig } : { url, file: fileOrig, line }
      )
    }

    function shouldIgnoreDeadLink(url: string) {
      if (!siteConfig?.ignoreDeadLinks) {
        return false
      }
      if (siteConfig.ignoreDeadLinks === true) {
        return true
      }
      if (siteConfig.ignoreDeadLinks === 'localhostLinks') {
        return url.replace(EXTERNAL_URL_RE, '').startsWith('//localhost')
      }

      return siteConfig.ignoreDeadLinks.some((ignore) => {
        if (typeof ignore === 'string') return url === ignore
        if (ignore instanceof RegExp) return ignore.test(url)
        if (typeof ignore === 'function') return ignore(url, fileOrig)
        return false
      })
    }

    if (links && siteConfig?.ignoreDeadLinks !== true) {
      const dir = path.dirname(file)
      for (const [index, rawUrl] of links.entries()) {
        let url = rawUrl
        const line =
          linkLines[index] == null
            ? undefined
            : linkLines[index] + contentLineOffset
        const { pathname } = new URL(url, 'http://a.com')
        if (!treatAsHtml(pathname)) continue

        url = url.replace(/[?#].*$/, '').replace(/\.(html|md)$/, '')
        if (url.endsWith('/')) url += `index`

        let resolved = decodeURIComponent(
          slash(
            url.startsWith('/')
              ? url.slice(1)
              : path.relative(srcDir, path.resolve(dir, url))
          )
        )
        const rewriteSource = siteConfig?.rewrites.inv[resolved + '.md']
        if (rewriteSource) resolved = rewriteSource.slice(0, -3)

        // a link to the pre-rewrite path of a rewritten page 404s in the
        // built site even though the page itself exists
        const rewritten = rewriteSource
          ? undefined
          : siteConfig?.rewrites.map[resolved + '.md']

        if (
          (!pages.includes(resolved) ||
            (rewritten != null && rewritten !== resolved + '.md')) &&
          !(
            siteConfig?.publicDir &&
            fs.existsSync(path.join(siteConfig.publicDir, `${resolved}.html`))
          ) &&
          !shouldIgnoreDeadLink(url)
        ) {
          recordDeadLink(url, line)
        }
      }
    }

    let pageData: PageData = {
      title: inferTitle(md, frontmatter, title),
      titleTemplate: frontmatter.titleTemplate as any,
      description: inferDescription(frontmatter),
      frontmatter,
      headers,
      params,
      relativePath,
      filePath: slash(path.relative(srcDir, fileOrig))
    }

    if (includeLastUpdatedData && frontmatter.lastUpdated !== false) {
      if (frontmatter.lastUpdated instanceof Date) {
        pageData.lastUpdated = +frontmatter.lastUpdated
      } else {
        pageData.lastUpdated = await getGitTimestamp(fileOrig)
      }
    }

    for (const fn of transformPageData) {
      if (fn) {
        const dataToMerge = await fn(pageData, { siteConfig })
        if (dataToMerge) pageData = { ...pageData, ...dataToMerge }
      }
    }

    // ★阶段4/5(M1):还原占位 script → 组装 React 页面模块
    // (script 块提升模块顶层 + 正文 HTML→JSX 序列化 + __pageData)
    restoreMaskedScripts(
      [
        ...(sfcBlocks?.scripts ?? []),
        ...(sfcBlocks?.scriptSetup ? [sfcBlocks.scriptSetup] : [])
      ],
      maskedScripts
    )
    const reactSrc = createReactPageSrc(html, sfcBlocks, pageData, exprStore)

    debug(`[render] ${file} in ${Date.now() - start}ms.`)

    const result = { reactSrc, pageData, deadLinks, includes }
    if (options.cache !== false) cache.set(cacheKey, result)
    return result
  }
}

const inferTitle = (
  md: MarkdownRenderer,
  frontmatter: Record<string, any>,
  title: string
) => {
  if (typeof frontmatter.title === 'string') {
    const titleToken = md.parseInline(frontmatter.title, {})[0]
    if (titleToken) {
      return resolveTitleFromToken(titleToken, {
        shouldAllowHtml: false,
        shouldEscapeText: false
      })
    }
  }
  return title
}

const inferDescription = (frontmatter: Record<string, any>) => {
  const { description, head } = frontmatter

  if (description !== undefined) {
    return description
  }

  return (head && getHeadMetaContent(head, 'description')) || ''
}

function countLineBreaks(str: string) {
  return str.match(/\r?\n/g)?.length ?? 0
}

const getHeadMetaContent = (head: HeadConfig[], name: string) => {
  if (!head || !head.length) {
    return undefined
  }

  const meta = head.find(([tag, attrs = {}]) => {
    return tag === 'meta' && attrs.name === name && attrs.content
  })

  return meta && meta[1].content
}

// ============================================================
// M1 md 管线:maskScriptBlocks → markdown-it render(plugin-sfc 提取)
// → HTML→JSX 序列化 → React 页面模块组装
// ============================================================

/**
 * fence 感知地把正文里的 <script> 块替换为占位(每块恒 3 行),规避
 * markdown-it html_block type 7 被块内任意 `</(script|pre|style|textarea)>`
 * 提前截断(组件 JSX 常含 `</pre>` 等)。<script client>(MPA 专属)不 mask,
 * 让它留在正文里按元素序列化。
 */
function maskScriptBlocks(
  src: string,
  blocks: { key: string; inner: string }[]
): string {
  const lines = src.split('\n')
  const out: string[] = []
  let fenceChar: string | null = null
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // fenced code block 检测(CommonMark:最多 3 空格缩进 + ≥3 个 ` 或 ~)
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const ch = fence[1][0]
      if (fenceChar === null) {
        fenceChar = ch
      } else if (ch === fenceChar && /^\s{0,3}[`~]{3,}\s*$/.test(line)) {
        fenceChar = null
      }
      out.push(line)
      i++
      continue
    }
    if (fenceChar === null) {
      // fence 之外:行首 <script …>(排除 client)开始收块
      const open = /^<script\b(?![^>]*\bclient\b)[^>]*>/.exec(line)
      if (open) {
        const block: string[] = [line]
        let j = i + 1
        let closed = false
        while (j < lines.length) {
          block.push(lines[j])
          if (/<\/script>\s*$/.test(lines[j])) {
            closed = true
            break
          }
          j++
        }
        if (closed) {
          const key = `__VP_SCRIPT_BLOCK_${blocks.length}__`
          // inner = 首行 <script …> 与末行 </script> 之间的代码
          blocks.push({ key, inner: block.slice(1, -1).join('\n') })
          out.push('<script setup>', key, '</script>')
          i = j + 1
          continue
        }
        // 未闭合:原样输出,交给 markdown-it 处理
        out.push(...block)
        i = j + 1
        continue
      }
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

/** 渲染后把占位 script 的 contentStripped 还原为原始标签内代码 */
function restoreMaskedScripts(
  sfcScripts: { contentStripped: string }[],
  masked: { key: string; inner: string }[]
): void {
  if (!masked.length) return
  for (const block of sfcScripts) {
    const stripped = block.contentStripped.trim()
    if (!/^__VP_SCRIPT_BLOCK_\d+__$/.test(stripped)) continue
    const real = masked.find((m) => m.key === stripped)
    if (real) block.contentStripped = real.inner
  }
}

// ============================================================
// JSX 表达式内联:正文 `{expr}` 若引用 script 绑定(模块顶层或 Page 作用域),
// 渲染前替换为 @@VP_EXPR_n@@ 占位(不进入 markdown-it),序列化阶段还原成
// 真实 JSX 表达式,与 Page 组件共享作用域(可配合 hooks 响应式更新)。
// ============================================================

/** 收集 script 顶层绑定名(import/export/声明/解构),作为 {expr} 白名单 */
function collectTopLevelNames(code: string, out: Set<string>): void {
  const add = (n: string) => {
    if (n && !/^(?:default|import|export|type)$/.test(n)) out.add(n)
  }
  const idRe = /[A-Za-z_$][\w$]*/g
  const collectIdents = (raw: string) => {
    let m: RegExpExecArray | null
    while ((m = idRe.exec(raw))) add(m[0])
  }
  for (const rawLine of code.split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '').trim()
    if (!line) continue

    const imp = /^import\s+(?:type\s+)?/.exec(line)
    if (imp) {
      const rest = line.replace(/^import\s+(?:type\s+)?/, '')
      if (rest.startsWith('"') || rest.startsWith("'")) continue // 纯副作用导入
      const ns = /^\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(rest)
      if (ns) {
        add(ns[1])
        continue
      }
      const openB = rest.indexOf('{')
      if (openB >= 0) {
        const closeB = rest.indexOf('}')
        const inner = closeB > openB ? rest.slice(openB + 1, closeB) : ''
        for (const seg of inner.split(',')) {
          const s = seg.trim()
          const asM = s.match(/([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/)
          add(asM ? asM[2] : s.split(/\s+/)[0] ?? '')
        }
        // 默认导入(def from 'x')
        const before = rest.slice(0, openB).trim()
        const def = before.split(',').map((s) => s.trim())[0] ?? ''
        if (/^[A-Za-z_$][\w$]*$/.test(def)) add(def)
      } else {
        const head = rest.split(/\s+/)[0] ?? ''
        if (/^[A-Za-z_$][\w$]*$/.test(head) && head !== 'from') add(head)
      }
      continue
    }

    if (/^(?:export\s+)?(?:function|class)\b/.test(line)) {
      const m = line.match(/(?:function|class)\s+([A-Za-z_$][\w$]*)/)
      if (m) add(m[1])
      continue
    }
    if (/^export\s*\{/.test(line)) {
      const inner = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}') || undefined)
      for (const seg of inner.split(',')) {
        const s = seg.trim()
        const asM = s.match(/([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/)
        add(asM ? asM[2] : s.split(/\s+/)[0] ?? '')
      }
      continue
    }
    const decl = /^(?:export\s+)?(?:const|let|var)\s+(.+?)(?:\s*[=;]|$)/.exec(
      line
    )
    if (decl) {
      collectIdents(decl[1] ?? '')
    }
  }
}

/** 词法级括号配对:找 src 里 openIndex('{') 的匹配 '}'(跳过引号/模板串/注释) */
function findMatchingBrace(src: string, openIndex: number): number {
  let depth = 0
  let i = openIndex
  while (i < src.length) {
    const ch = src[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch
      i++
      while (i < src.length) {
        if (src[i] === '\\') i += 2
        else if (src[i] === q) break
        else i++
      }
      i++
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/** 顶层(不嵌套)是否存在逗号/分号 —— 用于排除 `{1, 2}` 这类序列写法 */
function hasTopLevelCommaOrSemi(expr: string): boolean {
  let depth = 0
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (depth === 0 && (ch === ',' || ch === ';')) return true
    i++
  }
  return false
}

const JS_KEYWORDS = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  'this',
  'new',
  'typeof',
  'void',
  'delete'
])

/**
 * 判定花括号内容可安全当作 JSX 表达式:
 * - 不含中文;
 * - 引用的标识符要么在白名单(script 绑定),要么是 JS 关键字/全局字面量;
 * - 无顶层逗号/分号序列(避免 `{1, 2}` 这类正文列表被误求值)。
 */
function isSafeJsExpr(inner: string, allowed: ReadonlySet<string>): boolean {
  if (/[\u4e00-\u9fff]/.test(inner)) return false
  if (hasTopLevelCommaOrSemi(inner)) return false
  const idRe = /[A-Za-z_$][\w$]*/g
  let m: RegExpExecArray | null
  while ((m = idRe.exec(inner))) {
    if (!allowed.has(m[0]) && !JS_KEYWORDS.has(m[0])) return false
  }
  return true
}

/**
 * fence/行内码/围栏感知地"保护"正文里的 {…}:
 * - `{#id}` / `{.class}` 这类 attrs 语法原样留给 @mdit/plugin-attrs;
 * - 表达式候选(引用 script 绑定,或纯数值/字面量如 `{1+1}`)→ @@VP_EXPR_n@@;
 * - 其余(中文/未绑定标识符/序列)→ @@VP_TXT_n@@ 还原为字面花括号文本。
 */
function maskJsxExpressions(
  src: string,
  allowed: ReadonlySet<string>,
  store: { expr?: string; literal?: string }[]
): string {
  let out = ''
  let i = 0
  let fence = false
  let fenceChar = ''
  let inBacktick = false
  let inFrontmatter = src.startsWith('---')

  while (i < src.length) {
    const c = src[i]
    const rest = src.slice(i)

    // 行首的代码片段导入指令(<<< @/path{lines} …):整行原样保留,
    // 其 {…} 是 snippet 插件选项,不能进入表达式/字面掩码
    if ((i === 0 || src[i - 1] === '\n') && /^[ \t]*<<<[ \t]+/.test(rest)) {
      const eol = rest.indexOf('\n')
      const seg = eol === -1 ? rest : rest.slice(0, eol + 1)
      out += seg
      i += seg.length
      continue
    }

    if (inFrontmatter) {
      const nl = rest.indexOf('\n')
      const seg = nl === -1 ? rest : rest.slice(0, nl + 1)
      out += seg
      i += seg.length
      if (nl !== -1 && rest.slice(0, nl).trim() === '---') inFrontmatter = false
      continue
    }

    // 代码围栏:整行 `` ` ```` `` 或 ~~~
    if (c === '`' || c === '~') {
      const m = /^(\s{0,3})(`{3,}|~{3,})/.exec(rest)
      if (m && !fence) {
        const eol = rest.indexOf('\n')
        const line = eol === -1 ? rest : rest.slice(0, eol + 1)
        out += line
        i += line.length
        fence = true
        fenceChar = m[2][0]
        continue
      }
      if (fence && fenceChar === c) {
        // 只检查当前行(不是整段余文),等长/超长的同字符围栏即可闭合
        const eol = rest.indexOf('\n')
        const lineText = eol === -1 ? rest : rest.slice(0, eol)
        const closeRe = new RegExp(
          `^\\s{0,3}${fenceChar === '`' ? '`{3,}' : '~{3,}'}\\s*$`
        )
        if (closeRe.test(lineText)) {
          const line = eol === -1 ? rest : rest.slice(0, eol + 1)
          out += line
          i += line.length
          fence = false
          continue
        }
      }
    }
    if (fence) {
      out += c
      i++
      continue
    }

    if (c === '`') {
      inBacktick = !inBacktick
      out += c
      i++
      continue
    }
    if (inBacktick) {
      out += c
      i++
      continue
    }

    if (c === '{') {
      const end = findMatchingBrace(src, i)
      if (end > i) {
        const raw = src.slice(i + 1, end)
        const inner = raw.trim()
        // attrs 语法(#id/.class)留给 @mdit/plugin-attrs
        if (inner && !/^[#.]/.test(inner)) {
          if (isSafeJsExpr(inner, allowed)) {
            const token = `@@VP_EXPR_${store.length}@@`
            store.push({ expr: inner })
            out += token
            i = end + 1
            continue
          }
          // 不安全 → 保护为字面花括号文本(避免 attrs/其它处理吞掉)
          const token = `@@VP_TXT_${store.length}@@`
          store.push({ literal: `{${raw}}` })
          out += token
          i = end + 1
          continue
        }
      }
    }
    out += c
    i++
  }
  return out
}

/** 还原 env.headers 标题里的占位:表达式→`{code}`、字面→原花括号文本 */
function restoreHeaderExpressions(
  headers: any[],
  store: { expr?: string; literal?: string }[]
): void {
  const fix = (s: any): any =>
    typeof s === 'string'
      ? s.replace(
          /@@VP_(EXPR|TXT)_(\d+)@@/g,
          (_, kind, n) =>
            kind === 'EXPR'
              ? `{${store[Number(n)]?.expr ?? ''}}`
              : (store[Number(n)]?.literal ?? '')
        )
      : s
  const walk = (h: any) => {
    if (!h || typeof h !== 'object') return
    if (typeof h.title === 'string') h.title = fix(h.title)
    if (Array.isArray(h.children)) h.children.forEach(walk)
  }
  headers.forEach(walk)
}

/** __pageData 顶层导出(契约与上游一致:主题 useData() 读取) */
function injectPageDataCode(data: PageData): string {
  return `export const __pageData = JSON.parse(${JSON.stringify(
    JSON.stringify(data)
  )})`
}

/**
 * 合并多个 script 块时去重 import 语句:多个块可能各自写同一句 import,
 * 提升到模块顶层后会重复声明。逐行处理(单行 import 语义),同句只留首条。
 */
function dedupeImports(blocks: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (/^\s*import\s/.test(line)) {
        const key = line.replace(/\s+/g, ' ').trim()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(line)
      } else {
        out.push(line)
      }
    }
  }
  return out.join('\n')
}

/** 注释掉用户 script 里的 `export default`(页面 default 组件由本模块生成) */
function stripExportDefault(code: string): string {
  const lines = code.split('\n')
  const out: string[] = []
  let i = 0
  const countBrackets = (s: string) =>
    [...s].reduce((acc, c) => acc + (c === '{' ? 1 : c === '}' ? -1 : 0), 0)

  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*export\s+default\b/.test(line)) {
      let depth = countBrackets(line)
      if (depth <= 0 && !/;\s*$/.test(line) && !/\}\s*$/.test(line)) {
        // 简单值形式(export default foo)
        out.push('// removed: user export-default (页面组件由本模块生成)')
        i++
        continue
      }
      // 跨行对象/表达式:收集到花括号平衡
      let buf = line
      i++
      while (i < lines.length && depth > 0) {
        buf += '\n' + lines[i]
        depth += countBrackets(lines[i])
        i++
      }
      const commented = buf
        .split('\n')
        .map((l) => (l ? `// ${l}` : '//'))
        .join('\n')
      out.push('// removed: user export-default (页面组件由本模块生成)')
      out.push(commented)
      continue
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

/** <script client>(MPA client JS):内容以注释保留,避免静默丢弃 */
const scriptClientRE = /<script\b[^>]*client\b[^>]*>/i

/**
 * 把 script 顶层代码按行分拣:
 * - import 语句 → 模块顶层(imports)
 * - export * 语句(含跨行的 function/const)→ 模块顶层(restModule)
 * - 其余语句/声明 → Page() 组件体内(pageCode,可合法使用 hooks)
 * 用花括号深度判断跨行语句边界;单行无括号的语句各自成行。
 */
function splitTopLevel(code: string): {
  imports: string[]
  restModule: string[]
  body: string[]
} {
  const lines = code.split('\n')
  const imports: string[] = []
  const restModule: string[] = []
  const body: string[] = []
  let bucket: 'import' | 'module' | 'body' | null = null
  let depth = 0
  const braces = (s: string) => {
    let d = 0
    for (const c of s) {
      if (c === '{') d++
      else if (c === '}') d--
    }
    return d
  }
  for (const line of lines) {
    if (bucket === null) {
      const t = line.trim()
      if (!t) {
        body.push(line)
        continue
      }
      if (/^import\s/.test(t)) bucket = 'import'
      else if (/^export\b/.test(t)) bucket = 'module'
      else bucket = 'body'
    }
    const target =
      bucket === 'import' ? imports : bucket === 'module' ? restModule : body
    target.push(line)
    depth += braces(line)
    if (depth <= 0) bucket = null
  }
  return { imports, restModule, body }
}

/**
 * 组装 React 页面模块(TSX 文本;由 plugin.ts 内 oxc automatic JSX 编译):
 *
 *   // generated by vitepress-react
 *   // ---- <script> imports / named exports (module top; shared scope) ----
 *   <import 语句(去重)>
 *   <export function/const … 等具名导出,模块顶层>
 *   export const __pageData = JSON.parse(…)
 *   [<style> 块:客户端运行时注入 style 标签(SSR 不注入)]
 *   export default function Page() {
 *     // ---- <script> page scope (component body) ----
 *     <script 里其余语句:可含 useState 等 hooks,与正文 {expr} 共享作用域>
 *     return ( <div className="vp-doc">…JSX…</div> )
 *   }
 *
 * 正文动态能力契约(D2):正文 `{expr}` 若引用 script 绑定,由序列化器还原成
 * 真实表达式(与 Page 同一作用域,可响应 hooks 更新);未命中的花括号仍为
 * 字面文本。需要完整交互时仍用 <script> 定义的组件标签。
 */
function createReactPageSrc(
  html: string,
  sfcBlocks: MarkdownEnv['sfcBlocks'],
  pageData: PageData,
  expressions: { expr?: string; literal?: string }[]
): string {
  const parts: string[] = []
  parts.push(`// generated by vitepress-react (md → React page module)`)

  const scripts = sfcBlocks?.scripts?.length
    ? sfcBlocks.scripts
    : sfcBlocks?.scriptSetup
      ? [sfcBlocks.scriptSetup]
      : []
  const styles = sfcBlocks?.styles ?? []

  const moduleImports: string[] = []
  const moduleRest: string[] = []
  const pageCode: string[] = []
  for (const block of scripts) {
    if (scriptClientRE.test(block.tagOpen)) {
      parts.push(`// <script client> (MPA client JS)`)
      parts.push(
        block.contentStripped
          .split('\n')
          .map((l) => `//   ${l}`)
          .join('\n')
      )
      continue
    }
    const { imports, restModule, body } = splitTopLevel(
      stripExportDefault(block.contentStripped)
    )
    moduleImports.push(...imports)
    moduleRest.push(...restModule)
    pageCode.push(...body)
  }

  // 组件引用解析名:imports/具名导出(模块顶层)+ Page 作用域局部声明
  const componentNames = new Set<string>()
  for (const n of extractComponentNames(
    [...moduleImports, ...moduleRest, ...pageCode].join('\n')
  )) {
    componentNames.add(n)
  }

  if (moduleImports.length || moduleRest.length) {
    parts.push(
      `// ---- <script> imports / named exports (module top; shared scope) ----`
    )
    if (moduleImports.length) {
      parts.push(dedupeImports([moduleImports.join('\n')]))
    }
    if (moduleRest.length) parts.push(moduleRest.join('\n'))
  }
  parts.push(injectPageDataCode(pageData))

  // <style> → 运行时注入 style 标签(全局样式;SSR 阶段不注入)
  if (styles.length) {
    const css = styles.map((s) => s.contentStripped).join('\n')
    parts.push(`const __vpStyles__ = ${JSON.stringify(css)}`)
    parts.push(
      `if (typeof document !== 'undefined') { const __el__ = document.createElement('style'); __el__.textContent = __vpStyles__; document.head.appendChild(__el__) }`
    )
  }
  if (sfcBlocks?.customBlocks?.length) {
    parts.push(
      `// NOTE: ${sfcBlocks.customBlocks.length} 个 custom block 未输出(React 暂无对应机制)`
    )
  }

  // 正文 → JSX(组件标签解析为标识符引用;@@VP_EXPR/TXT_n@@ 还原)
  const exprMap: Record<string, { expr?: string; literal?: string }> = {}
  expressions.forEach((e, i) => {
    if (e.expr != null) exprMap[`${i}`] = { expr: e.expr }
    else if (e.literal != null) exprMap[`${i}`] = { literal: e.literal }
  })
  const body = serializeHtmlToJsx(html, componentNames, exprMap)
  if (body.warnings.length) {
    parts.push(`// NOTE (markdownToReact):`)
    for (const w of body.warnings) parts.push(`//   - ${w}`)
  }

  parts.push(`export default function Page() {`)
  if (pageCode.length) {
    parts.push(`  // ---- <script> page scope (component body) ----`)
    for (const l of pageCode) parts.push(`  ${l}`)
  }
  parts.push(`  return (`)
  parts.push(`    ${body.code.split('\n').join('\n    ')}`)
  parts.push(`  )`)
  parts.push(`}`)

  // dev 下自接受热更新:阻止 vite 因页面模块无 importer 而整页刷新;
  // 内容替换由客户端 vitepress:pageData 事件驱动(重新 import 新模块)
  parts.push(`if (import.meta.hot) { import.meta.hot.accept() }`)

  return parts.join('\n')
}
