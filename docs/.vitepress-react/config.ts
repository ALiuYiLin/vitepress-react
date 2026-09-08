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

const prod = !!process.env.NETLIFY
const siteUrl = 'https://vitepress.dev'

const ogImage = new URL('/vitepress-og.jpg', siteUrl).href

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

const zhTheme = toRootPaths(zhConfig.themeConfig)

export default defineConfig({
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
    hostname: siteUrl,
    transformItems(items) {
      return items.filter((item) => !item.url.includes('migration'))
    }
  },

  // prettier-ignore
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/vitepress-logo-mini.svg' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/vitepress-logo-mini.png' }],
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
      prod && llmstxt({ workDir: 'zh', ignoreFiles: ['index.md'] })
    ]
  },

  // prettier-ignore
  transformPageData: prod ? (pageData, ctx) => {
    const url = new URL(pageData.relativePath.replace(/(?:(^|\/)index)?\.md$/, '$1'), siteUrl).href
    const site = resolveSiteDataByRoute(ctx.siteConfig.site, pageData.relativePath)
    const title = pageData.title ? `${pageData.title} | VitePress` : site.title
    const description = pageData.description || site.description

    ;((pageData.frontmatter.head ??= []) as HeadConfig[]).push(
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:site_name', content: 'VitePress' }],
      ['meta', { property: 'og:image', content: ogImage }],
      ['meta', { property: 'og:image:secure_url', content: ogImage }],
      ['meta', { property: 'og:image:type', content: 'image/jpeg' }],
      ['meta', { property: 'og:image:width', content: '1280' }],
      ['meta', { property: 'og:image:height', content: '640' }],
      ['meta', { property: 'og:image:alt', content: 'VitePress' }]
    )
  } : undefined
})
