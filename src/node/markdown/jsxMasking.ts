// 正文掩码 Pass 与还原(自 markdownToReact.ts 拆分)。
//
// 这些 Pass 都在「markdown-it 渲染之前/之后」对源文本做词法级改写,产物
// 仍是合法文本(占位串不会进入 <p>、不污染 heading anchor 等):
//   - maskScriptBlocks → 渲染前:<script> 块(fence 感知)替换为 3 行占位;
//    渲染后 restoreMaskedScripts 把 plugin-sfc 提取的 contentStripped 还原;
//   - maskJsxHtmlLines → 渲染前:React 接管区(::: react / 整行标签 / 行内片段)
//    整段替换为 @@VP_HTML_n@@ 或 <div data-vp-jsx> 块级哨兵;
//   - maskJsxExpressions → 渲染前:正文 {expr} → @@VP_EXPR_n@@(React 语义,
//    与 Vue 的 {{ expr }} 对齐);
//   - restoreHeaderExpressions → 渲染后:把 env.headers 标题里的占位还原为
//    `{code}` / ''(大纲要纯文本)。
//
// 占位格式的写入/读取契约集中在 placeholders.ts;词法工具在 jsxLexer.ts。

import {
  computeMathRanges,
  findMatchingBrace,
  firstTagIndex,
  hasVueishAttr,
  tagDepth
} from './jsxLexer'
import {
  exprToken,
  htmlToken,
  jsxBlockPlaceholder,
  SCRIPT_BLOCK_KEY_RE,
  scriptBlockKey,
  VP_TOKEN_GLOBAL_RE,
  type PlaceholderStore
} from './placeholders'

// ============================================================
// <script> 块掩码(M1):markdown-it html_block(type 7)会被块内任意
// `</(script|pre|style|textarea)>` 提前截断(组件 JSX 常含 `</pre>` 等),
// 占位后交给 @mdit-vue/plugin-sfc 提取,渲染结束再还原原始内容。
// ============================================================

export interface MaskedScriptBlock {
  key: string
  inner: string
}

/**
 * fence 感知地把正文里的 <script> 块替换为占位(每块恒 3 行),规避
 * markdown-it html_block type 7 被块内任意 `</(script|pre|style|textarea)>`
 * 提前截断(组件 JSX 常含 `</pre>` 等)。<script client>(MPA 专属)不 mask,
 * 让它留在正文里按元素序列化。
 */
