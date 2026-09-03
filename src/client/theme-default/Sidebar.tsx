import { useData, useNavigate, useRoute } from 'vitepress'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
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

const labelCls =
  'text-sidebar-foreground/70 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider'

/** 子级菜单项(在 SidebarMenuSub 内):链接 / 分组递归 */
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
  return (
    <>
      {items.map((item, i) => {
        if (item.link) {
          return (
            <SidebarMenuSubItem key={i}>
              <SidebarMenuSubButton
                asChild
                size={depth > 1 ? 'sm' : 'md'}
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
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )
        }
        // 分组标签 + 递归子项
        return (
          <SidebarMenuSubItem key={i}>
            <div className={labelCls}>{item.text}</div>
            {item.items?.length ? (
              <SidebarMenuSub>
                <MenuItems
                  items={item.items}
                  depth={depth + 1}
                  current={current}
                  navigate={navigate}
                />
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuSubItem>
        )
      })}
    </>
  )
}

/** 顶层菜单项(在 SidebarMenu 内):链接(可带子项)或分组 */
function TopMenuItems({
  items,
  current,
  navigate
}: {
  items: VpSidebarItem[]
  current: string
  navigate: (to: string) => void
}) {
  return (
    <>
      {items.map((item, i) => {
        if (item.link) {
          return (
            <SidebarMenuItem key={i}>
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
            </SidebarMenuItem>
          )
        }
        return (
          <SidebarMenuItem key={i}>
            <div className={labelCls}>{item.text}</div>
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
          </SidebarMenuItem>
        )
      })}
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
            {group.text ? (
              <SidebarGroupLabel>{group.text}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                <TopMenuItems
                  items={group.items}
                  current={current}
                  navigate={navigate}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  )
}
