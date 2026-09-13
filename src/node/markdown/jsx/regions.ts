// 识别层:`作者 JSX / <script>` 区域的唯一规则表 + 注册入口。
//
// 职责边界(见 design/jsxRegions.md):
//   识别层只回答"这是哪一类区域、从哪里到哪里结束";
//   原文交给谁(SFC / JSX store)由交接层(./handoff)按 `sink` 分派;
//   怎么输出(占位符)也只由交接层的 renderer 规则决定。
//
// 顺序约束只有三个锚点:`before('text')`(行内)、`before('html_block')`
// (块级)、`before('paragraph')`(整块不进 <p>)。没有 core 阶段规则。

import type { RuleBlock } from 'markdown-it/lib/parser_block.mjs'
import type { RuleInline } from 'markdown-it/lib/parser_inline.mjs'
import type Token from 'markdown-it/lib/token.mjs'
import type { MarkdownItAsync } from 'markdown-it-async'

import type { MarkdownEnv } from '../../shared'
import { collectRegion } from './handoff'
import { scanElementSequence, scanFragment, hasDynamicPart } from './scan'
import { SCRIPT_CLOSE_RE, SCRIPT_OPEN_RE } from './scriptTags'

export type RegionKind = 'script' | 'element' | 'fragment' | 'raw'
export type RegionPlacement = 'inline' | 'block'

/** 识别层产出:token.content = 区域原文;这里的 meta 描述区域本身 */
export interface RegionMeta {
  region: RegionKind
  placement: RegionPlacement
  /** 1-based 行号(块级规则填 startLine + 1;行内为 0) */
  line: number
  start: number
  end: number
  /** 交接层写入:原文在 env.jsxStore 中的下标 */
  jsxIndex?: number
}

/** 结束判定策略(识别层只做"到哪里结束",不做内容加工) */
export type EndStrategy =
  | {
      kind: 'regex'
      re: RegExp
      /** 未命中时的行为:fail = 交回 md;consume = 吃到块尾(容器) */
      unclosed: 'fail' | 'consume'
      /** 区域原文是否包含起止标记行(script 含;容器不含) */
      includeDelimiters: boolean
    }
  | { kind: 'element' }
  | { kind: 'fragment' }

export interface RegionRule {
  id: string
  region: RegionKind
  placement: RegionPlacement
  /** 行首(block)/当前位置(inline)起始判定 */
  start: RegExp
  end: EndStrategy
  /** 注册锚点:before(anchor) */
  anchor: string
  /** 闸门:不满足则交回 md 语法(如片段内部无动态部分) */
  gate?: (raw: string) => boolean
  /** 标签级排除(script/style 由别的模块负责) */
  excludeTag?: (name: string) => boolean
  option: keyof RegionOptions
  /** 交接目标 */
  sink: 'jsx' | 'sfc'
  /** 是否可作为段落终止符(容器与现状一致:不打断段落) */
  terminatesParagraph?: boolean
}

export interface RegionOptions {
  /** `<script>` 区域(默认 on) */
  script?: boolean
  /** 作者标签(element:HTML 标签 / 组件标签)(默认 on) */
  authorTags?: boolean
  /** 片段(`<>…</>`)(默认 on) */
  fragment?: boolean
  /** `::: react` 原始容器(默认 on) */
  container?: boolean
}

/** script/style 由 A 区域(script)与 plugin-sfc(style)负责,不按元素接管 */
const NON_JSX_TAGS = new Set(['script', 'style'])
const isNonJsxTag = (name: string): boolean =>
  NON_JSX_TAGS.has(name.toLowerCase())

/** 片段闸门:内部含 `{…}` 表达式或真正的标签才算作者 JSX */
const hasDynamicInterior = (raw: string): boolean =>
  hasDynamicPart(raw, 2, raw.length - 3)

/**
 * 全部识别规则。一行 = 一类区域;`sink` 说明原文交给谁。
 * 新增区域(例如将来的 `<style>` 接管)只需加一行。
 */
