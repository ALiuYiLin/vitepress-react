import path from 'node:path'

import { exactRegex } from '@rolldown/pluginutils'
import { createJsxScopedPipeline } from '@10coding/vite-plugin-jsx-scoped'
import c from 'picocolors'
import {
  mergeConfig,
  normalizePath,
  searchForWorkspaceRoot,
  transformWithOxc,
  type EnvironmentModuleNode,
  type Plugin,
  type ResolvedConfig,
  type Rolldown,
  type UserConfig
} from 'vite'

import {
  APP_PATH,
  DEFAULT_THEME_PATH,
  DIST_CLIENT_PATH,
  SITE_DATA_ID,
  SITE_DATA_REQUEST_PATH,
  resolveAliases
} from './alias'
import { isAdditionalConfigFile, resolvePages, type SiteConfig } from './config'
import {
  clearCache,
  createMarkdownToReactRenderFn,
  type MarkdownCompileResult
} from './markdownToReact'
import { assetsBasePlugin } from './plugins/assetsBasePlugin'
import { iconsPlugin } from './plugins/iconsPlugin'
import { dynamicRoutesPlugin } from './plugins/dynamicRoutesPlugin'
import { localSearchPlugin } from './plugins/localSearchPlugin'
import { rewritesPlugin } from './plugins/rewritesPlugin'
import { staticDataPlugin } from './plugins/staticDataPlugin'
import { webFontsPlugin } from './plugins/webFontsPlugin'
import { slash, type PageDataPayload } from './shared'
import { deserializeFunctions, serializeFunctions } from './utils/fnSerialize'
import { cacheAllGitTimestamps } from './utils/getGitTimestamp'

declare module 'vite' {
  interface UserConfig {
    vitepress?: SiteConfig
  }
}

const themeRE = /(?:^|\/)\.vitepress\/theme\/index\.(m|c)?(j|t)s$/
const startsWithThemeRE = /^@theme(?:\/|$)/
const docsearchRE = /\bdocsearch\b/ // narrow it if any issue arises

const hashRE = /\.([-\w]+)\.js$/

// md scoped css(themeConfig.markdownScopedCss)的编译期 transform 实例:
// 虚拟 css 模块的 resolve/load 由站点注册的 jsxScopedVitePlugin 提供,两者共享
// jsx-scoped 的进程级默认 registry,因此本实例 transform 登记的内联样式可被
// 站点插件实例读取(vitepress 核心与站点插件处于不同的 Vite 插件上下文)。
const jsxScopedPipeline = createJsxScopedPipeline()

const isPageChunk = <T extends Rolldown.OutputChunk | Rolldown.RenderedChunk>(
  chunk: Rolldown.OutputAsset | T
): chunk is T =>
  !!(
    chunk.type === 'chunk' &&
    chunk.isEntry &&
    chunk.facadeModuleId?.endsWith('.md')
  )

