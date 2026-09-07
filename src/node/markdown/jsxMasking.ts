// 正文 JSX 区域掩码 Pass 与还原(自 markdownToReact.ts 拆分)。
//
// V2 契约(见根目录 MD-DYNAMIC-SYNTAX-V2.md):正文裸 {…} 一律字面文本,
// 唯一的动态入口是作者**显式写的 JSX**(<>{expr}</> / 组件标签 / ::: react)。
// 这里只剩两类"渲染前文本改写"(都在 markdown-it 之前,产物仍是合法文本):
//   - maskScriptBlocks → 渲染前:<script> 块(fence 感知)替换为 3 行占位;
//    渲染后 restoreMaskedScripts 把 plugin-sfc 提取的 contentStripped 还原;
//   - maskJsxHtmlLines → 渲染前:JSX 接管区(::: react / 整行标签 / 行内片段,
//    含 <>{expr}</> Fragment)整段替换为 @@VP_HTML_n@@ 或 <div data-vp-jsx>。
// <style> 块内容不参与任何掩码,由 plugin-sfc 从 html_block 直接提取。
// 占位格式的写入/读取契约集中在 placeholders.ts;词法工具在 jsxLexer.ts。

import {
  VOID_HTML_TAGS,
  firstTagIndex,
  hasVueishAttr,
  tagDepth
} from './jsxLexer'
import {
  htmlToken,
  jsxBlockPlaceholder,
  SCRIPT_BLOCK_KEY_RE,
  scriptBlockKey,
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
// JSX 区域采集:目标是「所有 HTML/组件/<> Fragment 标签都由 React 接管」
// ============================================================

/**
 * 从一段"以标签开头"的文本中,返回平衡 JSX 区域结束后的下标(不含行尾
 * 残余文本)。镜像 tagDepth 的扫描规则:引号/注释跳过、{…} 里的标签也
 * 计数;自闭合/void 开标签与匹配的闭合标签使深度回到 0 时即返回。
 * 扫描到文本末尾仍不平衡 → -1。
 */
function jsxRegionEnd(text: string): number {
  let depth = 0
  let i = 0
  let inQuote: string | null = null
  while (i < text.length) {
    const c = text[i]
    if (inQuote) {
      if (c === '\\') i += 2
      else {
        if (c === inQuote) inQuote = null
        i++
      }
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inQuote = c
      i++
      continue
    }
    if (c === '<' && text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i)
      if (end === -1) return -1
      i = end + 3
      if (depth === 0) return i
      continue
    }
    // Fragment 开标签 <>:空标签名,直接 +1
    if (c === '<' && text[i + 1] === '>') {
      depth++
      i += 2
      continue
    }
    if (c === '<' && text[i + 1] === '/') {
      depth--
      i += 2
      while (i < text.length && text[i] !== '>') i++
      i++
      if (depth === 0) return i
      continue
    }
    if (c === '<' && /[A-Za-z]/.test(text[i + 1] ?? '')) {
      let j = i + 1
      while (j < text.length && /[A-Za-z0-9-]/.test(text[j])) j++
      const name = text.slice(i + 1, j).toLowerCase()
      let inQ: string | null = null
      let end = j
      for (; end < text.length; end++) {
        const ch = text[end]
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
      const isSelfClose = text.slice(j, end + 1).endsWith('/>')
      if (!isSelfClose && !VOID_HTML_TAGS.has(name)) depth++
      i = Math.min(end + 1, text.length)
      // 自闭合/void 开标签(深度本就 0)或闭合标签使深度回到 0 → 区域结束
      if (depth === 0) return i
      continue
    }
    i++
  }
  return -1
}

/**
 * JSX 区域采集 —— 目标是"所有 HTML/组件/<> Fragment 标签都由 React 接管":
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

    // 关闭标签起头(如独立的 `</details>`)不是"JSX 区域起点"——没有可配平
    // 的开标签,占位只会制造错位;交给 markdown-it html 路径原样处理
    // (上游 Vue 原样 HTML 文档页也能编译)。
    if (rest.startsWith('</')) {
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
      // 单行即平衡、且平衡区域后还有行尾文本:只接管标签区域本身,行尾
      // 纯文本交回 markdown(仍是 md 文本:后续 {…}/强调等不会被误当 JSX),
      // 如 `<>{x}</> 后文` → 接管 `<>…</>`,后文走 md。
      if (i === j) {
        const regionEnd = jsxRegionEnd(rest)
        if (regionEnd > 0 && regionEnd < rest.length) {
          const tailText = rest.slice(regionEnd)
          // 尾巴里还有 `<`(同一行后跟另一段标签/片段)时整行接管更稳——
          // 标签链在 JSX 里是连续节点,拆开再扫描会漏掉第二段。
          if (!tailText.includes('<')) {
            const head = rest.slice(0, regionEnd)
            out.push(prefix + emit(head, i + 1) + tailText)
            i = j + 1
            continue
          }
        }
      }
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
