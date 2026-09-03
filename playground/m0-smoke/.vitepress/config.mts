import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'M0 Smoke',
  description: 'vitepress-react M0 skeleton smoke site',
  cleanUrls: true,
  ignoreDeadLinks: true, // TODO(m3): 根/目录链接的 dead-link 判定与 pages 形态的匹配
  locales: {
    root: { label: 'English' },
    zh: { label: '简体中文' }
  },
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide' }
    ],
    sidebar: {
      '/': [
        {
          text: 'Smoke',
          items: [
            { text: 'Home', link: '/' },
            { text: 'Guide', link: '/guide' }
          ]
        }
      ],
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Guide Page', link: '/guide' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            {
              text: 'Deploy',
              items: [
                { text: 'Deploy', link: '/guide/deploy/' },
                { text: 'Static Hosting', link: '/guide/deploy/static' }
              ]
            }
          ]
        }
      ]
    },
    footer: {
      message: 'Made with VitePress-React',
      copyright: 'MIT'
    },
    darkModeSwitchLabel: 'Appearance'
  }
})
