// 死链校验(自 markdownToReact.ts 拆分;纯函数,依赖显式传入)。
// collectDeadLinks 的判定语义与上游一致:目标 URL 须命中 pages / rewrites
// 反写路径 / publicDir 静态 html 之一,否则按 ignoreDeadLinks 规则上报。

import fs from 'node:fs'
import path from 'node:path'

import type { SiteConfig } from '../config'
import { EXTERNAL_URL_RE, slash, treatAsHtml } from '../shared'

export interface DeadLink {
  url: string
  file: string
  line?: number
}

export interface CollectDeadLinksOptions {
  /** env.links(md 里收集到的目标链接) */
  links: string[]
  /** env.linkLines(与 links 对应的源行号;缺行则 undefined) */
  linkLines: (number | undefined)[]
  /** content 相对 src 首部的行偏移(include 展开时链接行号需平移) */
  contentLineOffset: number
  srcDir: string
  /** 当前渲染文件(rewrite 映射后的实际文件路径;用于相对链接解析) */
  file: string
  /** 链接目标文件(动态路由的原始文件 / rewrite 前的路径;上报用) */
  fileOrig: string
  /** siteConfig.pages(不含 .md 后缀的 srcDir 相对路径集合) */
  pages: string[]
  /** siteConfig.rewrites.map(source → rewritten) */
  rewritesMap?: Record<string, string | undefined>
  /** siteConfig.rewrites.inv(rewritten → source) */
  rewritesInv?: Record<string, string | undefined>
  /** siteConfig.publicDir(为空字符串/undefined 表示未启用) */
  publicDir?: string
  /** siteConfig.ignoreDeadLinks */
  ignoreDeadLinks?: SiteConfig['ignoreDeadLinks']
}

function countLineBreaks(str: string) {
  return str.match(/\r?\n/g)?.length ?? 0
}

/**
 * content 相对整份源文本首部的行偏移:include 插件把 env.src 暴露为
 * include 展开后的源,content 是其中正文;若 src 以 content 结尾,
 * 其前缀(展开的前置内容)的换行数即链接行号修正量。
 */
export function computeContentLineOffset(
  src: string,
  content: string | undefined
): number {
  return countLineBreaks(
    content && src.endsWith(content) ? src.slice(0, -content.length) : ''
  )
}

export function collectDeadLinks({
  links,
  linkLines,
  contentLineOffset,
  srcDir,
  file,
  fileOrig,
  pages,
  rewritesMap,
  rewritesInv,
  publicDir,
  ignoreDeadLinks
}: CollectDeadLinksOptions): DeadLink[] {
  const deadLinks: DeadLink[] = []

  function shouldIgnoreDeadLink(url: string) {
    if (!ignoreDeadLinks) {
      return false
    }
    if (ignoreDeadLinks === true) {
      return true
    }
    if (ignoreDeadLinks === 'localhostLinks') {
      return url.replace(EXTERNAL_URL_RE, '').startsWith('//localhost')
    }

    return ignoreDeadLinks.some((ignore) => {
      if (typeof ignore === 'string') return url === ignore
      if (ignore instanceof RegExp) return ignore.test(url)
      if (typeof ignore === 'function') return ignore(url, fileOrig)
      return false
    })
  }

  // 与上游一致:ignoreDeadLinks === true 时整段跳过
  if (links.length === 0 || ignoreDeadLinks === true) return deadLinks

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
    const rewriteSource = rewritesInv?.[resolved + '.md']
    if (rewriteSource) resolved = rewriteSource.slice(0, -3)

    // a link to the pre-rewrite path of a rewritten page 404s in the
    // built site even though the page itself exists
    const rewritten = rewriteSource
      ? undefined
      : rewritesMap?.[resolved + '.md']

    if (
      (!pages.includes(resolved) ||
        (rewritten != null && rewritten !== resolved + '.md')) &&
      !(publicDir && fs.existsSync(path.join(publicDir, `${resolved}.html`))) &&
      !shouldIgnoreDeadLink(url)
    ) {
      deadLinks.push(
        line == null ? { url, file: fileOrig } : { url, file: fileOrig, line }
      )
    }
  }

  return deadLinks
}