const cleanUrl = (url: string): string => url.replace(/[?#].*$/s, '')

// per-page metadata collected during transform, keyed by relativePath
export interface PageMeta {
  lastUpdated?: number
}

/**
 * markdownToReact 产出的 TSX 文本 → 可执行 JS:
 * 在 vitepress 插件内部用 vite 的 oxc 变换编译(automatic JSX runtime,
 * import react/jsx-runtime),避免依赖对 .md 扩展名开放的第三方 babel 插件。
 * (vite 8 不再内置 esbuild,故用 transformWithOxc)
 */
async function compileReactSrc(src: string): Promise<string> {
  const result = await transformWithOxc(src, 'page.md.tsx', {
    jsx: { runtime: 'automatic' }
  })
  return result.code
}

export async function createVitePressPlugin(
  siteConfig: SiteConfig,
  ssr = false,
  pageToHashMap?: Record<string, string>,
  _clientJSMap?: Record<string, string>,
  pageMetaMap?: Record<string, PageMeta>,
  restartServer?: () => Promise<void>
) {
  const {
    srcDir,
    configPath,
    configDeps,
    markdown,
    site,
    vite: userViteConfig,
    lastUpdated,
    cleanUrls
  } = siteConfig

  let markdownToReact: Awaited<
    ReturnType<typeof createMarkdownToReactRenderFn>
  >

  let siteData = site
  let allDeadLinks: MarkdownCompileResult['deadLinks'] = []
  let config: ResolvedConfig
  let importerMap: Record<string, Set<string> | undefined> = {}

  const vitePressPlugin: Plugin = {
    name: 'vitepress',

    async configResolved(resolvedConfig) {
      config = resolvedConfig
      // md scoped css 管线告警走 vite logger,样式预处理读取站点 css 配置
      jsxScopedPipeline.bindViteConfig(resolvedConfig)
      // sync with the actual resolved publicDir (can be customized via
      // vite config, or altered by other vite plugins)
      siteConfig.publicDir = config.publicDir
      // pre-resolve git timestamps
      if (lastUpdated) await cacheAllGitTimestamps(srcDir)
      markdownToReact = await createMarkdownToReactRenderFn(
        srcDir,
        markdown ?? {},
        // the site base, not the vite base: the ssr build runs under the
        // sentinel, and one md singleton serves both builds
        site.base,
        lastUpdated ?? false,
        cleanUrls ?? false,
        siteConfig
      )
    },

    config() {
      const baseConfig: UserConfig = {
        // 默认主题样式由 scripts/build-theme-css.mjs 预编译成纯 CSS(tailwind.css),
        // 因此站点构建链不再注入 Tailwind @tailwindcss/vite 插件。
        resolve: {
          alias: resolveAliases(siteConfig.root)
        },
        define: {
          __VP_LOCAL_SEARCH__: site.themeConfig?.search?.provider === 'local',
          __ALGOLIA__:
            site.themeConfig?.search?.provider === 'algolia' ||
            !!site.themeConfig?.algolia, // legacy
          __CARBON__: !!site.themeConfig?.carbonAds,
          __ASSETS_DIR__: JSON.stringify(siteConfig.assetsDir),
          __ASSETS_BASE__: JSON.stringify(siteConfig.assetsBase ?? '')
        },
        optimizeDeps: {
          // force include react to avoid duplicated copies when linked +
          // optimized; jsx runtime entries are imported by every compiled md
          // page module (automatic JSX runtime), so they must be pre-bundled
          include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react/jsx-dev-runtime'
          ],
          exclude: ['@docsearch/js', '@docsearch/sidepanel-js', 'vitepress']
        },
        server: {
          fs: {
            allow: [
              DIST_CLIENT_PATH,
              srcDir,
              searchForWorkspaceRoot(process.cwd())
            ]
          }
        },
        vitepress: siteConfig
      }
      return userViteConfig
        ? mergeConfig(baseConfig, userViteConfig)
        : baseConfig
    },

    resolveId: {
      filter: { id: [exactRegex(SITE_DATA_ID), startsWithThemeRE] },
      handler(id, importer, resolveOptions) {
        if (id === SITE_DATA_ID) {
          return SITE_DATA_REQUEST_PATH
        }
        return this.resolve(
          siteConfig.themeDir + id.slice(6),
          importer,
          Object.assign({ skipSelf: true }, resolveOptions)
        )
      }
    },

    load: {
      filter: { id: exactRegex(SITE_DATA_REQUEST_PATH) },
      handler() {
        let data = siteData
        // head info is not needed by the client in production build
        if (config.command === 'build') {
          data = { ...siteData, head: [] }
          // in production client build, the data is inlined on each page
          // to avoid config changes invalidating every chunk.
          if (!ssr) {
            return `export default window.__VP_SITE_DATA__`
          }
        }
        const fns: string[] = []
        const dataStr = JSON.stringify(
          JSON.stringify(serializeFunctions(data, fns))
        )
        return fns.length
          ? `${deserializeFunctions};export default deserializeFunctions(JSON.parse(${dataStr}),[${fns.join(',')}])`
          : `export default JSON.parse(${dataStr})`
      }
    },

    transform: {
      // dev 页面请求形如 /index.md?t=<ts>,需容忍 query(rolldown-vite 传给
      // filter 的 id 会带 query;build 阶段无 query)
      filter: { id: [docsearchRE, /\.md(\?.*)?$/] },
      async handler(code, id) {
        const cleanId = id.split('?')[0]
        if (cleanId.endsWith('.md')) {
          const watchIncludes = (files: string[] = []) => {
            files.forEach((i) => {
              ;(importerMap[slash(i)] ??= new Set()).add(slash(cleanId))
              this.addWatchFile(i)
            })
          }

          // transform .md files into a React page module (TSX), then compile
          // it to JS with oxc so the browser/dev-server just sees a
          // regular JS module (mirrors upstream's md→vueSrc + plugin-vue flow)
          const { reactSrc, deadLinks, includes, pageData } = await markdownToReact(
            code,
            cleanId
          ).catch((e: { includes?: string[] }) => {
            // watch the files the failed render did reach, so that creating
            // a missing snippet or include recovers the page
            watchIncludes(e.includes)
            throw e
          })
          if (pageMetaMap) {
            pageMetaMap[pageData.relativePath] = {
              lastUpdated: pageData.lastUpdated
            }
          }
          allDeadLinks.push(...deadLinks)
          watchIncludes(includes)
          if (
            this.environment.mode === 'dev' &&
            this.environment.name === 'client'
          ) {
            logDeadLinks(deadLinks, siteConfig.logger, true)
            const payload: PageDataPayload = {
              path: `/${pageData.relativePath}`,
              pageData
            }
            // notify the client to update page data
            this.environment.hot.send({
              type: 'custom',
              event: 'vitepress:pageData',
              data: payload
            })
          }
          // themeConfig.markdownScopedCss:md 页 scoped 样式 → jsx-scoped
          // transform(整行 auto-detect:无 <style scoped> / *.scoped.* 时跳过)
          let pageSrc = reactSrc
          if (siteConfig.site?.themeConfig?.markdownScopedCss) {
            const scoped = jsxScopedPipeline.transform(reactSrc, cleanId)
            if (scoped.enabled) pageSrc = scoped.code
          }
          return compileReactSrc(pageSrc)
        }
        if (docsearchRE.test(normalizePath(id))) {
          return code
            .replaceAll('[data-theme=dark]', '.dark')
            .replaceAll(
              /@media (?:screen and )?\(max-width:\s*768px\)/g,
              '@media not all and (min-width: 48rem)'
            )
            .replaceAll(
              /\(max-width:\s*768px\)/g,
              'not all and (min-width: 48rem)'
            )
            .replaceAll(/\(min-width:\s*769px\)/g, '(min-width: 48rem)')
        }
      }
    },

    renderStart() {
      if (allDeadLinks.length > 0) {
        logDeadLinks(allDeadLinks, siteConfig.logger)
        siteConfig.logger.info(
          c.cyan(
            '\nIf this is expected, you can disable this check via config. Refer: https://vitepress.dev/reference/site-config#ignoredeadlinks\n'
          )
        )
        throw new Error(`${allDeadLinks.length} dead link(s) found.`)
      }
    },

    configureServer(server) {
      if (configPath) {
        server.watcher.add(configPath)
        configDeps.forEach((file) => server.watcher.add(file))
      }

      // serve our index.html after vite history fallback
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url && cleanUrl(req.url)
          if (url?.endsWith('.html')) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html')
            let html = `\
<!DOCTYPE html>
<html>
  <head>
    <title></title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/@fs/${APP_PATH}/index.js"></script>
  </body>
</html>`
            html = await server.transformIndexHtml(url, html, req.originalUrl)
            res.end(html)
            return
          }
          next()
        })
      }
    },

    generateBundle: {
      order: ssr ? null : 'post',
      handler(_options, bundle) {
        if (ssr) {
          this.emitFile({
            type: 'asset',
            fileName: 'package.json',
            source: '{ "private": true, "type": "module" }'
          })
          return
        }

        // client build:
        // for each .md entry chunk, record page -> hash relations so the
        // client can resolve the hashed chunk file name at runtime.
        // (the upstream lean.js duplicate chunks are intentionally dropped —
        //  D4: no lean.js equivalent in the React runtime)
        for (const name in bundle) {
          const chunk = bundle[name]
          if (isPageChunk(chunk)) {
            const hash = chunk.fileName.match(hashRE)![1]
            pageToHashMap![chunk.name.toLowerCase()] = hash
          }
        }
      }
    },

    async hotUpdate({ file, type }) {
      if (this.environment.name !== 'client') return
      const relativePath = path.posix.relative(srcDir, file)

      // update pages, dynamicRoutes and rewrites on md file creation / deletion
      if (file.endsWith('.md') && type !== 'update') {
        await resolvePages(siteConfig)
      }

      if (
        file === configPath ||
        configDeps.includes(file) ||
        isAdditionalConfigFile(file)
      ) {
        siteConfig.logger.info(
          c.green(
            `${path.relative(process.cwd(), file)} changed, restarting server...\n`
          ),
          { clear: true, timestamp: true }
        )

        return restartServer?.()
      }

      if (themeRE.test(relativePath) && type !== 'update') {
        siteConfig.themeDir =
          type === 'create' ? path.posix.dirname(file) : DEFAULT_THEME_PATH
        siteConfig.logger.info(c.green('page reload ') + c.dim(relativePath), {
          clear: true,
          timestamp: true
        })
        this.environment.moduleGraph.invalidateAll()
        this.environment.hot.send({ type: 'full-reload' })
        return []
      }
    }
  }

  const hmrFix: Plugin = {
    name: 'vitepress:hmr-fix',
    async hotUpdate({ file, type, modules: existingMods }) {
      if (this.environment.name !== 'client') return
      const modules: EnvironmentModuleNode[] = []
      const fileId = slash(file)

      if (file.endsWith('.md')) {
        const mod = this.environment.moduleGraph.getModuleById(file)
        mod && modules.push(mod)
      }

      importerMap[fileId]?.forEach((importerId) => {
        const relativePath = slash(path.relative(srcDir, importerId))
        // the compile cache is keyed by the rewritten path
        clearCache(siteConfig.rewrites.map[relativePath] || relativePath)
        const mod = this.environment.moduleGraph.getModuleById(importerId)
        mod && modules.push(mod)
      })

      if (type === 'delete') {
        // a deleted include: its importers were just invalidated above
        delete importerMap[fileId]
        // a deleted page: prune it from every importer set
        for (const importers of Object.values(importerMap)) {
          importers?.delete(fileId)
        }
      }

      return modules.length ? [...existingMods, ...modules] : undefined
    }
  }

  return [
    vitePressPlugin,
    rewritesPlugin(siteConfig),
    hmrFix,
    webFontsPlugin(siteConfig.useWebFonts),
    ...(userViteConfig?.plugins || []),
    // must stay after the user plugins; see assetsBasePlugin
    ...(siteConfig.assetsBase ? [assetsBasePlugin(siteConfig)] : []),
    iconsPlugin(siteConfig),
    await localSearchPlugin(siteConfig),
    staticDataPlugin,
    await dynamicRoutesPlugin(siteConfig)
  ]
}

function logDeadLinks(
  deadLinks: MarkdownCompileResult['deadLinks'],
  logger: SiteConfig['logger'],
  devMode = false
) {
  const logged = new Set<string>()
  deadLinks.forEach(({ url, file, line }, i) => {
    const location = line == null ? file : `${file}:${line}`
    const key = `${location}:::${url}`
    if (logged.has(key)) return
    logged.add(key)
    const prefix = '\n'.repeat(i === 0 ? (devMode ? 1 : 2) : 0)
    logger.warn(
      c.yellow(
        `${prefix}(!) Found dead link ${c.cyan(url)} in file ${c.white(c.dim(location))}`
      )
    )
  })
}