export function maskScriptBlocks(
  src: string,
  blocks: MaskedScriptBlock[]
): string {
  const lines = src.split('\n')
  const out: string[] = []
  let fenceChar: string | null = null
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // fenced code block 检测(CommonMark:最多 3 空格缩进 + ≥3 个 ` 或 ~)
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const ch = fence[1][0]
      if (fenceChar === null) {
        fenceChar = ch
      } else if (ch === fenceChar && /^\s{0,3}[`~]{3,}\s*$/.test(line)) {
        fenceChar = null
      }
      out.push(line)
      i++
      continue
    }
    if (fenceChar === null) {
      // fence 之外:行首 <script …>(排除 client)开始收块
      const open = /^<script\b(?![^>]*\bclient\b)[^>]*>/.exec(line)
      if (open) {
        const block: string[] = [line]
        let j = i + 1
        let closed = false
        while (j < lines.length) {
          block.push(lines[j])
          if (/<\/script>\s*$/.test(lines[j])) {
            closed = true
            break
          }
          j++
        }
        if (closed) {
          const key = scriptBlockKey(blocks.length)
          // inner = 首行 <script …> 与末行 </script> 之间的代码
          blocks.push({ key, inner: block.slice(1, -1).join('\n') })
          out.push('<script setup>', key, '</script>')
          i = j + 1
          continue
        }
        // 未闭合:原样输出,交给 markdown-it 处理
        out.push(...block)
        i = j + 1
        continue
      }
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

/** 渲染后把占位 script 的 contentStripped 还原为原始标签内代码 */
export function restoreMaskedScripts(
  sfcScripts: { contentStripped: string }[],
  masked: MaskedScriptBlock[]
): void {
  if (!masked.length) return
  for (const block of sfcScripts) {
    const stripped = block.contentStripped.trim()
    if (!SCRIPT_BLOCK_KEY_RE.test(stripped)) continue
    const real = masked.find((m) => m.key === stripped)
    if (real) block.contentStripped = real.inner
  }
}

// ============================================================
// JSX 区域采集:目标是「所有 HTML/组件标签都由 React 接管」
// ============================================================

/**
 * JSX 区域采集 —— 目标是"所有 HTML/组件标签都由 React 接管":
 * ① 显式容器 `::: react … :::`(任意内容、可跨行、含 JS 表达式);
 * ② 自动:独立成行、以 '<' 开头的标签块(可跨行直到标签配平);
 * ③ 自动:正文行内的标签片段(同一行配平)也整体占位。
 * 命中内容整段替换为 @@VP_HTML_n@@(渲染后由序列化器原样恢复成 JSX)。
 * fence/行内码/frontmatter/注释/DOCTYPE/代码片段(<<<)不在此列。
 */
export function maskJsxHtmlLines(src: string, store: PlaceholderStore): string {
  const lines = src.split('\n')
  const out: string[] = []
  let fence: string | null = null

  const emit = (raw: string, lineNo?: number, block = false) => {
    const n = store.length
    // 错误定位注释:oxc 报错时可据此回到 md 行(lineNo 为近似行号)
    const marked = lineNo != null ? `{/* JSX md:${lineNo} */}\n${raw}` : raw
    store.push({ html: marked })
    // 块级占位用 <div data-vp-jsx>:markdown-it 视为 html_block,不会包进 <p>
    return block ? jsxBlockPlaceholder(n) : htmlToken(n)
  }

  let i = 0
  // YAML frontmatter(--- … ---)区域整体跳过:其中允许原始 HTML 字符串
  // (如首页 features[].icon: <span class="…"></span>),这些不是正文,
  // 不能被当作"JSX 整行接管"占位,否则会污染 YAML(解析阶段即报错)。
  let inFrontmatter = false
  if (lines.length > 0 && /^---\s*$/.test(lines[0])) {
    inFrontmatter = true
    out.push(lines[0])
    i = 1
  }
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (inFrontmatter) {
      out.push(line)
      i++
      if (/^---\s*$/.test(trimmed)) inFrontmatter = false
      continue
    }

    if (fence) {
      out.push(line)
      if (/^\s{0,3}[`~]{3,}\s*$/.test(line)) fence = null
      i++
      continue
    }
    const fm = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fm) {
      fence = fm[1][0]
      out.push(line)
      i++
      continue
    }

    // ① `::: react` 显式容器
    if (/^::: *react\s*$/.test(trimmed)) {
      const raw: string[] = []
      let j = i + 1
      while (j < lines.length && !/^:::\s*$/.test(lines[j].trim())) {
        raw.push(lines[j])
        j++
      }
      if (raw.length === 0) raw.push('') // 空容器仍占位
      out.push(emit(raw.join('\n'), i + 1, true))
      i = j + (j < lines.length ? 1 : 0) // 跳过内容与结束标记
      continue
    }

    const tagPos = firstTagIndex(line)
    if (tagPos === -1) {
      out.push(line)
      i++
      continue
    }

    // <script>/<style> 及其占位由 plugin-sfc/页面模块处理,不属于"React 接管"区域
    const firstTagMatch = line
      .slice(tagPos)
      .match(/^<\/?([A-Za-z][A-Za-z0-9-]*)/)
    const firstName = firstTagMatch ? firstTagMatch[1].toLowerCase() : ''
    if (
      firstName === 'script' ||
      firstName === 'style' ||
      SCRIPT_BLOCK_KEY_RE.test(trimmed)
    ) {
      out.push(line)
      i++
      continue
    }

    const prefix = line.slice(0, tagPos)
    const rest = line.slice(tagPos)

    // ATX 标题行(## 标题 <ComponentInHeader /> 等):行内标签不整行接管——
    // 若占位,占位串会漏进 anchor 插件生成的 heading id / aria-label
    // (如 "#把组件放进标题-vp-html-4")。交给 markdown-it + anchor
    // (干净 id/大纲纯文本)与序列化器(可解析组件名还原为 JSX 组件节点)。
    if (/^ {0,3}#{1,6}\s+/.test(line)) {
      out.push(line)
      i++
      continue
    }

    // Vue 指令属性(:members/@click/v-if/#slot)不属于 React 接管 → 退回旧路径
    if (hasVueishAttr(rest)) {
      out.push(line)
      i++
      continue
    }

    // ②/③:尝试把从该标签开始的后续行配平成一个 JSX 区域(不吞空行/容器结束行)
    const scan: string[] = [rest]
    let depth = tagDepth(rest)
    let j = i
    let ok = true
    while (depth > 0 && j + 1 < lines.length) {
      const next = lines[j + 1]
      const nt = next.trim()
      if (nt === '' || /^:::\s*$/.test(nt) || hasVueishAttr(next)) {
        ok = false
        break
      }
      scan.push(next)
      depth += tagDepth(next)
      j++
    }
    if (depth > 0) ok = false

    if (ok) {
      const raw = scan.join('\n')
      out.push(
        prefix === '' ? emit(raw, i + 1, true) : prefix + emit(raw, i + 1)
      )
      i = j + 1
      continue
    }

    // 配平失败:退回"该行内自配平片段"(同一行)的保守处理
    const singleDepth = tagDepth(rest)
    if (singleDepth === 0 && rest.includes('>')) {
      out.push(prefix + emit(rest.trim(), i + 1))
      i++
      continue
    }
    out.push(line)
    i++
  }
  return out.join('\n')
}

