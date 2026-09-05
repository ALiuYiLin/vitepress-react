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

import { markdown as zhMarkdown } from '../zh/config.ts'

const prod = !!process.env.NETLIFY
const siteUrl = 'https://vitepress.dev'

const ogImage = new URL('/vitepress-og.jpg', siteUrl).href

const localeToOgLocaleMap: Record<string, string> = {
  root: 'en_US',
  zh: 'zh_CN'
}

export default defineConfig({
  title: 'VitePress',

  rewrites: {
    'en/:rest*': ':rest*'
  },

  lastUpdated: true,
  cleanUrls: true,

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
    logo: { src: '/vitepress-logo-mini.svg', width: 24, height: 24 },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ALiuYiLin/vitepress-react' }
    ],

    // 本地搜索(离线,minisearch 索引由 vitepress 构建期生成);
    // 各 locale 的界面文案经 themeConfig.search.options.translations 覆盖
    search: {
      provider: 'local'
    },

    carbonAds: { code: 'CEBDT27Y', placement: 'vuejsorg' },

    // md 页 <style scoped> / *.scoped.* 导入 → Vue-like 页面级 scoped 样式
    // (需下方 vite.plugins 里的 jsxScopedVitePlugin 提供虚拟 css resolve/load)
    markdownScopedCss: true
  },

  locales: {
    root: { label: 'English', lang: 'en-US', dir: 'ltr' },
    zh: { label: '简体中文', lang: 'zh-Hans', dir: 'ltr', markdown: zhMarkdown }
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
      prod && llmstxt({ workDir: 'en', ignoreFiles: ['index.md'] })
    ]
  },

  // prettier-ignore
  transformPageData: prod ? (pageData, ctx) => {
    const url = new URL(pageData.relativePath.replace(/(?:(^|\/)index)?\.md$/, '$1'), siteUrl).href
    const site = resolveSiteDataByRoute(ctx.siteConfig.site, pageData.relativePath)
    const title = pageData.title ? `${pageData.title} | VitePress` : site.title
    const description = pageData.description || site.description
    const locale = localeToOgLocaleMap[site.localeIndex || 'root']

    ;((pageData.frontmatter.head ??= []) as HeadConfig[]).push(
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:locale', content: locale }],
      ['meta', { property: 'og:site_name', content: 'VitePress' }],
      ['meta', { property: 'og:image', content: ogImage }],
      ['meta', { property: 'og:image:secure_url', content: ogImage }],
      ['meta', { property: 'og:image:type', content: 'image/jpeg' }],
      ['meta', { property: 'og:image:width', content: '1280' }],
      ['meta', { property: 'og:image:height', content: '640' }],
      ['meta', { property: 'og:image:alt', content: 'VitePress' }],
      ['link', { rel: 'canonical', href: url }]
    )
  } : undefined
})