export const REGION_RULES: RegionRule[] = [
  {
    id: 'vp_script_block',
    region: 'script',
    placement: 'block',
    start: SCRIPT_OPEN_RE,
    end: {
      kind: 'regex',
      re: SCRIPT_CLOSE_RE,
      unclosed: 'fail',
      includeDelimiters: true
    },
    anchor: 'html_block',
    option: 'script',
    sink: 'sfc'
  },
  {
    id: 'vp_element_block',
    region: 'element',
    placement: 'block',
    start: /^<[A-Za-z]/,
    end: { kind: 'element' },
    anchor: 'html_block',
    excludeTag: isNonJsxTag,
    option: 'authorTags',
    sink: 'jsx'
  },
  {
    id: 'vp_element_inline',
    region: 'element',
    placement: 'inline',
    start: /^</,
    end: { kind: 'element' },
    anchor: 'text',
    excludeTag: isNonJsxTag,
    option: 'authorTags',
    sink: 'jsx'
  },
  {
    id: 'vp_fragment_block',
    region: 'fragment',
    placement: 'block',
    start: /^<>/,
    end: { kind: 'fragment' },
    anchor: 'paragraph',
    gate: hasDynamicInterior,
    option: 'fragment',
    sink: 'jsx'
  },
  {
    id: 'vp_fragment_inline',
    region: 'fragment',
    placement: 'inline',
    start: /^<>/,
    end: { kind: 'fragment' },
    anchor: 'text',
    gate: hasDynamicInterior,
    option: 'fragment',
    sink: 'jsx'
  },
  {
    id: 'vp_raw_block',
    region: 'raw',
    placement: 'block',
    start: /^:::+ *react\s*$/,
    end: {
      kind: 'regex',
      re: /^ {0,3}:::[ \t]*$/,
      unclosed: 'consume',
      includeDelimiters: false
    },
    anchor: 'paragraph',
    option: 'container',
    sink: 'jsx'
  }
]

// ------------------------------------------------------------
// 注册
// ------------------------------------------------------------

export function registerRegionRules(
  md: MarkdownItAsync,
  options: Required<RegionOptions>
): void {
  for (const rule of REGION_RULES) {
    if (!options[rule.option]) continue
    if (rule.placement === 'block') {
      md.block.ruler.before(rule.anchor, rule.id, createBlockHandler(rule))
    } else {
      md.inline.ruler.before(rule.anchor, rule.id, createInlineHandler(rule))
    }
  }
}

// ------------------------------------------------------------
// 块级处理器
// ------------------------------------------------------------

interface BlockState {
  src: string
  bMarks: number[]
  eMarks: number[]
  tShift: number[]
  lineMax: number
  line: number
  env: MarkdownEnv
  push: (type: string, tag: string, nesting: number) => Token
}

const lineAt = (state: BlockState, line: number): string =>
  state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])

interface BlockResolution {
  raw: string
  lastLine: number
}

function createBlockHandler(rule: RegionRule): RuleBlock {
  return (state, startLine, _endLine, silent) => {
    const s = state as unknown as BlockState
    const first = lineAt(s, startLine)
    if (!rule.start.test(first)) return false

    // 与现状一致:`::: react` 不打断段落
    if (rule.terminatesParagraph === false && silent) return false

    const resolved = resolveBlockEnd(rule, s, startLine, first)
    if (!resolved) return false
    const { raw, lastLine } = resolved
    if (rule.gate && !rule.gate(raw)) return false
    if (silent) return true

    const token = s.push(
      rule.region === 'script' ? 'vp_script' : 'vp_jsx_block',
      '',
      0
    )
    token.content = raw
    token.map = [startLine, lastLine + 1]
    token.meta = {
      region: rule.region,
      placement: 'block',
      line: startLine + 1,
      start: s.bMarks[startLine] + s.tShift[startLine],
      end: s.eMarks[lastLine]
    } satisfies RegionMeta
    collectRegion(s.env, token, token.meta as RegionMeta, rule)
    s.line = lastLine + 1
    return true
  }
}

