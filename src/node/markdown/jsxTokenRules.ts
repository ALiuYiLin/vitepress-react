// Token 级 JSX 区域规则(A/B/C)——按 MD-TOKEN-TAKEOVER.md 把"哪些文本是
// React 接管区"的识别下沉到 markdown-it 内部,替代 markdownToReact.ts 的
// 字符串预扫 Pass(maskScriptBlocks / maskJsxHtmlLines)。
//
// 三个执行点(顺序约束见决策文档 §8 P1 实证):
//   A. <script> 块捕获 —— block.ruler.before('html_block'):不依赖 html_block
//      type-7(块内任意 </(script|pre|style|textarea)> 即截断),自扫到
//      </script> 整块入 env.sfcBlocks(type 同 @mdit-vue/plugin-sfc);
//   B. <>{…}</> Fragment —— inline.ruler.before('text'):最早、整段 opaque
//      捕获为 vp_jsx token(内部 md 语法不被拆),core 末段再转 marker;
//   C. 接管判定 —— core.ruler.push(anchor 之后):html_block / 纯 HTML 段落
//      整体接管 → vp_jsx_block 占位(序列化还原);::: react 显式容器由
//      块规则在 paragraph 前直接占位。
// 产物(marker + env store)与占位契约(placeholders.ts)保持一致,下游
// serializeHtmlToJsx / buildReactPageModule 不变。
//
// 占位语义:接管区原文 push env.jsxStore,正文 html 里只留
// @@VP_HTML_n@@(行内)或 <div data-vp-jsx="n"></div>(块级)。

import {
  htmlToken,
  jsxBlockPlaceholder,
  SCRIPT_SETUP_TAG_OPEN_RE,
  type PlaceholderStore
} from './placeholders'
import { hasVueishAttr, tagDepth, VOID_HTML_TAGS } from './jsxLexer'

/** <script setup> 开标签判定(与 @mdit-vue/plugin-sfc 一致:setup 命中即 scriptSetup) */
const SCRIPT_OPEN_RE = /^ {0,3}<script\b(?![^>]*\bclient\b)[^>]*>/i
const SCRIPT_CLOSE_RE = /<\/script>\s*$/

// ------------------------------------------------------------
// 通用小工具
// ------------------------------------------------------------

function ensureStore(env: any): PlaceholderStore {
  if (!env.jsxStore) env.jsxStore = []
  return env.jsxStore
}

/** 开标签名(小写);非标签/空名返回 '' */
function tagNameOf(raw: string): string {
  const m = /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(raw.trim())
  return m ? m[1].toLowerCase() : ''
}

/**
 * 从 src 中位置 i('<' 处,紧随 '>' 即 Fragment 开标签)开始找配平的 '</>'
 * 结束位置(不含)。引号/注释跳过;内嵌真实标签与其闭合按深度抵消,
 * 自闭合/void 标签不加深。找不到返回 -1。
 */
function fragmentEnd(src: string, i: number): number {
  let depth = 1
  let pos = i + 2
  let inQuote: string | null = null
  while (pos < src.length) {
    const c = src[pos]
    if (inQuote) {
      if (c === '\\') pos += 2
      else {
        if (c === inQuote) inQuote = null
        pos++
      }
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inQuote = c
      pos++
      continue
    }
    if (c === '<' && src.startsWith('<!--', pos)) {
      const end = src.indexOf('-->', pos)
      if (end === -1) return -1
      pos = end + 3
      continue
    }
    if (c === '<' && src[pos + 1] === '>') {
      depth++
      pos += 2
      continue
    }
    if (c === '<' && src[pos + 1] === '/') {
      depth--
      pos += 2
      while (pos < src.length && src[pos] !== '>') pos++
      pos++
      if (depth === 0) return pos
      continue
    }
    if (c === '<' && /[A-Za-z]/.test(src[pos + 1] ?? '')) {
      let j = pos + 1
      while (j < src.length && /[A-Za-z0-9-]/.test(src[j])) j++
      const name = src.slice(pos + 1, j).toLowerCase()
      let inQ: string | null = null
      let end = j
      for (; end < src.length; end++) {
        const ch = src[end]
        if (inQ) {
          if (ch === inQ) inQ = null
          continue
        }
        if (ch === '"' || ch === "'") {
          inQ = ch
          continue
        }
        if (ch === '>') break
      }
      const isSelfClose = src.slice(j, end + 1).endsWith('/>')
      if (!isSelfClose && !VOID_HTML_TAGS.has(name)) depth++
      pos = Math.min(end + 1, src.length)
      continue
    }
    pos++
  }
  return -1
}

/**
 * Fragment 是否"值得接管":内部含 '{'(JSX 表达式)或 '<'(内嵌标签/组件)
 * 才算作者显式 JSX;纯文字 '<>…</>' 交回 markdown(字面转义),避免正文
 * 把 <>…</> 当普通字面写时被误当 JSX(见决策文档 §7 边角③)。
 */
