// md → React 页面模块管线(M1)的编排层。
//
// 职责:单次编译的流程控制 —— 取站点分辨率快照与编译缓存 → 参数剥离 →
// 依次调用 markdown/jsxMasking 的掩码 Pass → markdown-it renderAsync →
// 渲染后处理(header 还原 / 死链校验 / pageData 组装 / script 还原)→
// markdown/buildReactPageModule 的模块组装 → 写缓存并返回。
//
// 各阶段的实现已拆分到(本目录均相对于 src/node):
//   markdown/jsxMasking.ts      掩码 Pass 与还原(script/JSX 行/{expr})
//   markdown/jsxLexer.ts        词法工具(fence/引号/括号/标签配平)
//   markdown/placeholders.ts    占位符写入/读取契约
//   markdown/serializeHtmlToJsx.ts HTML → JSX 编译期序列化
//   markdown/buildReactPageModule.ts 页面模块(TSX)组装
//   markdown/deadLinks.ts       死链校验
//   markdown/pageMeta.ts        title/description 推导
//   markdown/compileCache.ts    LRU + pages/dynamicRoutes/rewrites 快照

import { hash } from 'node:crypto'
import path from 'node:path'

import { createDebug } from 'obug'

import type { SiteConfig } from './config'
import {
  createMarkdownRenderer,
  mergeMarkdownLocales,
  type MarkdownOptions
} from './markdown/markdown'
import {
  maskJsxExpressions,
  maskJsxHtmlLines,
  maskScriptBlocks,
  restoreHeaderExpressions,
  restoreMaskedScripts,
  type MaskedScriptBlock
} from './markdown/jsxMasking'
import {
  computeContentLineOffset,
  collectDeadLinks
} from './markdown/deadLinks'
import { inferDescription, inferTitle } from './markdown/pageMeta'
import { createReactPageSrc } from './markdown/buildReactPageModule'
import {
  getCachedCompileResult,
  getResolutionCache,
  setCachedCompileResult
} from './markdown/compileCache'
import type { PlaceholderStore } from './markdown/placeholders'
import { getPageDataTransformer } from './plugins/dynamicRoutesPlugin'
import {
  getLocaleForPath,
  slash,
  type MarkdownEnv,
  type PageData
} from './shared'
import { getGitTimestamp } from './utils/getGitTimestamp'

// 公共 API 保持原样(cli.ts / build.ts / plugin.ts 的导入路径不变):
// MarkdownCompileResult 类型与 clearCache 由 markdown/compileCache 提供,
// 这里仅做再导出。
export { clearCache } from './markdown/compileCache'
export type { MarkdownCompileResult } from './markdown/compileCache'

const debug = createDebug('vitepress:md')

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

  return async (src: string, file: string) => {
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
      const cached = getCachedCompileResult(cacheKey)
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
    const maskedScripts: MaskedScriptBlock[] = []
    src = maskScriptBlocks(src, maskedScripts)

    // ★阶段1.5(D2):JSX 整行 HTML(含 ={)→ 占位;正文 {expr} → 表达式占位
    const exprStore: PlaceholderStore = []
    src = maskJsxHtmlLines(src, exprStore)
    src = maskJsxExpressions(src, exprStore)

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
    const contentLineOffset = computeContentLineOffset(src, content)

    // validate data.links
    const deadLinks = collectDeadLinks({
      links,
      linkLines,
      contentLineOffset,
      srcDir,
      file,
      fileOrig,
      pages,
      rewritesMap: siteConfig?.rewrites.map,
      rewritesInv: siteConfig?.rewrites.inv,
      publicDir: siteConfig?.publicDir,
      ignoreDeadLinks: siteConfig?.ignoreDeadLinks
    })

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
    // themeConfig.markdownScopedCss:md 页 <style scoped> / *.scoped.* 导入走
    // jsx-scoped 管线(plugin.ts 在 oxc 前做 transform),为 false 时保持旧全局注入
    const scopedCssEnabled = Boolean(
      siteConfig.site?.themeConfig?.markdownScopedCss
    )
    const reactSrc = createReactPageSrc(
      html,
      sfcBlocks,
      pageData,
      exprStore,
      scopedCssEnabled
    )

    debug(`[render] ${file} in ${Date.now() - start}ms.`)

    const result = { reactSrc, pageData, deadLinks, includes }
    if (options.cache !== false) setCachedCompileResult(cacheKey, result)
    return result
  }
}

function normalizeDriveLetter(file: string) {
  return file.replace(/^[a-z]:/i, (drive) => drive.toLowerCase())
}