function resolveBlockEnd(
  rule: RegionRule,
  state: BlockState,
  startLine: number,
  first: string
): BlockResolution | null {
  switch (rule.end.kind) {
    case 'regex': {
      const { re, unclosed, includeDelimiters } = rule.end
      const lines: string[] = includeDelimiters ? [first] : []
      let closeLine = -1
      for (let l = startLine + 1; l < state.lineMax; l++) {
        const text = lineAt(state, l)
        if (re.test(text)) {
          closeLine = l
          break
        }
        lines.push(text)
      }
      if (closeLine === -1) {
        if (unclosed === 'fail') return null
        // consume:未闭合时吃到块尾(与现状一致)
        return {
          raw: lines.join('\n'),
          lastLine: state.lineMax - 1
        }
      }
      if (includeDelimiters) lines.push(lineAt(state, closeLine))
      return { raw: lines.join('\n'), lastLine: closeLine }
    }

    case 'element': {
      const lines = [first]
      let cur = startLine
      let hit = wholeLineElement(rule, first)
      if (!hit) {
        for (let l = startLine + 1; l < state.lineMax; l++) {
          lines.push(lineAt(state, l))
          cur = l
          hit = wholeLineElement(rule, lines.join('\n'))
          if (hit) break
        }
      }
      if (!hit) return null
      return { raw: hit.raw, lastLine: cur }
    }

    case 'fragment': {
      // 独立成行(顶格)的多行片段;单行片段由行内规则处理
      if (state.tShift[startLine] !== 0) return null
      const lines = [first]
      let cur = startLine
      let done = false
      for (let l = startLine + 1; l < state.lineMax; l++) {
        const text = lineAt(state, l)
        lines.push(text)
        cur = l
        if (text.trim() !== '') {
          const joined = lines.join('\n')
          if (scanFragment(joined, 0, joined.length) === joined.length) {
            done = true
            break
          }
        }
      }
      if (!done) return null
      return { raw: lines.join('\n'), lastLine: cur }
    }
  }
}

/** 整行只允许元素序列(元素之后只允许空白),否则该行交给行内规则 */
function wholeLineElement(
  rule: RegionRule,
  joined: string
): { raw: string; end: number } | null {
  const seq = scanElementSequence(
    joined,
    0,
    joined.length,
    rule.excludeTag
  )
  if (!seq) return null
  return joined.slice(seq.end).trim() === '' ? seq : null
}

// ------------------------------------------------------------
// 行内处理器
// ------------------------------------------------------------
//
// 约定(见 design/jsxRegions.md §3.4):**silent 与正常模式都要推进
// state.pos**,只把 push 包在 !silent 里 —— 否则 md.inline.skipToken
// (link/image 扫描链接标签用)会抛 "inline rule didn't increment state.pos"。

interface InlineState {
  src: string
  pos: number
  posMax: number
  env: MarkdownEnv
  push: (type: string, tag: string, nesting: number) => Token
}

function createInlineHandler(rule: RegionRule): RuleInline {
  return (state, silent) => {
    const s = state as unknown as InlineState
    const { src, pos } = s
    if (!rule.start.test(src.slice(pos, pos + 2))) return false

    let raw: string
    let end: number
    if (rule.end.kind === 'fragment') {
      end = scanFragment(src, pos, s.posMax)
      if (end < 0) return false
      raw = src.slice(pos, end)
    } else {
      const next = src[pos + 1]
      if (next === '>' || next === '/' || next === '!') return false
      const hit = scanElementSequence(src, pos, s.posMax, rule.excludeTag)
      if (!hit) return false
      raw = hit.raw
      end = hit.end
    }

    if (rule.gate && !rule.gate(raw)) return false

    s.pos = end
    if (silent) return true

    const token = s.push('vp_jsx_inline', '', 0)
    token.content = raw
    token.meta = {
      region: rule.region,
      placement: 'inline',
      line: 0,
      start: pos,
      end
    } satisfies RegionMeta
    collectRegion(s.env, token, token.meta as RegionMeta, rule)
    return true
  }
}
