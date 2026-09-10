import {
  defineConfig,
  resolveSiteDataByRoute,
  type HeadConfig
} from '@10coding/vitepress-react'
import jsxScopedVitePlugin from '@10coding/vite-plugin-jsx-scoped'
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
  localIconLoader
} from 'vitepress-plugin-group-icons'
import llmstxt from 'vitepress-plugin-llms'

// 单语站点(en 文档已移除,只保留 zh):复用 zh 的导航/侧栏/界面文案,
// 但把配置里的 /zh/ 前缀路径改写为根路径(zh/*.md 经 rewrites 挂到 '/')。
import zhConfig, { markdown as zhMarkdown } from '../zh/config.ts'

// GitHub Pages 的项目站点服务在 `/<repo>/` 子路径下,base 必须与之一致:
// 由部署工作流注入 DOCS_BASE=/vitepress-react/;本地开发/预览保持根路径。
const base = process.env.DOCS_BASE || '/'
// 站点部署地址(**含部署子路径**;GitHub Pages 项目站点即 origin + /<repo>/),
// 换域名 / 换平台时用 DOCS_SITE_URL 覆盖(例如仍部署在 Netlify 时)。
// 必须以 `/` 结尾:否则 `new URL('guide/x', siteUrl)` 会把它当文件路径,
// 吃掉最后一段。
const siteUrl =
  (
    process.env.DOCS_SITE_URL || 'https://aliuyilin.github.io/vitepress-react'
  ).replace(/\/+$/, '') + '/'
// 生产构建:Netlify(历史部署),或由工作流显式声明 DOCS_PROD=1
const prod = !!process.env.NETLIFY || process.env.DOCS_PROD === '1'

const ogImage = new URL('vitepress-og.jpg', siteUrl).href

/** 把对象里的 /zh/ 路径前缀改写为根路径(纯字符串替换,配置无函数字段) */
function toRootPaths<T>(value: T): T {
  if (typeof value === 'string')
    return (value.includes('/zh/') ? value.replaceAll('/zh/', '/') : value) as T
  if (Array.isArray(value)) return value.map(toRootPaths) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toRootPaths(v)
    }
    return out as T
  }
  return value
}

const zhTheme = toRootPaths(zhConfig.themeConfig ?? {})

export default defineConfig({
  base,
  title: 'VitePress-React',
  description: zhConfig.description,
  lang: 'zh-Hans',
  lastUpdated: true,
  cleanUrls: true,

  // 文件在 docs/zh/ 下,路由去掉 zh/ 前缀挂在根路径
  rewrites: {
    'zh/:rest*': ':rest*'
  },

  markdown: {
    math: true,
    codeTransformers: [
      // We use `[!!code` and `@@include` in demo to prevent transformation,
      // here we revert it back.
      {
        postprocess(code) {
          return code
            .replaceAll('[!!code', '[!code')
            .replaceAll('@@include', '@include')
        }
      }
    ],
    // zh 的容器标题/复制按钮文案
    ...zhMarkdown,
    config(md) {
      md.use(groupIconMdPlugin)
    }
  },

  sitemap: {
    // sitemap 的 hostname 需要以 `/` 结尾(否则 URL 解析会吃掉最后一段路径);
    // siteUrl 已含部署子路径,因此这里直接用它。
    hostname: siteUrl,
    transformItems(items) {
      return items.filter((item) => !item.url.includes('migration'))
    }
  },

  // prettier-ignore
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}vitepress-logo-mini.svg` }],
    ['link', { rel: 'icon', type: 'image/png', href: `${base}vitepress-logo-mini.png` }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['script', { src: 'https://cdn.usefathom.com/script.js', 'data-site': 'AZBRSFGG', 'data-spa': 'auto', defer: '' }]
  ],

  themeConfig: {
    ...zhTheme,
    // 注:nav/sidebar 实际由 docs/zh/config.ts(按目录附加配置)合并生效,
    // 此处展开仅提供 logo/socialLinks/search/carbonAds/scopedCss 等基座字段。

    logo: { src: '/vitepress-logo-mini.svg', width: 24, height: 24 },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ALiuYiLin/vitepress-react' }
    ],

    // zh 配置只覆盖了界面文案;provider 由根配置指定(本地搜索,离线)
    search: {
      provider: 'local',
      options: zhTheme.search?.options
    },

    carbonAds: { code: 'CEBDT27Y', placement: 'vuejsorg' },

    // md 页 <style scoped> / *.scoped.* 导入 → Vue-like 页面级 scoped 样式
    // (需下方 vite.plugins 里的 jsxScopedVitePlugin 提供虚拟 css resolve/load)
    markdownScopedCss: true
  },

  vite: {
    plugins: [
      jsxScopedVitePlugin(),
      groupIconVitePlugin({
        customIcon: {
          vitepress: localIconLoader(
            import.meta.url,
            '../public/vitepress-logo-mini.svg'
          ),
          firebase: 'logos:firebase'
        }
      }),
      // injectLLMHint 会在 md 源码里插入一段原生 HTML
      // (`<div style="display: none;" hidden ...>`)——块级 HTML 在本引擎里按
      // JSX 原文接管,`style="…"` 字符串不是合法的 React style prop,会直接
      // 让 SSR 报错。插件其余能力(llms.txt / llms-full.txt / 每页 md)不受影响。
      prod &&
        llmstxt({
          workDir: 'zh',
          ignoreFiles: ['index.md'],
          injectLLMHint: false
        })
    ]
  },

  // prettier-ignore
  transformPageData: prod ? (pageData, ctx) => {
    const url = new URL(pageData.relativePath.replace(/(?:(^|\/)index)?\.md$/, '$1'), siteUrl).href
    const site = resolveSiteDataByRoute(ctx.siteConfig.site, pageData.relativePath)
    const title = pageData.title ? `${pageData.title} | VitePress-React` : site.title
    const description = pageData.description || site.description

    ;((pageData.frontmatter.head ??= []) as HeadConfig[]).push(
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:site_name', content: 'VitePress-React' }],
      ['meta', { property: 'og:image', content: ogImage }],
      ['meta', { property: 'og:image:secure_url', content: ogImage }],
      ['meta', { property: 'og:image:type', content: 'image/jpeg' }],
      ['meta', { property: 'og:image:width', content: '1280' }],
      ['meta', { property: 'og:image:height', content: '640' }],
      ['meta', { property: 'og:image:alt', content: 'VitePress' }]
    )
  } : undefined
})
