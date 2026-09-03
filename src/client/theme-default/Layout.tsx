import { Content } from 'vitepress'

import { AsideOutline } from './AsideOutline'
import { Footer } from './Footer'
import { PrevNext } from './PrevNext'
import { AppSidebar } from './Sidebar'
import { TopNav } from './TopNav'
import {
  SidebarInset,
  SidebarProvider
} from './components/ui/sidebar'

/**
 * 默认主题 Layout(对齐 vitepress 官方形态):
 *   SidebarProvider 包裹全部 → 顶栏跨全宽(覆盖侧栏上方)→ 侧栏(顶栏下方
 *   sticky)→ 内容区 + 右大纲。md 正文走 <Content />(.vp-doc 排版)。
 */
export function Layout() {
  return (
    <SidebarProvider className="flex-col">
      <TopNav />

      <div className="flex flex-1">
        <div
          className="sticky top-14"
          style={{ height: 'calc(100vh - 3.5rem)' }}
        >
          <AppSidebar />
        </div>

        <SidebarInset>
          <div className="flex flex-1 flex-col">
            <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 sm:px-6 lg:px-8">
              <main className="min-w-0 flex-1 py-8">
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
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
