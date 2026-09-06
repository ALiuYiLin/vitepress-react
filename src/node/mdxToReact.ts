// M2 预览管线(mdx 分支,P2):把 .md 经 @10coding/mdx-kernel compileDocument
// 编译为 React 页面模块,与 M1(md-it + HTML→JSX 序列化)并存,由
// markdown.mdx 开关(或 VP_MDX_RENDER 环境变量)选择。产出契约与 M1 一致:
//   export default Page + export const __pageData(页面模块由 plugin.ts 的
//   oxc 编译成 JS;MDX 产物本身是纯 JS,oxc 只是透传)。
//
// 与 M1 的差异与留白(backlog):
//   - deadLinks 恒空:mdx-kernel 尚未采集正文链接(dead-link 检查 P4 补);
//   - 主题 markdown 组件(Badge 等)映射:留 P3 diff 补齐;
//   - frontmatter.title 未做 md 语法剥离(纯文本页面不受影响);
//   - include/snippet 已由内核展开并返回 dependencies(plugin 负责 watch)。
// 代码块:mdx-kernel 高亮(createCodeHighlighter)与 M1 同构输出
// div.language-* 结构(copy 按钮交互复用客户端 codeCopy 逻辑),并沿用
// markdown 配置的 theme/languages/colorReplacements/codeCopyButton 等。

import { hash } from 'node:crypto'
import path from 'node:path'

import { compileDocument, createCodeHighlighter } from '@10coding/mdx-kernel'
import type { CodeHighlighter } from '@10coding/mdx-kernel'
import { LRUCache } from 'lru-cache'
import { createDebug } from 'obug'

import type { SiteConfig } from './config'
import type { MarkdownOptions } from './markdown/markdown'
import type { MarkdownCompileResult } from './markdownToReact'
import { slash, type HeadConfig, type Header, type PageData } from './shared'
import { getPageDataTransformer } from './plugins/dynamicRoutesPlugin'
import { getGitTimestamp } from './utils/getGitTimestamp'

const debug = createDebug('vitepress:mdx')
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

function normalizeDriveLetter(file: string) {
  return file.replace(/^[a-z]:/i, (drive) => drive.toLowerCase())
}

