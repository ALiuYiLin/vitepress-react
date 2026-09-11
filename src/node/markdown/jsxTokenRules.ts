// Token 级 JSX 区域规则(A/B/C)——按"哪些文本是
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
import { hasVueishAttr, scanElement, VOID_HTML_TAGS } from './jsxLexer'

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
// 从首行 '<>' 开始按原文行扫描(允许内部空行),直到某行行尾恰好是配平的
// '</>'——因此任意多行的 JSX children / 表达式(含注释、空行)都能整体
// 接管,基本覆盖 `::: react` 容器的使用场景;未配平到文末则整体回退,
// 交回 markdown(不吞后续段落)。
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
  for (let nl = startLine + 1; nl < state.lineMax; nl++) {
    const p = state.bMarks[nl] + state.tShift[nl]
    const text = state.src.slice(p, state.eMarks[nl])
    lines.push(text)
    cur = nl
    // 空行本身不可能闭合,但允许出现在 fragment 内部(如表达式间的空行)
    if (text.trim() !== '') {
      const joined = lines.join('\n')
      const end = fragmentEnd(joined, 0)
      if (end > 0 && end === joined.length) {
        done = true
        break
      }
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
// D:作者手写元素(HTML 标签 / 组件标签 / <></>)—— 作者元素识别的唯一入口
// 语义契约:正文里作者写的标签就是 **JSX 元素**,一律原样交给 React(属性按
// React JSX 语法写;写 `class` / `style="…"` 属作者写法错误,由 React 侧规则
// 报错/告警)。只有 md 层自己生成的 HTML(attrs {.class}、锚点、容器、Shiki…)
// 才在序列化时做属性转换——那些 HTML 不经过本规则,由 HTML→JSX 序列化器处理。
//
// 之所以需要本规则:markdown-it 的 inline HTML 语法不接受"未加引号且含空格的
// 属性值"(如 `onClick={() => …}`),这类作者标签根本不会被 token 化,靠 token
// 形态判定(旧的"纯 HTML 段落/HTML 块")接管不到,最终退化成字面文本(并丢掉
// 闭合标签)。这里用自带的括号感知扫描器切出整段元素,不再依赖 md-it 的 HTML 语法。
//
// 块级入口注册在 html_block 之前(与 vp_script 同级),这样块级标签(div/table…)
// 的作者写法也统一走"原始 JSX",而不是被 md-it 的 html_block 抢走后按 HTML 语义
// 转换;md-it 自己产出的 html_block(HTML 注释、插件改写的源码等)则原样流向
// 序列化器,由它做属性转换。
// ------------------------------------------------------------

/** script/style 不接管:分别由 vp_script 规则与 SFC/样式管线处理 */
const NON_JSX_TAGS = new Set(['script', 'style'])

/**
 * 从 pos 处切出"作者元素序列":一个或多个元素,元素之间与末尾只允许空白。
 * 返回原文与结束位置;不是元素序列(Vue 写法、涉及 script/style、不配平)返回 null。
 */
function authorElementsAt(
  src: string,
  pos: number
): { raw: string; end: number } | null {
  let i = pos
  let end = pos
  let count = 0
  while (i < src.length) {
    while (i < src.length && /[ \t\r\n]/.test(src[i])) i++
    if (src[i] !== '<') break
    const next = src[i + 1]
    if (next === '/' || next === '!' || next === '>') break
    const el = scanElement(src, i)
    if (!el) {
      // 已经开始读元素但配平失败 → 整个序列作废
      return count > 0 ? null : null
    }
    if (NON_JSX_TAGS.has(el.name.toLowerCase())) return null
    i = el.end
    end = el.end
    count++
  }
  if (count === 0) return null
  const raw = src.slice(pos, end)
  if (hasVueishAttr(raw)) return null // Vue 指令/插值:交回旧 HTML 路径(丢弃并提示)
  return { raw, end }
}

/** D-行内:句子里出现的作者元素(<span>…</span> / <Foo … /> / 相邻多个) */
function elementRule(state: any, silent: boolean): boolean {
  const src = state.src
  if (src.charCodeAt(state.pos) !== 60 /* < */) return false
  const next = src[state.pos + 1]
  if (next === '>' || next === '/' || next === '!') return false
  const hit = authorElementsAt(src, state.pos)
  if (!hit) return false
  if (silent) return true
  const token = state.push('vp_jsx', '', 0)
  token.content = hit.raw
  token.map = state.env?.map ?? null
  state.pos = hit.end
  return true
}

/** D-块级:整行(可跨行到配平)的作者元素序列,整段占位以免被包进 <p> */
function elementBlockRule(
  state: any,
  startLine: number,
  _endLine: number,
  silent: boolean
): boolean {
  // 不限制 tShift:缩进代码由更早的 code 规则消费,这里需要覆盖列表项/引用内的
  // 作者元素(否则块级标签会被行内规则接管并包进 <p>,产生非法嵌套)
  const sp = state.bMarks[startLine] + state.tShift[startLine]
  const first = state.src.slice(sp, state.eMarks[startLine])
  if (!/^<[A-Za-z]/.test(first)) return false

  const lines: string[] = [first]
  let cur = startLine
  let hit: { raw: string; end: number } | null = null
  const wholeLine = (joined: string) => {
    const seq = authorElementsAt(joined, 0)
    if (!seq) return null
    // 元素之后只允许空白(否则这一行是"文字 + 元素",交给行内规则)
    return joined.slice(seq.end).trim() === '' ? seq : null
  }
  hit = wholeLine(first)
  if (!hit) {
    for (let nl = startLine + 1; nl < state.lineMax; nl++) {
      const p = state.bMarks[nl] + state.tShift[nl]
      lines.push(state.src.slice(p, state.eMarks[nl]))
      cur = nl
      hit = wholeLine(lines.join('\n'))
      if (hit) break
    }
  }
  if (!hit) return false
  if (silent) return true
  const env: any = state.env
  const placeholder = markRaw(env, hit.raw, startLine + 1)
  const token = state.push('vp_jsx_block', '', 0)
  token.content = placeholder
  state.line = cur + 1
  return true
}

// ------------------------------------------------------------
// C:core 末段落占位(只做两件事:vp_jsx → 占位符、标题内的 Fragment 按字面)
// 接管判定已全部收敛到 D(作者元素)与 HTML→JSX 序列化器(md 层产出的 HTML,
// 例如 md-it 的 html_block:HTML 注释、插件改写源码注入的标记)。这里不再
// 依据 token 形态去"猜"作者意图,避免与 D 形成两处实现。
// ------------------------------------------------------------
function collectRule(state: any): void {
  const env: any = state.env
  const store = ensureStore(env)
  const tokens = state.tokens

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type !== 'paragraph_open' || tokens[i + 1]?.type !== 'inline')
      continue

    // 行内:vp_jsx(Fragment / 作者元素)→ marker;标题里的 Fragment 不接管,按字面文本
    const parentIsHeading = i > 0 && tokens[i - 1]?.type === 'heading_open'
    convertFragmentChildren(tokens[i + 1].children, store, parentIsHeading)
  }
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

/** 注册 A/B/C/D 全部规则(在 createMarkdownRenderer 内、用户 config 之后调用) */
export function applyJsxTokenRules(
  md: any,
  options: { authorTags?: boolean } = {}
): void {
  md.inline.ruler.before('text', 'vp_jsx_fragment', fragmentRule)
  // D:作者元素(<Tag …>…</Tag> / <Foo … />)在行内与块级两个入口接管。
  // markdown.component === false 时不启用(与 @mdit-vue/plugin-component 的
  // 关闭语义一致:标签保持字面 HTML,不交给 React)。
  if (options.authorTags !== false) {
    md.inline.ruler.before('text', 'vp_jsx_element', elementRule)
    // 注册在 html_block 之前:块级标签(div/table…)的作者写法也走"原始 JSX",
    // 不被 md-it 的 html_block 抢走;md-it 自己产出的 html_block(HTML 注释、
    // 插件改写源码注入的标记)照旧流向序列化器做属性转换。
    md.block.ruler.before('html_block', 'vp_element_block', elementBlockRule)
  }
  md.block.ruler.before('html_block', 'vp_script', scriptRule)
  md.block.ruler.before('paragraph', 'vp_react_container', reactContainerRule)
  md.block.ruler.before('paragraph', 'vp_fragment_block', fragmentBlockRule)
  md.core.ruler.push('vp_jsx_collect', collectRule)

  md.renderer.rules.vp_jsx_block = (tokens: any[], idx: number) =>
    tokens[idx].content
  md.renderer.rules.vp_script = () => ''
}
