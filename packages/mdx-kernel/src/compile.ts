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
import remarkGemoji from 'remark-gemoji'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import { remarkGithubAlerts } from './alerts'
import { collectFrontmatterPlugin, collectHeadersPlugin } from './collect'
import { remarkContainers, normalizeContainerSpacing } from './containers'
import {
  rehypeCodeHighlight,
  type CodeHighlighter,
  type CodeHighlightRuntime
} from './highlight'
import { expandIncludes } from './includes'
import { expandSnippets, remarkCodeSnippet } from './snippets'
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
  /** 文档根目录:include/snippet 的 '@/' 前缀解析基准 */
  srcDir?: string
  /** 当前文档文件绝对路径:include/snippet 的相对路径解析基准 */
  filePath?: string
  /** include/snippet 缺失时:警告并替换为空而非抛错(默认 false 抛错) */
  silent?: boolean
  /** 告警回调(容器降级、include/snippet 缺失等;缺省 console.warn) */
  warn?: (message: string) => void
  /**
   * 代码块语法高亮(可选):传 createCodeHighlighter 的实例 + 运行时选项;
   * 缺省不高亮。启用后代码块输出与 md-it(M1)同构的
   * `div.language-*` 包装(shiki token 着色/copy/lang 标签/行号/行高亮 meta)。
   */
  highlight?: {
    highlighter: CodeHighlighter
    runtime?: CodeHighlightRuntime
  } | null
  /**
   * host scoped css(markdownScopedCss)的 scope 属性名,如 `data-v-6b26034f`。
   * mdx 产物是 jsx() 调用形态(estree),vite-plugin-jsx-scoped 的 babel 只给
   * 语法 JSX 元素注入 scope 属性——因此由本层在 hast 末尾给所有元素补该
   * 属性(md-it/md 页同款语义:页面 DOM 全部带 data-v-{hash})。hash 须与
   * css 侧同源(宿主用 computeScopeAttr 对页面路径生成),否则选择器不命中。
   */
  scopeAttr?: string
}

export interface MdxCompileResult {
  /** @mdx-js/mdx 产物(ESM 字符串:MDXContent + export const frontmatter) */
  code: string
  /** PageData 契约(frontmatter/headers/title) */
  data: MdxPageData
  /** include/snippet 读取的依赖文件绝对路径(供 watch 失效) */
  dependencies: string[]
}

/**
 * 编译单个文档源字符串。
 * 说明:attrs 需作者转义(\{#id\}),裸 {#id} 会被 MDX 当表达式报错;
 * fence/行内码里的 {…} 由 markdown 解析天然保护,不经表达式。
 * 管线:include 展开(文本) → snippet 展开(文本→fence) → 容器行规整
 *      → @mdx-js/mdx 编译(容器化+attrs+frontmatter+gfm/math+headers)。
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
    srcDir,
    filePath,
    silent,
    warn,
    remarkAttributes: _attrs = true // 预留开关;v1 恒启用
  } = options

  const dependencies: string[] = []

  // 1) include 展开(字符层、递归);2) snippet 展开(字符层、fence 感知)
  if (srcDir || filePath) {
    try {
      const includeRes = await expandIncludes(src, { srcDir, filePath, silent, warn })
      src = includeRes.src
      dependencies.push(...includeRes.dependencies)
      const snippetRes = await expandSnippets(src, { srcDir, filePath, silent, warn })
      src = snippetRes.src
      dependencies.push(...snippetRes.dependencies)
    } catch (e) {
      // 把已收集的依赖挂到错误上:调用方(watch 失效)据此恢复页面
      ;(e as { includes?: string[] }).includes = dependencies
      throw e
    }
  }

  // 3) 容器开/闭行上下文规整(行级,fence 感知;mdx 编译前)
  src = normalizeContainerSpacing(src)

  const remarkPlugins: unknown[] = [
    // 容器化先于 attrs:容器行(::: …)不落入 remark-attributes 的节点属性处理。
    // 注意:以 [plugin, options] 元组传入,由 compile 实例化。
    [remarkContainers, { titles: containerTitles, warn }],
    remarkAttributes,
    // github-flavored alerts:blockquote 首行 > [!NOTE];在容器/attrs 之后跑
    remarkGithubAlerts,
    remarkFrontmatter,
    // yaml 节点先采集(collectFrontmatter),再由 remark-mdx-frontmatter 转为 export const frontmatter
    collectFrontmatterPlugin,
    remarkMdxFrontmatter
  ]
  if (gfm) remarkPlugins.push(remarkGfm)
  if (math) remarkPlugins.push(remarkMath)
  // emoji(:tada: → 🎉):放最后(只处理正文 text,不动容器/attrs 结构)
  remarkPlugins.push(remarkGemoji)

  // <Snippet src="…" /> 标签式 snippet(remark 树层展开为 code 节点)。
  // 依赖收集:插件把读到的文件绝对路径推入 jsxSnippetDeps,compile 后并入。
  const jsxSnippetDeps: string[] = []
  remarkPlugins.push([
    remarkCodeSnippet,
    { srcDir, filePath, silent, warn, deps: jsxSnippetDeps }
  ])

  const rehypePlugins: unknown[] = []
  if (math) rehypePlugins.push(rehypeKatex)
  if (slug) rehypePlugins.push(rehypeSlug)
  // headers 采集是 rehype 插件(hast 上跑),须排在 rehype-slug 之后(id 已生成)
  rehypePlugins.push(collectHeadersPlugin)
  // 代码高亮在最后跑(把占位 pre 替换成高亮结构,不改动其它节点)
  const highlight = options.highlight
  if (highlight?.highlighter) {
    rehypePlugins.push([
      rehypeCodeHighlight,
      {
        highlighter: highlight.highlighter,
        runtime: highlight.runtime ?? {}
      }
    ])
  }
  // scope 属性注入须在高亮之后(给最终元素补 data-v-*,含高亮 wrapper/行 token)
  if (options.scopeAttr) {
    rehypePlugins.push([rehypeAddScopeAttr, { attr: options.scopeAttr }])
  }

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
      // vpContainer 是自研 mdast 节点,不在 mdast-util-to-hast 白名单里;
      // 启用高亮时用占位 code handler 保留 lang/meta(默认 handler 会丢弃)
      handlers: {
        vpContainer: (state: any, node: any) =>
          renderVpContainer(state, node, {
            codeGroup: Boolean(highlight?.highlighter)
          }),
        ...(highlight?.highlighter ? { code: renderCodePlaceholder } : {})
      } as Record<string, unknown>
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
  dependencies.push(...jsxSnippetDeps)

  return {
    code: String(result),
    data: { frontmatter, headers, title },
    dependencies
  }
}

// ---------- vpContainer 渲染(mdast-util-to-hast handler) ----------

/**
 * scope 属性注入(rehype 阶段末尾):给所有元素补 scopeAttr(如 data-v-{hash})。
 * 跳过 <style>(md 页 jsx-scoped 同款:style 标签不加);值用空串字符串,
 * mdx 产物序列化为 `attr: ""`,React 渲染出 data-v-xxx=""(属性存在即可命中
 * css 的 [data-v-{hash}] 选择器)。
 */
