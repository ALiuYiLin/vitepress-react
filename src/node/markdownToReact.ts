// md → React 页面模块管线(M1)的编排层。
//
// 职责:单次编译的流程控制 —— 取站点分辨率快照与编译缓存 → 参数剥离 →
// markdown-it renderAsync(token 级 A/B/C 规则在 md 内完成 JSX 区域占位)→
// 渲染后处理(死链校验 / pageData 组装)→
// markdown/buildReactPageModule 的模块组装 → 写缓存并返回。
//
// V2 契约(见根目录 MD-DYNAMIC-SYNTAX-V2.md):正文裸 {…} 一律字面文本,
// 不再有表达式掩码 Pass;动态内容 = 作者显式写的 JSX(<>{expr}</> /
// 组件标签 / ::: react),由 markdown/jsxTokenRules 的 A/B/C token 规则
// (见 MD-TOKEN-TAKEOVER.md)在 md 内占位、序列化时还原。
//
// 各阶段的实现已拆分到(本目录均相对于 src/node):
//   markdown/jsxTokenRules.ts    token 级接管规则(A script/B Fragment/C 判定)
//   markdown/jsxLexer.ts         词法工具(标签配平/Vue 特征)
//   markdown/placeholders.ts     占位符写入/读取契约
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

    // ★阶段1(M1+Token 接管):<script> 块由 markdown-it 内 A 规则(块级)
    // 捕获进 env.sfcBlocks(不再有字符串预掩码,也不受 html_block type-7
    // 截断影响);JSX 区域(::: react / 整行标签 / <>{expr}</> Fragment)
    // 由 B/C 规则占位、collect 时写入 jsxStore —— 这里只准备 store 并放进 env,
    // 渲染出的 html 里即含 @@VP_HTML_n@@ / <div data-vp-jsx> 占位。
    const jsxStore: PlaceholderStore = []

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
      localeIndex,
      jsxStore
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

    // ★阶段4/5(M1):组装 React 页面模块
    // (script 块已由 A 规则写入 env.sfcBlocks → 提升模块顶层 + 正文
    // HTML→JSX 序列化 + __pageData)
    // themeConfig.markdownScopedCss:md 页 <style scoped> / *.scoped.* 导入走
    // jsx-scoped 管线(plugin.ts 在 oxc 前做 transform),为 false 时保持旧全局注入
    const scopedCssEnabled = Boolean(
      siteConfig.site?.themeConfig?.markdownScopedCss
    )
    const reactSrc = createReactPageSrc(
      html,
      sfcBlocks,
      pageData,
      jsxStore,
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
