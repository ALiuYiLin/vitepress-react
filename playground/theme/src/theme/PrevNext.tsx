import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'
import {
  flattenSidebarItems,
  normalizePath,
  sidebarGroupsFor,
  type VpSidebarItem
} from '../lib/vp-data'
import { useNavigate, useRoute } from '../lib/vp-store'

function CardLink({
  dir,
  item,
  navigate
}: {
  dir: 'prev' | 'next'
  item?: VpSidebarItem
  navigate: (to: string) => void
}) {
  if (!item?.link) return <div className="flex-1" />
  const isPrev = dir === 'prev'
  return (
    <a
      href={item.link}
      onClick={(e) => {
        e.preventDefault()
        navigate(item.link!)
      }}
      className={cn(
        'group flex flex-1 flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-primary/60 hover:bg-accent/50',
        !isPrev && 'items-end text-right'
      )}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {isPrev && <ChevronLeft className="size-3.5" />}
        {isPrev ? '上一页' : '下一页'}
        {!isPrev && <ChevronRight className="size-3.5" />}
      </span>
      <span className="font-medium">{item.text}</span>
    </a>
  )
}

/** 基于当前侧边栏激活分组顺序的 上一页/下一页 */
export function PrevNext() {
  const route = useRoute()
  const navigate = useNavigate()
  const groups = sidebarGroupsFor(route.path)
  const flat = flattenSidebarItems(groups)
  const idx = flat.findIndex(
    (it) => it.link && normalizePath(it.link) === normalizePath(route.path)
  )
  const prev = idx > 0 ? flat[idx - 1] : undefined
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : undefined

  // 不在任何侧边栏分组里(如 404)时不渲染
  if (!flat.length || idx < 0) return null
  return (
    <div className="mt-12 flex gap-3 border-t pt-6">
      <CardLink dir="prev" item={prev} navigate={navigate} />
      <CardLink dir="next" item={next} navigate={navigate} />
    </div>
  )
}
