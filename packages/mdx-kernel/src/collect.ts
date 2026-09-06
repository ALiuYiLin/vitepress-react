// PageData 采集插件:
//  remark 阶段:读 YAML frontmatter(remark-frontmatter 产出的 yaml 节点)存 file.data
//  rehype 阶段:在 rehype-slug 之后遍历 h1-h6,采 slug(id)/纯文本 title,
//               组大纲树(level>=2,层级折叠);首个 h1 文本留作 title 候选
// 数据挂载:file.data.mdxKernel = { frontmatter, headers, title }

import { parse as parseYaml } from 'yaml'
import type { MdxHeader } from './types.js'

interface MdxKernelFileData {
  frontmatter?: Record<string, unknown>
  headers?: MdxHeader[]
  title?: string
}

function kernelData(file: any): MdxKernelFileData {
  const d = file.data as any
  d.mdxKernel ??= {}
  return d.mdxKernel
}

function walkMdast(node: any, onNode: (n: any) => void) {
  if (!node || typeof node !== 'object') return
  onNode(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkMdast(child, onNode)
  }
}

/** remark 插件:把 yaml 节点(remark-frontmatter 产出)解析到 file.data.mdxKernel.frontmatter */
export function collectFrontmatterPlugin(): (tree: any, file: any) => void {
  return (tree, file) => {
    const data = kernelData(file)
    data.frontmatter ??= {}
    walkMdast(tree, (node) => {
      if (node.type === 'yaml' && typeof node.value === 'string') {
        try {
          const parsed = parseYaml(node.value)
          if (parsed && typeof parsed === 'object') {
            data.frontmatter = parsed as Record<string, unknown>
          }
        } catch {
          // 解析失败留给调用方/上游报错,这里不吞静默——保留原始 value 供调试
          data.frontmatter = { __yamlError: String(node.value).slice(0, 400) }
        }
      }
    })
  }
}

function hastText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  if (node.type === 'element' || node.type === 'root') {
    return (node.children ?? []).map(hastText).join('')
  }
  return ''
}

/** rehype 插件(须排在 rehype-slug 之后):采 headers/slug/h1 title */
export function collectHeadersPlugin(): (tree: any, file: any) => void {
  return (tree, file) => {
    const data = kernelData(file)
    const flat: MdxHeader[] = []
    let h1Text: string | undefined

    // root 不是 element:先遍历 children,元素节点再按 tagName 采集
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'element') {
        const m = /^h([1-6])$/.exec(node.tagName ?? '')
        if (m) {
          const text = hastText(node).trim()
          const id =
            typeof node.properties?.id === 'string' ? node.properties.id : ''
          const level = Number(m[1])
          if (level === 1) {
            if (h1Text === undefined) h1Text = text
          } else {
            flat.push({ level, title: text, slug: id, children: [] })
          }
        }
      }
      for (const child of node.children ?? []) visit(child)
    }
    visit(tree)

    data.headers = buildTree(flat)
    if (h1Text) data.title = h1Text
  }
}

/** 层级折叠:与 @mdit-vue/plugin-headers 一致的嵌套规则 */
function buildTree(flat: MdxHeader[]): MdxHeader[] {
  const roots: MdxHeader[] = []
  const stack: MdxHeader[] = []
  for (const h of flat) {
    while (stack.length > 0 && h.level <= stack[stack.length - 1].level) {
      stack.pop()
    }
    if (stack.length > 0) {
      stack[stack.length - 1].children!.push(h)
    } else {
      roots.push(h)
    }
    stack.push(h)
  }
  return roots
}
