// 容器自研件:保留 md-it 版(vitepress)作者语法 `::: type [标题] [attrs]`,在 MDX
// 内核下工作。分两层:
//  1) normalizeContainerSpacing:编译前,把容器开/闭行上下文规整出空行,
//     CommonMark 才能把「标题行/内容/闭行」解析成独立段落(fence 感知,代码块内不动);
//  2) remarkContainers:mdast 阶段,把容器段落组重组成 vpContainer 节点(栈式,支持嵌套),
//     标题解析为 inline mdast(titleChildren),行尾 attrs 支持 ((…))/{no-title};
//  渲染由 compileDocument 注入的 remarkRehype handlers.vpContainer 完成
//  (div.custom-block / details+summary,标题 p.custom-block-title[-default])。

import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { Root } from 'mdast'

/** 内置容器缺省标题(与 md-it 版 containerLabels 缺省一致) */
export const DEFAULT_CONTAINER_TITLES: Record<string, string> = {
  tip: 'TIP',
  info: 'INFO',
  warning: 'WARNING',
  danger: 'DANGER',
  note: 'NOTE',
  important: 'IMPORTANT',
  caution: 'CAUTION',
  details: 'Details'
}

const OPEN_RE = /^:::[ \t]*([a-zA-Z0-9_-]+)[ \t]*(.*)$/
const CLOSE_RE = /^:::[ \t]*$/

export function isOpenContainerLine(trimmed: string): boolean {
  return OPEN_RE.test(trimmed)
}
export function isCloseContainerLine(trimmed: string): boolean {
  return CLOSE_RE.test(trimmed)
}

/**
 * 行级规整(编译前):对容器开/闭行上下文补空行,使后续 CommonMark 解析
 * 把标题行、内容、闭行各自隔离成独立块;fence(``` … ```)内不处理。
 * 副作用:插入空行可能使部分错误行号偏移(行号映射 P4 处理)。
 */
export function normalizeContainerSpacing(src: string): string {
  const lines = src.split('\n')
  const out: string[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!inFence && /^```/.test(trimmed)) {
      inFence = true
      out.push(raw)
      continue
    }
    if (inFence) {
      out.push(raw)
      if (/^```/.test(trimmed)) inFence = false
      continue
    }

    const isOpen = isOpenContainerLine(trimmed)
    const isClose = isCloseContainerLine(trimmed)

    if (isOpen) {
      // {no-title} 是 remark-attributes 的大括号语法,会在 parse 层被消费成
      // attributes 节点干扰容器解析;这里在字符层归一为容器自解析的 ((no-title))。
      const normalizedRaw = raw.replace(/\{no-title\}\s*$/, '((no-title))')
      out.push(normalizedRaw)
      // 标题行与后续内容之间补空行
      const next = lines[i + 1]
      if (next !== undefined && next.trim() !== '' && !isCloseContainerLine(next.trim()) && out[out.length - 1] !== '') {
        out.push('')
      }
      continue
    }
    if (isClose) {
      // 闭行前补空行(内容与其分块)
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      out.push(raw)
      // 闭行后补空行:防止闭行与下一段内容合并(CommonMark 同段)
      const next = lines[i + 1]
      if (next !== undefined && next.trim() !== '' && !isCloseContainerLine(next.trim())) {
        out.push('')
      }
      continue
    }
    out.push(raw)
  }
  return out.join('\n')
}

interface VpContainerAttrs {
  id?: string
  classes: string[]
  noTitle: boolean
  open: boolean
}

const EMPTY_ATTRS: VpContainerAttrs = { classes: [], noTitle: false, open: false }

/** 解析纯文本标题行尾的 attrs:((…))(v1 主语法)或 {no-title}(兼容) */
export function parseContainerAttrs(text: string): { rest: string; attrs: VpContainerAttrs } {
  const attrs: VpContainerAttrs = { ...EMPTY_ATTRS }
  let rest = text
  const m = /^(.*?)[ \t]*(\{no-title\}|\(\(([^()]*)\)\))[ \t]*$/.exec(text)
  if (m) {
    rest = m[1]
    if (m[2] === '{no-title}') {
      attrs.noTitle = true
    } else {
      for (const token of (m[3] ?? '').trim().split(/\s+/)) {
        if (!token) continue
        if (token === 'no-title') attrs.noTitle = true
        else if (token === 'open') attrs.open = true
        else if (token.startsWith('#')) attrs.id = token.slice(1)
        else if (token.startsWith('.')) attrs.classes.push(token.slice(1))
      }
    }
  }
  return { rest, attrs }
}

interface Skeleton {
  name: string
  titleChildren: any[]
  attrs: VpContainerAttrs
  /** 原开行 paragraph(未闭合时按字面放回) */
  openNode?: any
  defaultTitle?: boolean
}

