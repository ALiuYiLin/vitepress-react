// Snippet 自研件,两种写作形态:
//   (1) 旧式整行指令 `<<< @/path/to/file{2}[标题]`(字符层展开,与 md-it 版
//       对齐;mdx 编译时 micromark 的 mdx-jsx 会把行首 `<` 当 JSX 起始而报
//       语法错,故该形态仅作兼容保留);
//   (2) `<Snippet src="@/path" … />` 标签式(推荐;mdx-jsx 语法合法,remark
//       树层展开,见文件尾 remarkCodeSnippet)。
// 共同语义(parseSnippetPath):
//   path[#region][{lines [lang] [attrs]}][ [title]]
//  - '@/' 前缀相对 srcDir 解析;否则相对当前文件目录
//  - region 取折叠标记区段;lines 是行高亮说明(仅进 fence info 供高亮层)
//  - fence 围栏长度自动加长,内容里更长的 ``` 行不会提前闭合
// 展开在 compileDocument 内先于容器规整与 mdx 编译执行;依赖文件被记录。

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { dedent, findRegions, stripRegionMarkers } from './regions'

export interface SnippetOptions {
  /** 文档根目录('@/' 解析基准);缺省时 '@/' 无法解析会报错 */
  srcDir?: string
  /** 当前文档文件绝对路径(相对路径解析基准) */
  filePath?: string
  /** 文件缺失/region 缺失时:警告并输出空代码而非抛错(默认 false 抛错) */
  silent?: boolean
  warn?: (message: string) => void
}

export interface ExpandResult {
  src: string
  /** 读取到的依赖文件绝对路径(供 watch) */
  dependencies: string[]
}

