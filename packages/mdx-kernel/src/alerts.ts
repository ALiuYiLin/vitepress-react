// GitHub-flavored alerts(mdx 内核实现):把 blockquote 首行 `> [!NOTE]` 等
// 转成与 md-it(M1)同构的容器(div.{type} custom-block + 标题),内容/样式与
// `::: note` 容器共用;标题支持 `> [!TYPE] 自定义标题`(同 marker 行)。
//
// mdast 形态(CommonMark):`> [!NOTE]\n> 强调内容…`(无空行)是单个 paragraph,
// 首 text 节点 value 为 `[!NOTE]\n强调内容…`;多段落时 marker 行独立成段。
import type { Root } from 'mdast'

import { DEFAULT_CONTAINER_TITLES } from './containers'

const ALERT_RE = /^\[!([a-zA-Z][a-zA-Z0-9_-]*)\](.*)$/s

/** 缺省标题与容器 titles 一致(NOTE/TIP/IMPORTANT/WARNING/CAUTION…) */
function defaultTitle(type: string): string | undefined {
  return DEFAULT_CONTAINER_TITLES[type.toLowerCase()]
}

/** 尝试把 blockquote 转换为 alert vpContainer;不匹配返回 null */
function tryAlert(node: any): any | null {
  if (!node || node.type !== 'blockquote') return null
  const children = (node.children ?? []) as any[]
  const first = children[0]
  if (!first || first.type !== 'paragraph') return null
  const textNode = (first.children ?? []).find(
    (c: any) => c?.type === 'text'
  ) as { value?: string } | undefined
  if (!textNode || textNode.value == null) return null
  const m = ALERT_RE.exec(textNode.value)
  if (!m) return null
  const type = m[1].toLowerCase()
  if (type === 'details' || !(type in DEFAULT_CONTAINER_TITLES)) return null

  const rest = m[2]
  // rest 以换行开头 → marker 独占一行,rest 属内容(同段续行);否则是同行标题
  const sameLineTitle = !rest.startsWith('\n')
  const titleText = sameLineTitle ? rest.trim() : ''
  const leftover = rest.startsWith('\n') ? rest.slice(1) : ''

  // 组装容器内容:首段去除 marker(残余内容若同段保留),再接后续块
  const content: any[] = []
  if (leftover) {
    content.push({
      type: 'paragraph',
      children: [{ type: 'text', value: leftover }]
    })
  }
  for (const ch of children.slice(1)) content.push(ch)

  return {
    type: 'vpContainer',
    name: type,
    attrs: { classes: ['github-alert'], noTitle: false, open: false },
    defaultTitle: !titleText,
    titleChildren: titleText
      ? [{ type: 'text', value: titleText }]
      : defaultTitle(type)
        ? [{ type: 'text', value: defaultTitle(type) }]
        : [],
    children: content
  }
}

export function remarkGithubAlerts() {
  return (tree: Root) => {
    const walk = (nodes: any[]): void => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (!node || typeof node !== 'object') continue
        if (node.type === 'blockquote') {
          const alert = tryAlert(node)
          if (alert) {
            nodes[i] = alert
            continue // alert 已是 vpContainer;其 children 递归走下方统一分支
          }
        }
        if (Array.isArray(node.children)) walk(node.children)
      }
    }
    walk(tree.children ?? [])
  }
}
