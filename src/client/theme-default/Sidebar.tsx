import { useData, useRoute } from 'vitepress'

import {
  isActivePath,
  isExternal,
  normalizePath,
  sidebarForPath
} from './theme-utils'
import type { SidebarConfig, SidebarItem } from './theme-utils'

/** 单个可点项/分组(递归) */
function SidebarEntry({
  item,
  depth,
  routePath
}: {
  item: SidebarItem
  depth: number
  routePath: string
}) {
  const hasChildren = !!item.items?.length
  if (hasChildren && !item.link) {
    // 分组标题
    return (
      <li>
        {item.text ? (
          <p className="vp-sidebar-group-title">{item.text}</p>
        ) : null}
        {item.items ? (
          <ul
            className="vp-sidebar-sub"
            style={{ listStyle: 'none', margin: 0, paddingLeft: depth > 1 ? 16 : 0 }}
          >
            {item.items.map((sub, i) => (
              <SidebarEntry
                key={i}
                item={sub}
                depth={depth + 1}
                routePath={routePath}
              />
            ))}
          </ul>
        ) : null}
      </li>
    )
  }
  // 可点项(自身 link,或同时带子项:渲染链接 + 子分组)
  const active =
    !!item.link && isActivePath(item.link, routePath, (item as any).activeMatch)
  return (
    <li>
      {item.link ? (
        <a
          className={`vp-sidebar-link${active ? ' active' : ''}`}
          href={isExternal(item.link) ? item.link : normalizeHref(item.link)}
          {...(isExternal(item.link) ? { target: '_blank', rel: 'noopener' } : {})}
        >
          {item.text}
        </a>
      ) : item.text ? (
        <p className="vp-sidebar-group-title">{item.text}</p>
      ) : null}
      {item.items ? (
        <ul className="vp-sidebar-sub" style={{ listStyle: 'none', margin: 0, paddingLeft: depth > 1 ? 16 : 0 }}>
          {item.items.map((sub, i) => (
            <SidebarEntry
              key={i}
              item={sub}
              depth={depth + 1}
              routePath={routePath}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** 当前路由的 sidebar 内容(桌面栏与移动抽屉共用) */
export function SidebarList() {
  const { theme } = useData()
  const route = useRoute()
  const cfg = theme as { sidebar?: SidebarConfig }
  const items = sidebarForPath(cfg.sidebar, route.path)
  if (!items.length) return null
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((item, i) => (
        <SidebarEntry key={i} item={item} depth={1} routePath={route.path} />
      ))}
    </ul>
  )
}

function normalizeHref(link: string): string {
  // 站内路径统一归一(尾斜杠/扩展名交由框架拦截处理,这里只做展示归一)
  const n = normalizePath(link)
  return n === '/' ? '/' : n
}