function hasJsxInterior(raw: string): boolean {
  const inner = raw.slice(2, -3) // 剥掉 <> 与 </>
  if (inner.length === 0) return false
  if (inner.includes('<')) return true
  // 跳过注释与字符串近似后看是否含 { —— 简单起见直接找,字符串内的
  // 字面 { 属罕见作者场景,可接受
  return inner.includes('{')
}

/** 判断整段 raw 是否可整体接管(与旧 maskJsxHtmlLines 的门槛对齐) */
function canTakeoverRaw(raw: string): boolean {
  const text = raw.trim()
  // 注释/关闭标签起头 → 机器 HTML 路径(序列化器正确处理注释)
  if (!text || text.startsWith('</') || text.startsWith('<!--')) return false
  const name = tagNameOf(text)
  if (name === 'script' || name === 'style') return false
  if (hasVueishAttr(text)) return false
  if (tagDepth(text) !== 0) return false
  return true
}

/** 把原文写入 store,返回带行号注释的原始文本 */
function markRaw(env: any, raw: string, lineNo?: number): string {
  const store = ensureStore(env)
  const n = store.length
  const marked = lineNo != null ? `{/* JSX md:${lineNo} */}\n${raw}` : raw
  store.push({ html: marked })
  return jsxBlockPlaceholder(n)
}

// ------------------------------------------------------------
// B:Fragment(inline 最前,整段 opaque)
// ------------------------------------------------------------
function fragmentRule(state: any, silent: boolean): boolean {
  const src = state.src
  if (src.charCodeAt(state.pos) !== 60 /* < */ || src[state.pos + 1] !== '>') {
    return false
  }
  const end = fragmentEnd(src, state.pos)
  if (end === -1) return false
  const raw = src.slice(state.pos, end)
  if (!hasJsxInterior(raw)) return false
  if (silent) return true
  const token = state.push('vp_jsx', '', 0)
  token.content = raw
  token.map = state.env?.map ?? null
  state.pos = end
  return true
}

// ------------------------------------------------------------
// A:<script> 块捕获(块规则,不依赖 html_block type-7)
// ------------------------------------------------------------
function scriptRule(
  state: any,
  startLine: number,
  _endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine]
  const first = state.src.slice(startPos, state.eMarks[startLine])
  if (!SCRIPT_OPEN_RE.test(first)) return false
  if (silent) return false

  const lines: string[] = [first]
  let closeLine = -1
  for (let l = startLine + 1; l < state.lineMax; l++) {
    const pos = state.bMarks[l] + state.tShift[l]
    const text = state.src.slice(pos, state.eMarks[l])
    lines.push(text)
    if (SCRIPT_CLOSE_RE.test(text)) {
      closeLine = l
      break
    }
  }
  if (closeLine === -1) return false // 未闭合:交回 markdown-it(与旧行为一致)

  const rawFull = lines.join('\n')
  const tagOpen = first.trim()
  const tagClose = lines[lines.length - 1].trim()
  const contentStripped = lines.slice(1, -1).join('\n')
  const env: any = state.env
  env.sfcBlocks ??= {
    template: null,
    script: null,
    scriptSetup: null,
    scripts: [],
    styles: [],
    customBlocks: []
  }
  const block = {
    type: 'script',
    content: rawFull,
    contentStripped,
    tagOpen,
    tagClose
  }
  env.sfcBlocks.scripts.push(block)
  if (SCRIPT_SETUP_TAG_OPEN_RE.test(tagOpen)) env.sfcBlocks.scriptSetup = block
  else env.sfcBlocks.script = block

  state.line = closeLine + 1
  return true
}

// ------------------------------------------------------------
// `::: react` 显式容器(块规则,原文整体占位,不参与 md 解析)
// ------------------------------------------------------------
function reactContainerRule(
  state: any,
  startLine: number,
  _endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine]
  const first = state.src.slice(startPos, state.eMarks[startLine]).trim()
  if (!/^:::+ *react\s*$/.test(first)) return false
  if (silent) return false

  const raw: string[] = []
  let closeLine = -1
  for (let l = startLine + 1; l < state.lineMax; l++) {
    const pos = state.bMarks[l] + state.tShift[l]
    const text = state.src.slice(pos, state.eMarks[l])
    if (/^ {0,3}:::[ \t]*$/.test(text)) {
      closeLine = l
      break
    }
    raw.push(text)
  }
  const env: any = state.env
  const content = raw.length === 0 ? '' : raw.join('\n')
  const placeholder = markRaw(env, content, startLine + 1)
  const token = state.push('vp_jsx_block', '', 0)
  token.content = placeholder
  state.line = closeLine === -1 ? state.lineMax : closeLine + 1
  return true
}

