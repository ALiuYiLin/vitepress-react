import { Content } from 'vitepress'

import { AsideOutline } from './AsideOutline'
import { Footer } from './Footer'
import { PrevNext } from './PrevNext'
import { AppSidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { SidebarProvider } from './components/ui/sidebar'

/**
 * 默认主题 Layout(对齐 vitepress 官方):
 *   左侧栏全高(顶部 logo)→ 右侧列 = 顶栏(只覆盖正文+页面导航宽度)
 *   + 内容(.vp-doc)+ 页面导航;两者整体居中,左右留白。
 */
export function Layout() {
  return (
    <SidebarProvider className="flex-col">
      <div className="flex-1">
        <div
          className="mx-auto flex w-full"
          style={{ maxWidth: 1440 }}
        >
          {/* 左:侧栏,全高 sticky */}
          <div
            className="sticky top-0 shrink-0"
            style={{ height: '100vh', width: '16rem' }}
          >
            <AppSidebar />
          </div>

          {/* 右:顶栏 + 内容 + 页面导航 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav />

            <div className="flex flex-1">
              <main className="min-w-0 flex-1 px-8 py-8">
                <article className="min-w-0">
                  <Content />
                </article>
                <PrevNext />
              </main>

              {/* 页面导航(大屏) */}
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