const titleRE = /\s*\[(.+)\]$/
const regionRE = /#([\w.-]+)$/
const separatorRE = /[\\/]/
const extensionRE = /\.([a-zA-Z0-9]+)$/
const linesRE = /^\d+(?:[,-]\d+)*$/
const snippetLineRE = /^ {0,3}<<< /
const fenceOpenRE = /^ {0,3}(`{3,}|~{3,})/

/**
 * 解析 snippet 指令的原始路径(移植自 md-it 版 parseSnippetPath):
 * `path[#region][{[lines] [lang] [attrs...]}][ [title]]`
 * 后缀从右往左剥离,故路径本身可含空格与点。
 */
export function parseSnippetPath(rawPath: string) {
  let rest = rawPath.trim()

  let title = ''
  const titleMatch = titleRE.exec(rest)
  if (titleMatch) {
    title = titleMatch[1]
    rest = rest.slice(0, titleMatch.index).trimEnd()
  }

  let lines = ''
  let lang = ''
  let attrs = ''
  const braceStart = rest.lastIndexOf('{')
  if (rest.endsWith('}') && braceStart > 0) {
    const parsed = parseSnippetMeta(rest.slice(braceStart + 1, -1).trim())
    lines = parsed.lines
    lang = parsed.lang
    attrs = parsed.attrs
    rest = rest.slice(0, braceStart).trimEnd()
  }

  let region = ''
  const regionMatch = regionRE.exec(rest)
  if (regionMatch) {
    region = regionMatch[1]
    rest = rest.slice(0, regionMatch.index)
  }

  const filepath = rest.trim()
  const filename = filepath.split(separatorRE).pop() ?? ''
  const extension = extensionRE.exec(filename)?.[1] ?? ''

  return {
    filepath,
    extension,
    region,
    lines,
    lang,
    attrs,
    title: title || filename
  }
}

function parseSnippetMeta(meta: string) {
  let lines = ''
  let lang = ''
  let attrs = ''
  if (!meta) return { lines, lang, attrs }

  // tolerate whitespace in a lines-only meta, e.g. `{1, 2}`
  if (/^[\d\s,-]+$/.test(meta)) {
    const collapsed = meta.replace(/\s+/g, '')
    if (linesRE.test(collapsed)) return { lines: collapsed, lang, attrs }
  }

  const first = /^\S+/.exec(meta)![0]
  if (linesRE.test(first)) {
    lines = first
    meta = meta.slice(first.length).trimStart()
  }

  const langMatch = /^\S+/.exec(meta)
  if (langMatch) {
    lang = langMatch[0]
    attrs = meta.slice(langMatch[0].length).trim()
  }

  return { lines, lang, attrs }
}

function resolvePath(
  filepath: string,
  opts: SnippetOptions,
  file: string | undefined
): string | null {
  if (filepath.startsWith('@')) {
    if (!opts.srcDir) return null
    const cut = separatorRE.test(filepath[1]) ? 2 : 1
    return path.join(opts.srcDir, filepath.slice(cut))
  }
  const base = opts.filePath ?? file
  if (!base) return null
  return path.resolve(path.dirname(base), filepath)
}

/** 读取 snippet 文件并应用 region/去标记/去缩进;失败(经 fail 处理)返回 null */
async function loadSnippetContent(
  resolved: string,
  region: string,
  fail: (message: string) => string | null
): Promise<string | null> {
  let content: string
  try {
    content = await readFile(resolved, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return fail(`Code snippet path not found: ${resolved}`)
    if (code === 'EISDIR')
      return fail(`Code snippet path is a directory: ${resolved}`)
    throw error
  }

  let lines = content.split('\n')
  let matchedMarkers: unknown[] | undefined

  if (region) {
    const regions = findRegions(lines, region)
    if (regions.length === 0) {
      return fail(`Code snippet region "${region}" not found in ${resolved}`)
    }
    lines = regions.flatMap((r) => lines.slice(r.start, r.end))
    matchedMarkers = [...new Set(regions.map((r) => r.marker))]
  }

  if (matchedMarkers) lines = stripRegionMarkers(lines)
  if (region) lines = dedent(lines)

  return lines.join('\n')
}

/** 最长连续反引号运行长度(用于 fence 围栏加长) */
function longestBacktickRun(content: string): number {
  let max = 0
  let run = 0
  for (const ch of content) {
    if (ch === '`') {
      run += 1
      if (run > max) max = run
    } else {
      run = 0
    }
  }
  return max
}

/**
 * 展开 `<<< …` 行为代码 fence;原文本行其余内容不动。
 * fence 内的 `<<<`(代码示例)不受影响。
 */
export async function expandSnippets(
  src: string,
  options: SnippetOptions = {}
): Promise<ExpandResult> {
  const dependencies: string[] = []
  const warn =
    options.warn ??
    ((m: string) => console.warn('[mdx-kernel/snippet] ' + m))
  const fail = (message: string): string | null => {
    if (!options.silent) throw new Error(message)
    warn(message)
    return null
  }

  const lines = src.split('\n')
  const out: string[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]

    if (!inFence && fenceOpenRE.test(raw)) {
      inFence = true
      out.push(raw)
      continue
    }
    if (inFence) {
      out.push(raw)
      if (fenceOpenRE.test(raw)) inFence = false
      continue
    }

    if (!snippetLineRE.test(raw)) {
      out.push(raw)
      continue
    }

    // 解析指令(剥掉行首 '<<<')
    const directive = raw.replace(/^ {0,3}<<< /, '').trim()
    const parsed = parseSnippetPath(directive)
    const resolved = resolvePath(parsed.filepath, options, options.filePath)
    if (!resolved) {
      out.push(raw)
      fail(
        `Code snippet path "${parsed.filepath}" cannot be resolved ` +
          '(needs srcDir for @/ paths, or filePath for relative paths)'
      )
      continue
    }
    dependencies.push(resolved)
    const content = await loadSnippetContent(resolved, parsed.region, fail)
    // 失败(fail 返回 null):silent 时删除整行;非 silent 已抛错
    if (content === null) continue
    if (content === '' && !options.silent) continue

    const info = [
      parsed.lang || parsed.extension,
      parsed.lines ? `{${parsed.lines}}` : '',
      parsed.attrs,
      parsed.title ? `[${parsed.title}]` : ''
    ]
      .filter(Boolean)
      .join(' ')
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(content) + 1))
    out.push(fence + info)
    if (content) out.push(...content.split('\n'))
    out.push(fence)
  }

  return { src: out.join('\n'), dependencies }
}

// ---- <Snippet src="…" /> 标签式写作形态 ----------------------------------
// mdx 正文里 `<<< @/path` 行会被 micromark 的 mdx-jsx 扩展当 JSX 起始而报
// 语法错(VS Code MDX 等静态检查同样误报),因此 snippet 的写作形态改为
// **组件标签**:`<Snippet src="@/snippets/x.js" lines="2,4-6" lang="js" title="标题" />`。
// 它在 mdx-jsx 语法里完全合法(不再误报),由本插件在 remark 阶段识别并替换
// 成 code 节点——只是“长得像组件”,不注入任何 import/运行时组件(编译产物
// 里没有 Snippet)。路径/region/加载/高亮 meta 语义与 `<<<` 完全一致:
//   - src(必填):同 `<<<` 路径,支持 `@/`(srcDir)与相对路径(filePath 基准)、
//     `path#region`(折叠区段);值可用字符串字面量或简单 {expr}(字符串/数字);
//   - lines:行高亮说明(仅进 fence meta,如 `{2,4-6}`);
//   - lang:语言(缺省取文件扩展名);attrs:额外 fence attrs(如 `:line-numbers`);
//   - title:代码块标题(缺省显示文件名)。
// `<<<` 字符层展开仍保留(兼容旧文档与 md-it 对齐路径)。
interface RemarkCodeSnippetOptions extends SnippetOptions {
  /** 收集读取到的依赖文件绝对路径(供 watch 失效) */
  deps: string[]
}