// ============================================================
// JSX 表达式内联:正文 {expr} 一律按 JSX 表达式处理(React 语义,与 Vue 的
// {{ expr }} 对齐)。表达式在渲染前替换为 @@VP_EXPR_n@@ 占位(不进入
// markdown-it),序列化阶段还原成真实 JSX 表达式,与 Page 组件共享作用域
// (可配合 hooks 响应式更新)。
// ============================================================

/**
 * fence/行内码/围栏感知地处理正文里的 {…}:按 React 语义,正文 {expr} 一律
 * 当作 JSX 表达式求值(与 Vue 的 {{ expr }} 对齐;attrs 已改用 `((…))`
 * 分隔,不再占用花括号)。以下情况保持字面文本、不参与求值:
 * - `\{` 转义(作者想显示字面花括号);
 * - `{}` 空容器与 `{{…}}` 嵌套双花括号(语义不明,原样输出,交给文本序列化);
 * - fence / 行内码 / 数学 $…$ / <style> 块 / frontmatter / <<< snippet 指令内的
 *   {…}(非正文)。
 */
export function maskJsxExpressions(
  src: string,
  store: PlaceholderStore
): string {
  let out = ''
  let i = 0
  let fence = false
  let fenceChar = ''
  let inBacktick = false
  let inFrontmatter = src.startsWith('---')
  // <style>…</style> 原始块内(CSS 的 {…} 不是正文表达式,整块跳过掩码,
  // 内容原样交给 plugin-sfc 提取为 sfcBlocks.styles)
  let inStyleBlock = false
  // 数学 $…$ 保护区间(行级成对扫描),随字符游标推进
  const mathRanges = computeMathRanges(src)
  let rangeIdx = 0

  while (i < src.length) {
    const c = src[i]
    const rest = src.slice(i)

    // 行首的代码片段导入指令(<<< @/path{lines} …):整行原样保留,
    // 其 {…} 是 snippet 插件选项,不能进入表达式/字面掩码
    if ((i === 0 || src[i - 1] === '\n') && /^[ \t]*<<<[ \t]+/.test(rest)) {
      const eol = rest.indexOf('\n')
      const seg = eol === -1 ? rest : rest.slice(0, eol + 1)
      out += seg
      i += seg.length
      continue
    }

    if (inFrontmatter) {
      const nl = rest.indexOf('\n')
      const seg = nl === -1 ? rest : rest.slice(0, nl + 1)
      out += seg
      i += seg.length
      if (nl !== -1 && rest.slice(0, nl).trim() === '---') inFrontmatter = false
      continue
    }

    // fence 外的 <style …> 开标签 → 进入整块跳过(fence 内的 <style 只是示例)
    if (
      !inStyleBlock &&
      !fence &&
      !inBacktick &&
      (i === 0 || src[i - 1] === '\n')
    ) {
      const eol = rest.indexOf('\n')
      const firstLine = eol === -1 ? rest : rest.slice(0, eol)
      if (
        /^[ \t]*<style\b/.test(firstLine) &&
        !/^[ \t]*<style\b[^>]*\/\s*>/.test(firstLine)
      ) {
        inStyleBlock = true
      }
    }
    if (inStyleBlock) {
      const eol = rest.indexOf('\n')
      const line = eol === -1 ? rest : rest.slice(0, eol + 1)
      out += line
      i += line.length
      if (/<\/style\s*>/.test(line)) inStyleBlock = false
      continue
    }

    // 代码围栏:整行 `` ` ```` `` 或 ~~~
    if (c === '`' || c === '~') {
      const m = /^(\s{0,3})(`{3,}|~{3,})/.exec(rest)
      if (m && !fence) {
        const eol = rest.indexOf('\n')
        const line = eol === -1 ? rest : rest.slice(0, eol + 1)
        out += line
        i += line.length
        fence = true
        fenceChar = m[2][0]
        continue
      }
      if (fence && fenceChar === c) {
        // 只检查当前行(不是整段余文),等长/超长的同字符围栏即可闭合
        const eol = rest.indexOf('\n')
        const lineText = eol === -1 ? rest : rest.slice(0, eol)
        const closeRe = new RegExp(
          `^\\s{0,3}${fenceChar === '`' ? '`{3,}' : '~{3,}'}\\s*$`
        )
        if (closeRe.test(lineText)) {
          const line = eol === -1 ? rest : rest.slice(0, eol + 1)
          out += line
          i += line.length
          fence = false
          continue
        }
      }
    }
    if (fence) {
      out += c
      i++
      continue
    }

    if (c === '`') {
      inBacktick = !inBacktick
      out += c
      i++
      continue
    }
    if (inBacktick) {
      out += c
      i++
      continue
    }

    // 数学 $…$ / $$…$$:LaTeX 的 {…} 是分组语法,不是 JSX 表达式。
    // 保护区间由 computeMathRanges 预扫(行内成对 $),命中则整段原样复制,
    // 避免正文里不成对的单 $(价格 $1600、表格示例等)把状态机带偏
    if (rangeIdx < mathRanges.length && i >= mathRanges[rangeIdx][0]) {
      if (i < mathRanges[rangeIdx][1]) {
        out += c
        i++
        continue
      }
      rangeIdx++
    }

    if (c === '{') {
      // \{ 转义的字面花括号留给 markdown-it 去反斜杠,不参与表达式求值
      if (i > 0 && src[i - 1] === '\\') {
        out += c
        i++
        continue
      }
      // {{…}} 双花括号(嵌套)按字面输出:第二个及以后的 { 不参与掩码
      if (i > 0 && src[i - 1] === '{') {
        out += c
        i++
        continue
      }
      const end = findMatchingBrace(src, i)
      if (end > i) {
        const raw = src.slice(i + 1, end)
        const inner = raw.trim()
        // 空 {} 与嵌套 {{…}} 语义不明,按字面保留(序列化时包进字符串)
        if (inner && !inner.startsWith('{')) {
          const token = exprToken(store.length)
          store.push({ expr: inner })
          out += token
          i = end + 1
          continue
        }
      }
    }
    out += c
    i++
  }
  return out
}

/** 还原 env.headers 标题里的占位:表达式→`{code}`、HTML→'' */
export function restoreHeaderExpressions(
  headers: any[],
  store: PlaceholderStore
): void {
  const fix = (s: any): any =>
    typeof s === 'string'
      ? s.replace(VP_TOKEN_GLOBAL_RE, (_, kind, n) =>
          kind === 'EXPR' ? `{${store[Number(n)]?.expr ?? ''}}` : ''
        )
      : s
  const walk = (h: any) => {
    if (!h || typeof h !== 'object') return
    if (typeof h.title === 'string') h.title = fix(h.title)
    if (Array.isArray(h.children)) h.children.forEach(walk)
  }
  headers.forEach(walk)
}
