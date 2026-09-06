// mdx-kernel 核心:把文档 Markdown 编译为可渲染 React 模块并采集 PageData。
// 生态件:@mdx-js/mdx + remark-attributes(转义语法 \{…\}) + remark-gfm
//       + remark-math/rehype-katex + remark-frontmatter/remark-mdx-frontmatter
//       + rehype-slug(标题 id)。
// 自研件:PageData 采集(PageData.headers 层级、title 推断) —— 见 collect.ts。
// 目标产物形态(供 vite/页面组装层使用):
//   code     : @mdx-js/mdx compile 出的 ESM(默认导出 MDXContent 组件 + export const frontmatter)
//   frontmatter : YAML frontmatter 对象(供 PageData/主题;与 export const frontmatter 同源)
//   headers  : 大纲层级 [{ depth, value, slug, children }](PageData.headers 契约)
//   title    : frontmatter.title ?? 首个 h1 纯文本

import { compile } from '@mdx-js/mdx'
import remarkAttributes from 'remark-attributes'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import { collectFrontmatterPlugin, collectHeadersPlugin } from './collect'
import { remarkContainers, normalizeContainerSpacing } from './containers'
import type { MdxPageData } from './types'

export type { MdxPageData, MdxHeader } from './types'

export interface MdxCompileOptions {
  /** attrs 分隔符转义由作者手写 \{…\};remark-attributes 始终 { mdx: true } */
  remarkAttributes?: false
  /** 是否启用 remark-gfm 表格/删除线等(默认 true) */
  gfm?: boolean
  /** 是否启用数学 remark-math + rehype-katex(默认 true) */
  math?: boolean
  /** 是否启用 rehype-slug 给标题生成 id(默认 true;显式 \{#id\} 已在 remark 阶段注入) */
  slug?: boolean
  /** 容器缺省标题覆盖/新增(见 DEFAULT_CONTAINER_TITLES) */
  containerTitles?: Record<string, string>
  /** 容器降级警告回调(缺省 console.warn) */
  warn?: (message: string) => void
}

export interface MdxCompileResult {
  /** @mdx-js/mdx 产物(ESM 字符串:MDXContent + export const frontmatter) */
  code: string
  /** PageData 契约(frontmatter/headers/title) */
  data: MdxPageData
}

/**
 * 编译单个文档源字符串。
 * 说明:attrs 需作者转义(\{#id\}),裸 {#id} 会被 MDX 当表达式报错;
 * fence/行内码里的 {…} 由 markdown 解析天然保护,不经表达式。
 */
export async function compileDocument(
  src: string,
  options: MdxCompileOptions = {}
): Promise<MdxCompileResult> {
  const {
    gfm = true,
    math = true,
    slug = true,
    containerTitles,
    warn,
    remarkAttributes: _attrs = true // 预留开关;v1 恒启用
  } = options

  // 容器开/闭行上下文规整(行级,fence 感知;mdx 编译前)
  src = normalizeContainerSpacing(src)

  const remarkPlugins: unknown[] = [
    // 容器化先于 attrs:容器行(::: …)不落入 remark-attributes 的节点属性处理。
    // 注意:以 [plugin, options] 元组传入,由 compile 实例化。
    [remarkContainers, { titles: containerTitles, warn }],
    remarkAttributes,
    remarkFrontmatter,
    // yaml 节点先采集(collectFrontmatter),再由 remark-mdx-frontmatter 转为 export const frontmatter
    collectFrontmatterPlugin,
    remarkMdxFrontmatter
  ]
  if (gfm) remarkPlugins.push(remarkGfm)
  if (math) remarkPlugins.push(remarkMath)

  const rehypePlugins: unknown[] = []
  if (math) rehypePlugins.push(rehypeKatex)
  if (slug) rehypePlugins.push(rehypeSlug)
  // headers 采集是 rehype 插件(hast 上跑),须排在 rehype-slug 之后(id 已生成)
  rehypePlugins.push(collectHeadersPlugin)

  // remark-attributes 通过 `this.data()` 注册 micromark 扩展,必须按实例 use;
  // compile 的 remarkPlugins 数组项支持 [plugin, options] 元组。
  const remarkPluginList: any[] = remarkPlugins.map((p) =>
    // remark-attributes 需要 { mdx: true }
    Array.isArray(p) ? p : p === remarkAttributes ? [remarkAttributes, { mdx: true }] : p
  )

  const result = await compile(src, {
    format: 'mdx',
    remarkPlugins: remarkPluginList,
    rehypePlugins: rehypePlugins as any,
    remarkRehypeOptions: {
      handlers: { vpContainer: renderVpContainer }
    }
  })

  // 采集插件把数据写入 file.data.mdxKernel
  const fileData = (result.data as any).mdxKernel ?? {}
  const frontmatter = fileData.frontmatter ?? {}
  let title = frontmatter.title
  if (typeof title !== 'string') {
    title = fileData.title ?? ''
  }

  const headers = fileData.headers ?? []

  return {
    code: String(result),
    data: { frontmatter, headers, title }
  }
}

// ---------- vpContainer 渲染(mdast-util-to-hast handler) ----------

/**
 * vpContainer → hast:
 *  - details: <details [open]><summary>标题</summary>内容…</details>
 *  - 其余:   <div class="name custom-block [extra]" [id]><p class="custom-block-title[-default]">标题</p>内容…</div>
 *  - no-title(raw/v-pre/标题为空且无缺省)时不输出标题 p。
 */
function renderVpContainer(state: any, node: any): any {
  const name = node.name as string
  const attrs = node.attrs ?? { classes: [], noTitle: false, open: false }
  const noTitle = Boolean(attrs.noTitle || name === 'raw' || name === 'v-pre')
  const content = state.all(node)

  const props: any = {}
  const classList = [name, 'custom-block', ...(attrs.classes ?? [])].filter(Boolean)
  if (classList.length > 0) props.class = classList.join(' ')
  if (attrs.id) props.id = attrs.id

  const titleNodes = (node.titleChildren ?? []) as any[]
  const titleHast = titleNodes.length > 0 ? state.all({ type: 'root', children: titleNodes }) : []

  if (name === 'details') {
    const detailsProps = { ...props }
    if (attrs.open) detailsProps.open = ''
    const summary = {
      type: 'element',
      tagName: 'summary',
      properties: {},
      children: titleHast
    }
    return {
      type: 'element',
      tagName: 'details',
      properties: detailsProps,
      children: [summary, ...content]
    }
  }

  const children: any[] = []
  if (!noTitle) {
    const titleClass =
      'custom-block-title' + (node.defaultTitle ? ' custom-block-title-default' : '')
    children.push({
      type: 'element',
      tagName: 'p',
      properties: { class: titleClass },
      children: titleHast
    })
  }
  children.push(...content)
  return { type: 'element', tagName: 'div', properties: props, children }
}