/** 取 mdxJsx 属性值:字符串字面量或简单 {expr}(字符串/数字字面量) */
function snippetAttr(
  attributes: any[] | undefined,
  name: string
): string | undefined {
  const attr = (attributes ?? []).find(
    (a: any) => a?.type === 'mdxJsxAttribute' && a.name === name
  )
  if (!attr) return undefined
  if (typeof attr.value === 'string') return attr.value
  if (attr.value?.type === 'mdxJsxAttributeValueExpression') {
    const raw = String(attr.value.value ?? '').trim()
    const quoted = /^(['"])([\s\S]*)\1$/.exec(raw)
    if (quoted) return quoted[2]
    if (/^(?:0|[1-9]\d*)$/.test(raw)) return raw
  }
  return undefined
}

/**
 * remark 插件:把正文里的 `<Snippet src="…" />`(mdxJsxFlowElement)展开为
 * code 节点。异步读文件;依赖写入 options.deps。silent 时缺失文件删除节点
 * 并告警,否则抛错。
 */
export function remarkCodeSnippet(
  options: RemarkCodeSnippetOptions
): (tree: any) => Promise<void> {
  const { srcDir, filePath, silent, warn, deps } = options
  const fail = (message: string): string | null => {
    if (!silent) {
      const error = new Error(message)
      ;(error as { includes?: string[] }).includes = [...deps]
      throw error
    }
    ;(warn ?? ((m: string) => console.warn('[mdx-kernel/snippet] ' + m)))(
      message
    )
    return null
  }

  const expandNode = async (node: any): Promise<any | null> => {
    const src = snippetAttr(node.attributes, 'src')
    if (!src) return fail('<Snippet> requires a string "src" attribute')
    const region = snippetAttr(node.attributes, 'region') ?? ''
    const lines = snippetAttr(node.attributes, 'lines') ?? ''
    const lang = snippetAttr(node.attributes, 'lang') ?? ''
    const attrs = snippetAttr(node.attributes, 'attrs') ?? ''
    const title = snippetAttr(node.attributes, 'title')

    // 组回旧 directive 形态,复用 parseSnippetPath 的剥离/校验语义
    let directive = src
    if (region) directive += '#' + region
    const metaInner = [lines, lang, attrs].filter(Boolean).join(' ')
    if (metaInner) directive += '{' + metaInner + '}'
    if (title) directive += ' [' + title + ']'
    const parsed = parseSnippetPath(directive)

    const resolved = resolvePath(parsed.filepath, { srcDir, filePath }, filePath)
    if (!resolved) {
      return fail(
        `Code snippet path "${parsed.filepath}" cannot be resolved ` +
          '(needs srcDir for @/ paths, or filePath for relative paths)'
      )
    }
    deps.push(resolved)
    const content = await loadSnippetContent(resolved, parsed.region, fail)
    if (content === null) return null
    if (content === '' && !silent) return null

    const metaParts = []
    if (parsed.lines) metaParts.push(`{${parsed.lines}}`)
    if (parsed.attrs) metaParts.push(parsed.attrs)
    if (parsed.title) metaParts.push(`[${parsed.title}]`)
    return {
      type: 'code',
      lang: parsed.lang || parsed.extension || null,
      meta: metaParts.length ? metaParts.join(' ') : null,
      value: content
    }
  }

  const process = async (nodes: any[]): Promise<any[]> => {
    const out: any[] = []
    for (const child of nodes) {
      if (child?.type === 'mdxJsxFlowElement' && child.name === 'Snippet') {
        const expanded = await expandNode(child)
        if (expanded) out.push(expanded)
        continue
      }
      if (child?.children && Array.isArray(child.children)) {
        child.children = await process(child.children)
      }
      out.push(child)
    }
    return out
  }

  return async (tree: any) => {
    tree.children = await process(tree.children ?? [])
  }
}
