import { Content } from 'vitepress'

import { AsideOutline } from './AsideOutline'
import { Footer } from './Footer'
import { PrevNext } from './PrevNext'
import { AppSidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { SidebarProvider } from './components/ui/sidebar'

/**
 * 默认主题 Layout(对齐 vitepress 官方):
 *   顶栏跨全宽 → (sidebar + content + outline) 作为整体居中,左右留白;
 *   侧栏紧挨内容区。md 正文走 <Content />(.vp-doc 排版)。
 */
export function Layout() {
  return (
    <SidebarProvider className="flex-col">
      <TopNav />

      <div className="flex-1">
        <div
          className="mx-auto flex w-full"
          style={{ maxWidth: 1440 }}
        >
          <div
            className="sticky top-14 shrink-0"
            style={{ height: 'calc(100vh - 3.5rem)', width: '16rem' }}
          >
            <AppSidebar />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-1">
              <main className="min-w-0 flex-1 px-8 py-8">
                <article className="min-w-0">
                  <Content />
                </article>
                <PrevNext />
              </main>

              {/* 右:本页目录(大屏) */}
              <aside className="hidden w-48 shrink-0 py-8 xl:block">
                <AsideOutline />
              </aside>
            </div>

            <Footer />
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