function rehypeAddScopeAttr(options: { attr: string }) {
  return (tree: any) => {
    const walk = (nodes: any[]): void => {
      for (const node of nodes) {
        if (!node || node.type !== 'element') continue
        if (node.tagName !== 'style' && node.properties) {
          node.properties[options.attr] = ''
        }
        if (Array.isArray(node.children)) walk(node.children)
      }
    }
    walk(tree.children ?? [])
  }
}

/**
 * 代码块占位 handler(仅高亮启用时):把 mdast code 的 lang/meta 暂存到
 * data-* 属性,内容按原文保留;随后的 rehypeCodeHighlight 会整块替换。
 */
function renderCodePlaceholder(_state: any, node: any): any {
  const props: Record<string, string> = {}
  if (node.lang) props['data-lang'] = String(node.lang)
  if (node.meta) props['data-meta'] = String(node.meta)
  return {
    type: 'element',
    tagName: 'pre',
    properties: { ...props, dir: 'ltr' },
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [{ type: 'text', value: node.value ?? '' }]
      }
    ]
  }
}

/**
 * vpContainer → hast:
 *  - details: <details [open]><summary>标题</summary>内容…</details>
 *  - 其余:   <div class="name custom-block [extra]" [id]><p class="custom-block-title[-default]">标题</p>内容…</div>
 *  - no-title(raw/v-pre/标题为空且无缺省)时不输出标题 p。
 */
function renderVpContainer(
  state: any,
  node: any,
  ctx: { codeGroup?: boolean } = {}
): any {
  const name = node.name as string

  // code-group 专有语义:与 md-it(M1)同构的 tabs/blocks 结构
  //   div.vp-code-group > div.tabs(input[type=radio]+label) + div.blocks(代码块们)
  // radio 组由主题 css 的 :has 规则驱动对应块显示;首个子块标 data-cg-active,
  // 高亮插件把它落到 div.language-*.active(不支持 :has 时的初始显示兜底)。
  if (name === 'code-group' && ctx.codeGroup) {
    return renderCodeGroup(state, node)
  }

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
    if (attrs.open) detailsProps.open = true
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

/** 页内 code-group 序列号(radio name 组内唯一;跨编译单调递增无碍) */
let codeGroupSeq = 0

/**
 * code-group 渲染:内容按块输出在 .blocks;tabs 里的 radio/label 由
 * mdast 直接子 code 节点的 lang / meta([title]) 生成(顺序与块一一对应)。
 */
function renderCodeGroup(state: any, node: any): any {
  const seq = ++codeGroupSeq
  const content = state.all(node) // mdast children 1:1 的 hast
  const mdChildren = (node.children ?? []) as any[]
  const tabItems: any[] = []
  let checked = true
  let codeIndex = 0

  for (let i = 0; i < mdChildren.length; i++) {
    const ch = mdChildren[i]
    if (!ch || ch.type !== 'code') continue
    const lang = String(ch.lang ?? '').toLowerCase()
    const meta = String(ch.meta ?? '').trim()
    const titleMatch = meta.match(/\[(.*?)\]/)
    const title = titleMatch ? titleMatch[1] : lang || 'code'
    const id = `vp-cg-${seq}-${codeIndex}`
    tabItems.push(
      {
        type: 'element',
        tagName: 'input',
        properties: {
          type: 'radio',
          name: `vp-cg-${seq}`,
          id,
          // defaultChecked(非受控):React 只在挂载时置初始选中,之后用户
          // 点击 label 改 DOM checked 不会被 React 重渲染弹回(受控 checked
          // 在页面任何重渲染时都会把 radio 状态重置回第一个 tab)
          ...(checked ? { defaultChecked: true } : {})
        },
        children: []
      },
      {
        type: 'element',
        tagName: 'label',
        properties: {
          htmlFor: id,
          'data-title': title
        },
        children: [{ type: 'text', value: title }]
      }
    )
    // 首块标记 active(高亮插件消费);块与 content[i] 一一对应
    const hast = content[i]
    if (checked && hast && hast.properties) {
      hast.properties['data-cg-active'] = ''
    }
    checked = false
    codeIndex++
  }

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['vp-code-group'] },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['tabs'] },
        children: tabItems
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['blocks'] },
        children: content
      }
    ]
  }
}
