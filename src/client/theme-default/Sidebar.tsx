import { useData, useNavigate, useRoute } from 'vitepress'

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  Sidebar
} from './components/ui/sidebar'
import {
  normalizePath,
  sidebarGroupsFor,
  type VpSidebarConfig,
  type VpSidebarItem
} from './theme-utils'

function isItemActive(item: VpSidebarItem, current: string): boolean {
  return !!item.link && normalizePath(item.link) === current
}

/** 递归渲染菜单项:链接用 SidebarMenuButton,子项用 SidebarMenuSub */
function MenuItems({
  items,
  depth,
  current,
  navigate
}: {
  items: VpSidebarItem[]
  depth: number
  current: string
  navigate: (to: string) => void
}) {
  if (items.length === 0) return null
  return (
    <>
      {items.map((item, i) => {
        if (item.link) {
          return (
            <SidebarMenuSubItem key={i}>
              <SidebarMenuButton
                asChild
                size={depth > 0 ? 'sm' : 'default'}
                isActive={isItemActive(item, current)}
              >
                <a
                  href={item.link}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(item.link!)
                  }}
                >
                  {item.text}
                </a>
              </SidebarMenuButton>
            </SidebarMenuSubItem>
          )
        }
        return (
          <SidebarMenuSubItem key={i}>
            <div className="text-sidebar-foreground/70 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider">
              {item.text}
            </div>
          </SidebarMenuSubItem>
        )
      })}
      {/* 子项递归(非空时) */}
    </>
  )
}

/** 默认主题侧栏:左侧导航(桌面常驻;移动端由 shadcn Sidebar 自动收进 Sheet) */
export function AppSidebar() {
  const { theme, site } = useData()
  const route = useRoute()
  const navigate = useNavigate()
  const cfg = theme as { sidebar?: VpSidebarConfig }
  const groups = sidebarGroupsFor(route.path, cfg.sidebar)
  const current = normalizePath(route.path)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
          className="flex items-center gap-2 px-2 py-1 font-semibold"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            {(site.title ?? 'V').slice(0, 1)}
          </span>
          <span className="truncate">{site.title}</span>
        </a>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, gi) => (
          <SidebarGroup key={gi}>
            {group.text ? <SidebarGroupLabel>{group.text}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item, i) =>
                  item.link ? (
                    <div key={i} className="contents">
                      <SidebarMenuButton asChild isActive={isItemActive(item, current)}>
                        <a
                          href={item.link}
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(item.link!)
                          }}
                        >
                          {item.text}
                        </a>
                      </SidebarMenuButton>
                      {item.items?.length ? (
                        <SidebarMenuSub>
                          <MenuItems
                            items={item.items}
                            depth={1}
                            current={current}
                            navigate={navigate}
                          />
                        </SidebarMenuSub>
                      ) : null}
                    </div>
                  ) : (
                    <SidebarMenuSubItem key={i}>
                      <div className="text-sidebar-foreground/70 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider">
                        {item.text}
                      </div>
                    </SidebarMenuSubItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  )
}
