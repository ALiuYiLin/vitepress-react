import { useEffect, useState } from 'react'
import { Content, useRoute } from 'vitepress'

import { AsideOutline } from './AsideOutline'
import { Footer } from './Footer'
import { MobileNav } from './MobileNav'
import { PrevNext } from './PrevNext'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

/** 文档页整体布局(md 内容走框架 <Content />,由 .vp-doc 排版;页面骨架为 shadcn 风格) */
export function Layout() {
  const route = useRoute()
  const [mobileOpen, setMobileOpen] = useState(false)

  // 路由变化时关闭移动端抽屉
  useEffect(() => {
    setMobileOpen(false)
  }, [route.path])

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((v) => !v)}
      />
      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 sm:px-6 lg:px-8">
        {/* 左:侧边栏(桌面) */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-1">
            <Sidebar />
          </div>
        </aside>

        {/* 中:正文(md 内容由 .vp-doc 排版) */}
        <main className="min-w-0 flex-1 py-8">
          <article className="min-w-0">
            <Content />
          </article>
          <PrevNext />
        </main>

        {/* 右:本页目录(大屏) */}
        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto py-8">
            <AsideOutline />
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  )
}
