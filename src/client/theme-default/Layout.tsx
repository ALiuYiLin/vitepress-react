// M0 占位 Layout:仅用于验证「SSR + 水合 + 路由内容渲染」链路。
// 视觉/结构会在 M4 替换为 shadcn 主题(参考 playground/theme)。

import { Content, useData } from 'vitepress'

export default function Layout() {
  const { site, title } = useData()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <strong>{site.title}</strong>
        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.9em' }}>
          {title}
        </span>
      </header>
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '48rem', margin: '0 auto', width: '100%' }}>
        <Content />
      </main>
      <footer
        style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.85em'
        }}
      >
        VitePress-React · M0 skeleton
      </footer>
    </div>
  )
}