function getResolutionCache(siteConfig: SiteConfig) {
  // @ts-expect-error internal
  if (siteConfig.__dirty) {
    __pages = siteConfig.pages.map((p) => slash(p.replace(/\.(?:md|mdx)$/, '')))

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

/**
 * 把 compileDocument 产物(ESM:function MDXContent + export default …)
 * 组装为 vitepress-react 页面模块:
 *   1. 原 default(MDXContent)改名内部函数;
 *   2. 追加 export const __pageData(与 M1 相同的契约);
 *   3. default Page 用 _vpJsx 包一层 div.vp-doc 后渲染 MDXContent。
 * MDX 产物本身 import react/jsx-runtime;包装用独立别名,不与其冲突。
 * 供单测直接调用。
 */
export function assembleMdxPage(code: string, pageData: PageData): string {
  const body = code.includes('export default function MDXContent')
    ? code.replace('export default function MDXContent', 'function MDXContent')
    : code

  const pageDataJson = JSON.stringify(JSON.stringify(pageData))
  return `${body}

// ---- vitepress-react mdx page wrapper (P2) ----
import { jsx as _vpJsx } from 'react/jsx-runtime'
export const __pageData = JSON.parse(${pageDataJson})
export default function Page(props = {}) {
  return _vpJsx('div', {
    className: 'vp-doc',
    children: _vpJsx(MDXContent, props)
  })
}
if (import.meta.hot) { import.meta.hot.accept() }
`
}

const inferDescription = (frontmatter: Record<string, any>) => {
  const { description, head } = frontmatter
  if (description !== undefined) {
    return description
  }
  return (head && getHeadMetaContent(head, 'description')) || ''
}

/** mdx-kernel 的 headers(level/title/slug/children)补上 Header 契约的 link */
function headersWithLink(headers: any[]): Header[] {
  return headers.map((h) => ({
    level: h.level,
    title: h.title,
    slug: h.slug,
    link: `#${h.slug}`,
    children: headersWithLink(h.children ?? [])
  }))
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

/** 按 markdown options 创建 mdx 代码高亮器(preWrapper: false 时禁用) */
async function createMdxHighlighter(
  options: MarkdownOptions
): Promise<CodeHighlighter | null> {
  if (options.preWrapper === false) return null
  try {
    return await createCodeHighlighter({
      theme: options.theme,
      languages: options.languages,
      languageAlias: options.languageAlias,
      defaultHighlightLang: options.defaultHighlightLang,
      codeTransformers: options.codeTransformers,
      colorReplacements: options.colorReplacements,
      shikiSetup: options.shikiSetup
    })
  } catch (e) {
    console.warn('[vitepress] failed to init mdx code highlighter:', e)
    return null
  }
}

export async function createMdxToReactRenderFn(
  srcDir: string,
  options: MarkdownOptions,
  _base: string,
  includeLastUpdatedData: boolean,
  _cleanUrls: boolean,
  siteConfig: SiteConfig
) {
  // 代码高亮:shiki 实例与渲染函数同生命周期(configResolved 时创建一次)
  const highlighter = await createMdxHighlighter(options)
  return async (src: string, file: string): Promise<MarkdownCompileResult> => {
    const { ts } = getResolutionCache(siteConfig)

    const srcHash = hash('sha256', src, 'base64url')
    const relativePath = slash(path.relative(srcDir, file))
    const cacheKey = `${srcHash}:${ts}:${relativePath}`
    if (options.cache !== false) {
      const cached = cache.get(cacheKey)
      if (cached) {
        debug(`[cache hit] ${relativePath}`)
        return cached
      }
    }

    const start = Date.now()
    const { rewrites, dynamicRoutes } = getResolutionCache(siteConfig)
    const dynamicRoute = dynamicRoutes.get(file)
    const fileOrig = dynamicRoute?.[0] || file
    const transformPageData = [
      siteConfig?.transformPageData,
      getPageDataTransformer(dynamicRoute?.[1])
    ].filter((fn) => fn != null)

    file = rewrites.get(normalizeDriveLetter(file)) || file

    // resolve params for dynamic routes
    let params
    src = src.replace(
      /^__VP_PARAMS_START([^]+?)__VP_PARAMS_END__/,
      (_, paramsString) => {
        params = JSON.parse(paramsString)
        return ''
      }
    )

    let result: MarkdownCompileResult
    try {
      const compiled = await compileDocument(src, {
        srcDir,
        filePath: file,
        highlight: highlighter
          ? {
              highlighter,
              runtime: {
                codeCopyButton: options.codeCopyButton,
                languageLabel: options.languageLabel,
                lineNumbers: options.lineNumbers
              }
            }
          : null
      })
      const data = compiled.data
      const frontmatter = data.frontmatter ?? {}

      let pageData: PageData = {
        title: data.title,
        titleTemplate: frontmatter.titleTemplate as any,
        description: inferDescription(frontmatter),
        frontmatter,
        headers: headersWithLink(data.headers),
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

      result = {
        reactSrc: assembleMdxPage(compiled.code, pageData),
        pageData,
        // 正文链接采集尚未接入 mdx-kernel(backlog P4)
        deadLinks: [],
        includes: compiled.dependencies
      }
    } catch (e) {
      // surface collected include/snippet dependencies for the watcher
      if (e instanceof Error && !(e as { includes?: string[] }).includes) {
        ;(e as { includes?: string[] }).includes = []
      }
      throw e
    }

    debug(`[render] ${file} in ${Date.now() - start}ms.`)

    if (options.cache !== false) cache.set(cacheKey, result)
    return result
  }
}
