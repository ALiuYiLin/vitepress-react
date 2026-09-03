import { useData, useNavigate, useRoute } from 'vitepress'

import { cn } from './lib/utils'
import {
  normalizePath,
  sidebarGroupsFor,
  type VpSidebarConfig,
  type VpSidebarItem
} from './theme-utils'

function isItemActive(item: VpSidebarItem, current: string): boolean {
  return !!item.link && normalizePath(item.link) === current
}

function SidebarItemLink({
  item,
  depth,
  onNavigate
}: {
  item: VpSidebarItem
  depth: number
  onNavigate?: () => void
}) {
  const current = normalizePath(useRoute().path)
  const navigate = useNavigate()
  const active = isItemActive(item, current)

  if (item.link) {
    return (
      <a
        href={item.link}
        onClick={(e) => {
          e.preventDefault()
          navigate(item.link!)
          onNavigate?.()
        }}
        className={cn(
          'block rounded-md px-3 py-1.5 text-sm transition-colors',
          depth > 0 ? 'pl-6' : '',
          active
            ? 'bg-accent font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {item.text}
      </a>
    )
  }
  return (
    <div
      className={cn(
        'px-3 py-1.5 text-sm font-semibold',
        depth > 0 ? 'pl-6 font-medium' : ''
      )}
    >
      {item.text}
    </div>
  )
}

function SidebarItems({
  items,
  depth = 0,
  onNavigate
}: {
  items: VpSidebarItem[]
  depth?: number
  onNavigate?: () => void
}) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="space-y-0.5">
          <SidebarItemLink item={item} depth={depth} onNavigate={onNavigate} />
          {item.items && (
            <div className="mt-0.5 space-y-0.5">
              <SidebarItems
                items={item.items}
                depth={depth + 1}
                onNavigate={onNavigate}
              />
            </div>
          )}
        </div>
      ))}
    </>
  )
}

/** 侧边栏主体(桌面常驻;移动端由 MobileNav 复用) */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { theme } = useData()
  const path = useRoute().path
  const cfg = theme as { sidebar?: VpSidebarConfig }
  const groups = sidebarGroupsFor(path, cfg.sidebar)

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.text && (
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.text}
            </div>
          )}
          <SidebarItems items={group.items} onNavigate={onNavigate} />
        </div>
      ))}
    </div>
  )
}
