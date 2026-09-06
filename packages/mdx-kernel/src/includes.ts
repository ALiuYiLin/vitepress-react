// Include(`<!-- @include: … -->`)自研件(字符层、递归展开,行为对齐 md-it 版
// include 插件的基础子集):
//   `<!-- @include: path -->`、`<!-- @include: path{from,to} -->`(行范围,
//   下标 1 起,空端开放)、`<!-- @include: path#region -->`(折叠标记区段)
//  - '@/' 前缀相对 srcDir;否则相对当前文件目录
//  - 递归展开,循环引用(沿祖先链重复)原样保留不展开
//  - 被包含文件的 frontmatter(文件头 --- … ---)剥离
// 未实现(md-it 版有,backlog):heading anchor 区间(#slug 引用标题段)、
//   rebaseRelativeUrls(被包含 md 的相对图片/链接按被包含文件位置重写)
// 展开在 compileDocument 内先于容器规整与 mdx 编译执行;依赖被记录。

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { dedent, findRegions, stripRegionMarkers } from './regions'
import type { ExpandResult } from './snippets'

export interface IncludeOptions {
  /** 文档根目录('@/' 解析基准) */
  srcDir?: string
  /** 当前文档文件绝对路径(相对路径解析基准) */
  filePath?: string
  /** 文件/区段缺失时:警告并替换为空而非抛错(默认 false 抛错) */
  silent?: boolean
  warn?: (message: string) => void
}

const includeRE = /<!--\s*@include:\s*(.*?)\s*-->/g
const rangeRE = /\{(\d*),(\d*)\}$/
const regionRE = /#([^\s{]+)$/
const separatorRE = /[\\/]/
const fenceOpenRE = /^ {0,3}(`{3,}|~{3,})/

function resolvePath(
  filepath: string,
  opts: IncludeOptions,
  currentFile: string | undefined
): string | null {
  if (filepath.startsWith('@')) {
    if (!opts.srcDir) return null
    const cut = separatorRE.test(filepath[1]) ? 2 : 1
    return path.join(opts.srcDir, filepath.slice(cut))
  }
  if (!currentFile) return null
  return path.join(path.dirname(currentFile), filepath)
}

/** 剥离文件头 frontmatter(--- … ---) */
function stripFrontmatter(content: string): string {
  const lines = content.split('\n')
  if (lines[0]?.trim() !== '---') return content
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n')
    }
  }
  return content
}

interface Ctx {
  options: IncludeOptions
  warn: (message: string) => void
  fail: (message: string) => string
  dependencies: string[]
}

/**
 * 递归展开 include 指令。命中失败时:silent → 警告并替换为空;否则抛错。
 * 返回展开后的完整文本与依赖列表。
 */
export async function expandIncludes(
  src: string,
  options: IncludeOptions = {}
): Promise<ExpandResult> {
  const dependencies: string[] = []
  const warn =
    options.warn ?? ((m: string) => console.warn('[mdx-kernel/include] ' + m))
  const fail = (message: string): string => {
    if (!options.silent) throw new Error(message)
    warn(message)
    return ''
  }
  const ctx: Ctx = { options, warn, fail, dependencies }
  const expanded = await expandText(src, options.filePath, [], ctx)
  return { src: expanded, dependencies }
}

/** 展开单文件内容(fence 感知逐行;include 指令必须独占整行) */
async function expandText(
  src: string,
  file: string | undefined,
  ancestors: string[],
  ctx: Ctx
): Promise<string> {
  const { options, fail, dependencies } = ctx
  const lines = src.split('\n')
  const out: string[] = []
  let inFence = false

  for (const raw of lines) {
    if (!inFence && fenceOpenRE.test(raw.trim())) {
      inFence = true
      out.push(raw)
      continue
    }
    if (inFence) {
      out.push(raw)
      if (fenceOpenRE.test(raw.trim())) inFence = false
      continue
    }

    includeRE.lastIndex = 0
    const m = includeRE.exec(raw)
    if (!m) {
      out.push(raw)
      continue
    }
    const directive = (m[1] ?? '').trim()
    // 非整行指令(行内还有其它文本):只把注释子串归一为 MDX 注释,其余文本保留
    if (raw.trim().replace(includeRE, '').trim() !== '') {
      out.push(raw.replace(includeRE, (_s, d: string) => `{/* @include: ${d.trim()} */}`))
      continue
    }
    // 整行但无目标:删除(HTML 注释在 MDX 非法,空指令无意义)
    if (!directive) continue

    let target = directive
    let range: string[] | null = null
    let region = ''

    const rm = rangeRE.exec(target)
    if (rm) {
      range = [rm[1], rm[2]]
      target = target.slice(0, rm.index).trimEnd()
    }
    const gm = regionRE.exec(target)
    if (gm) {
      region = gm[1]
      target = target.slice(0, gm.index).trimEnd()
    }

    const includePath = resolvePath(target, options, file)
    if (!includePath) {
      out.push(fail(`@include path "${target}" cannot be resolved (in ${file})`))
      continue
    }

    // 沿祖先链重复 = 循环引用,按字面保留(HTML 注释在 MDX 中非法,
    // 归一为等价且不渲染的 {/**/} 注释,注释原文保留在产物中)
    if (includePath === file || ancestors.includes(includePath)) {
      out.push(`{/* @include: ${directive} */}`)
      continue
    }

    dependencies.push(includePath)

    let content: string
    try {
      content = await readFile(includePath, 'utf8')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        out.push(fail(`Included markdown file not found: ${includePath} (in ${file})`))
      } else if (code === 'EISDIR') {
        out.push(fail(`Included markdown path is a directory: ${includePath} (in ${file})`))
      } else {
        throw error
      }
      continue
    }

    content = stripFrontmatter(content)
    let pieceLines = content.split('\n')

    if (region) {
      const regions = findRegions(pieceLines, region)
      if (regions.length === 0) {
        out.push(fail(`@include region "${region}" not found in ${includePath} (in ${file})`))
        continue
      }
      pieceLines = regions.flatMap((r) => pieceLines.slice(r.start, r.end))
      pieceLines = stripRegionMarkers(pieceLines)
      pieceLines = dedent(pieceLines)
    } else if (range) {
      // {from,to} 下标 1 起;空端表示开放(1 起 / 到末尾)
      const from = range[0] === '' ? 1 : Number(range[0])
      const to = range[1] === '' ? pieceLines.length : Number(range[1])
      if (from > to || from < 1) {
        out.push(fail(`@include range {${range[0]},${range[1]}} out of bounds in ${includePath}`))
        continue
      }
      pieceLines = pieceLines.slice(from - 1, to)
    }

    // 递归展开被包含文件(其内相对路径以被包含文件为基准)
    const nested = await expandText(
      pieceLines.join('\n'),
      includePath,
      [...ancestors, ...(file ? [file] : [])],
      ctx
    )
    out.push(nested)
  }

  return out.join('\n')
}
