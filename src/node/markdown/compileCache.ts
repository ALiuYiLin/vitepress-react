// 编译结果缓存与站点分辨率快照(自 markdownToReact.ts 拆分)。
//
// 单例职责(模块级状态只允许出现在这里,避免各页面编译函数各自持有一份):
//   - LRU:sha256(src)+站点快照时间戳+相对路径 → MarkdownCompileResult;
//   - siteConfig 的 pages / dynamicRoutes / rewrites 惰性快照(dirty 标记),
//     markdownToReact 编译函数每次调用都基于同一份快照做链接解析。

import path from 'node:path'

import { LRUCache } from 'lru-cache'

import type { SiteConfig } from '../config'
import { slash, type PageData } from '../shared'
import type { DeadLink } from './deadLinks'

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
  deadLinks: DeadLink[]
  includes: string[]
}

const cache = new LRUCache<string, MarkdownCompileResult>({
  maxSize: 64 * 1024 * 1024,
  sizeCalculation(value, key) {
    return Math.max(1, 2 * (key.length + value.reactSrc.length))
  }
})

export function clearCache(relativePath?: string) {
  if (!relativePath) {
    cache.clear()
    return
  }

  cache.find((_, key) => key.endsWith(`:${relativePath}`) && cache.delete(key))
}

export function getCachedCompileResult(
  cacheKey: string
): MarkdownCompileResult | undefined {
  return cache.get(cacheKey)
}

export function setCachedCompileResult(
  cacheKey: string,
  result: MarkdownCompileResult
) {
  cache.set(cacheKey, result)
}

// ============ 站点分辨率快照 ============

let __pages: string[] = []
let __dynamicRoutes = new Map<string, [string, string]>()
let __rewrites = new Map<string, string>()
let __ts: number

function normalizeDriveLetter(file: string) {
  return file.replace(/^[a-z]:/i, (drive) => drive.toLowerCase())
}

/**
 * 基于 siteConfig.__dirty 惰性重建 pages / dynamicRoutes / rewrites 快照。
 * 每次编译调用共享同一份快照,直到配置被标脏(cli 的 --force 或插件改动)。
 */
export function getResolutionCache(siteConfig: SiteConfig) {
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