/** 从开行 paragraph 解析容器骨架;非开行返回 null */
function parseOpenParagraph(node: any): Skeleton | null {
  if (!node || node.type !== 'paragraph') return null
  const children = node.children ?? []
  if (children.length === 0) return null
  const first = children[0]
  if (!first || first.type !== 'text') return null
  const m = OPEN_RE.exec(first.value)
  if (!m) return null
  // 规整后开行为独立单行 paragraph;含换行说明未规整或非常规文本
  if (first.value.includes('\n')) return null

  const name = m[1]
  let attrs: VpContainerAttrs = { ...EMPTY_ATTRS }
  let titleChildren: any[]

  if (children.length === 1) {
    // 纯文本标题行:整行可做 attrs 解析
    const parsed = parseContainerAttrs(m[2] ?? '')
    attrs = parsed.attrs
    const titleText = parsed.rest
    titleChildren = titleText ? inlineMdast(titleText) : []
  } else {
    // 行内 md 标题(如 `::: details 示例 \`code\``)或行尾被 remark-attributes
    // 消费成 attributes 节点(如 {no-title}):前缀后全部 inline 节点作标题,
    // attributes 节点剔除;若整行只剩 attributes(标题为空)视为 no-title。
    const rest = m[2] ?? ''
    const tail = children.slice(1).filter((c: any) => {
      const t = c?.type ?? ''
      return t !== 'attributes' && !/attribute/i.test(t)
    })
    if (!rest.trim() && tail.length === 0 && children.length > 1) {
      attrs.noTitle = true
      titleChildren = []
    } else {
      titleChildren = []
      if (rest) titleChildren.push({ type: 'text', value: rest })
      titleChildren.push(...tail)
    }
  }
  return { name, titleChildren, attrs, openNode: node }
}

/** 用 remark-parse 把标题字符串解析为 inline mdast(单段) */
function inlineMdast(text: string): any[] {
  const root = unified().use(remarkParse).parse(text) as Root
  const para = root.children[0] as any
  return para?.children ?? []
}

/**
 * 栈式容器化:识别开行/闭行 paragraph,内容重组为 vpContainer 节点;
 * 支持嵌套。未闭合的容器按字面处理(内容放回,不吞块)。
 */
function containerize(nodes: any[]): any[] {
  const roots: any[] = []
  const stack: (Skeleton & { children: any[] })[] = []
  const addToCurrent = (n: any) => {
    if (stack.length > 0) stack[stack.length - 1].children.push(n)
    else roots.push(n)
  }

  for (const node of nodes) {
    const sk = parseOpenParagraph(node)
    if (sk) {
      stack.push({ ...sk, children: [] })
      continue
    }
    const isClose =
      node?.type === 'paragraph' &&
      node.children?.length === 1 &&
      node.children[0].type === 'text' &&
      node.children[0].value.trim() === ':::'
    if (isClose && stack.length > 0) {
      const done = stack.pop()!
      addToCurrent({
        type: 'vpContainer',
        name: done.name,
        attrs: done.attrs,
        titleChildren: done.titleChildren,
        children: done.children
      })
      continue
    }
    addToCurrent(node)
  }

  // 未闭合容器:开行按字面放回(在内容之前),不吞块。按栈序(外层在前)展开。
  const flush: any[] = []
  for (let k = 0; k < stack.length; k++) {
    const s = stack[k]
    if (s.openNode) flush.push(s.openNode)
    flush.push(...s.children)
  }
  roots.push(...flush)
  return roots
}

export interface RemarkContainersOptions {
  /** 覆盖/新增缺省标题;key=容器名 */
  titles?: Record<string, string>
  /** 收集警告(如 code-group 降级),缺省 console.warn */
  warn?: (message: string) => void
}

export function remarkContainers(options: RemarkContainersOptions = {}) {
  const titles = { ...DEFAULT_CONTAINER_TITLES, ...(options.titles ?? {}) }
  const warn =
    options.warn ?? ((m: string) => console.warn('[mdx-kernel/containers] ' + m))

  return (tree: Root) => {
    const containerizeDeep = (nodes: any[]): any[] => {
      const list = containerize(nodes)
      for (const node of list) {
        if (node?.type === 'vpContainer') {
          node.children = containerizeDeep(node.children ?? [])
          applyDefaults(node)
        } else if (Array.isArray(node.children)) {
          node.children = containerizeDeep(node.children)
        }
      }
      return list
    }

    const applyDefaults = (node: any) => {
      const name = node.name as string
      // code-group 的专有语义已由渲染层(compile.ts vpContainer handler +
      // rehype 高亮)实现(tabs/blocks 结构);react 等其它专有容器仍未实现
      if (name === 'react') {
        warn(
          `container "${name}" 的专有语义(react JSX 区域)尚未在 mdx-kernel 实现,已按普通容器渲染`
        )
      }
      if (node.attrs.noTitle || name === 'raw' || name === 'v-pre') {
        node.attrs.noTitle = true
      }
      if (!node.attrs.noTitle && (node.titleChildren ?? []).length === 0) {
        const def = titles[name]
        if (def) {
          node.titleChildren = [{ type: 'text', value: def }]
          node.defaultTitle = true
        } else {
          node.attrs.noTitle = true
        }
      }
    }

    tree.children = containerizeDeep(tree.children ?? [])
  }
}
