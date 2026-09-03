import { X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { normalizePath, sidebarGroupsFor } from '../lib/vp-data'
import { Sidebar } from './Sidebar'

// 移动端全屏抽屉(先手写覆盖层;将来可替换为 shadcn 的 Sheet)
export function MobileNav({ onClose }: { onClose: () => void }) {
  const path = normalizePath(window.location.pathname)

  return (
    <div className="fixed inset-0 top-14 z-40 flex flex-col overflow-y-auto border-b bg-background lg:hidden">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          导航({path})
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
          <X className="size-5" />
        </Button>
      </div>
      <div className="p-4">
        <div className="mb-4 rounded-md border p-3">
          <Sidebar onNavigate={onClose} />
        </div>
        <div className="px-3 text-xs text-muted-foreground">
          侧边栏命中:{sidebarGroupsFor(path).length} 个分组;桌面端在左侧显示,
          移动端收进本抽屉。
        </div>
      </div>
    </div>
  )
}