// ------------------------------------------------------------
// B-块:独立成行的多行 <>…</> 遮蔽(块级,先于 paragraph 整段占用)
// 多行 Fragment 内容里若含会"打断段落"的行(如独立 <p> 开标签 → html_block
// 拆分),inline 规则看不到完整区域,必须先按行整段收集再占位。
// ------------------------------------------------------------
function fragmentBlockRule(
  state: any,
  startLine: number,
  _endLine: number,
  silent: boolean
): boolean {
  if (state.tShift[startLine] !== 0) return false // 缩进(缩进代码)不碰
  const sp = state.bMarks[startLine] + state.tShift[startLine]
  const first = state.src.slice(sp, state.eMarks[startLine])
  if (!first.startsWith('<>')) return false

  const lines: string[] = [first]
  let cur = startLine
  let done = false
  while (!done) {
    const nl = cur + 1
    if (nl >= state.lineMax) break
    const p = state.bMarks[nl] + state.tShift[nl]
    const text = state.src.slice(p, state.eMarks[nl])
    if (text.trim() === '') break // Fragment 不跨空行(与旧扫描一致)
    lines.push(text)
    cur = nl
    const joined = lines.join('\n')
    const end = fragmentEnd(joined, 0)
    if (end > 0 && end === joined.length) {
      done = true
      break
    }
  }
  if (!done) return false
  const raw = lines.join('\n')
  if (!hasJsxInterior(raw)) return false
  if (silent) return true
  const env: any = state.env
  const placeholder = markRaw(env, raw, startLine + 1)
  const token = state.push('vp_jsx_block', '', 0)
  token.content = placeholder
  state.line = cur + 1
  return true
}

// ------------------------------------------------------------
// C:core 末段接管判定(html_block / 纯 HTML 段落 / fragment 落 marker)
// ------------------------------------------------------------
function collectRule(state: any): void {
  const env: any = state.env
  const store = ensureStore(env)
  const tokens = state.tokens

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    // 块级:html_block 整体接管(style/script 与 Vue 特征行除外,交回旧路径)
    if (t.type === 'html_block') {
      const raw = t.content.trim()
      if (raw && canTakeoverRaw(raw) && raw.includes('>')) {
        t.type = 'vp_jsx_block'
        t.content = markRaw(
          env,
          raw,
          t.map?.[0] != null ? t.map[0] + 1 : undefined
        )
      }
      continue
    }

    // 段落:children 仅由 HTML 片段/<> Fragment/标签内文本组成 → 整体接管
    const isInlineFollow =
      t.type === 'paragraph_open' && tokens[i + 1]?.type === 'inline'
    if (!isInlineFollow) continue
    const inline = tokens[i + 1]
    if (isParagraphHtmlOnly(inline.children)) {
      const raw = inline.content.trim()
      if (raw && canTakeoverRaw(raw)) {
        const placeholder = markRaw(
          env,
          raw,
          inline.map?.[0] != null ? inline.map[0] + 1 : undefined
        )
        const block = new state.Token('vp_jsx_block', '', 0)
        block.content = placeholder
        block.map = inline.map
        tokens.splice(i, 3, block)
        continue
      }
    }

    // 行内:vp_jsx(Fragment)→ marker;标题里的 Fragment 不接管,按字面文本
    const parentIsHeading = i > 0 && tokens[i - 1]?.type === 'heading_open'
    convertFragmentChildren(inline.children, store, parentIsHeading)
  }
}

/** 段落 children 是否"纯 HTML":文字只允许出现在标签内部(深度>0) */
function isParagraphHtmlOnly(children: any[] | null): boolean {
  if (!children || children.length === 0) return false
  let depth = 0
  let sawTag = false
  for (const c of children) {
    switch (c.type) {
      case 'html_inline': {
        sawTag = true
        const raw = c.content
        if (raw.startsWith('</')) depth--
        else if (!/\/>$/.test(raw.trim())) depth++
        continue
      }
      case 'vp_jsx':
        sawTag = true
        continue
      case 'text': {
        if (!/^\s*$/.test(c.content)) {
          if (depth <= 0) return false // 标签外的纯文本 → 交回 md
        }
        continue
      }
      case 'softbreak':
      case 'hardbreak':
        continue
      default:
        // 强调/链接/行内码/math 等 md 语法产物 → 段落不属于"纯 HTML"
        return false
    }
  }
  return sawTag && depth === 0
}

/** 把 inline children 里的 vp_jsx 落为 marker;标题场景则按字面文本 */
function convertFragmentChildren(
  children: any[] | null,
  store: PlaceholderStore,
  literalInHeading: boolean
): void {
  if (!children) return
  for (const c of children) {
    if (c.type !== 'vp_jsx') continue
    if (literalInHeading) {
      // 标题不支持 <>{expr}</> 动态(V2 §7.1):当字面文本输出
      c.type = 'text'
      continue
    }
    const n = store.length
    store.push({ html: c.content })
    c.type = 'text'
    c.content = htmlToken(n)
  }
}

/** 注册 A/B/C 全部规则(在 createMarkdownRenderer 内、用户 config 之后调用) */
export function applyJsxTokenRules(md: any): void {
  md.inline.ruler.before('text', 'vp_jsx_fragment', fragmentRule)
  md.block.ruler.before('html_block', 'vp_script', scriptRule)
  md.block.ruler.before('paragraph', 'vp_react_container', reactContainerRule)
  md.block.ruler.before('paragraph', 'vp_fragment_block', fragmentBlockRule)
  md.core.ruler.push('vp_jsx_collect', collectRule)

  md.renderer.rules.vp_jsx_block = (tokens: any[], idx: number) =>
    tokens[idx].content
  md.renderer.rules.vp_script = () => ''
}
