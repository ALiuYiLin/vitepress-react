// 词法级文本工具集(自 markdownToReact.ts 拆分,纯函数、无副作用)。
// 服务对象:markdown/jsxMasking.ts 的 fence/引号/括号/标签配平扫描,
// 以及正文 {expr} / JSX 整行接管区域的边界判定。

/**
 * 词法级括号配对:找 src 里 openIndex('{') 的匹配 '}'(跳过引号/模板串/注释)
 */
export function findMatchingBrace(src: string, openIndex: number): number {
  let depth = 0
  let i = openIndex
  while (i < src.length) {
    const ch = src[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch
      i++
      while (i < src.length) {
        if (src[i] === '\\') i += 2
        else if (src[i] === q) break
        else i++
      }
      i++
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/** void 元素(自闭合,不增加标签深度) */
export const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

/**
 * 计算一段文本里"标签深度":<tag>+1、</tag>-1;跳过引号/注释;
 * `{…}`(JSX 表达式)里的 <tag/> 也按标签计数,可被完整成对抵消。
 * 返回最终深度(>0 表示还有未闭合的标签)。
 */
export function tagDepth(text: string): number {
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
      if (end === -1) break
      i = end + 3
      continue
    }
    if (c === '<' && text[i + 1] === '/') {
      depth--
      i += 2
      while (i < text.length && text[i] !== '>') i++
      i++
      continue
    }
    if (c === '<' && /[A-Za-z]/.test(text[i + 1] ?? '')) {
      // 找标签名
      let j = i + 1
      while (j < text.length && /[A-Za-z0-9-]/.test(text[j])) j++
      const name = text.slice(i + 1, j).toLowerCase()
      // 扫到该开标签结束的 '>'(引号内跳过)
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
      continue
    }
    i++
  }
  return depth
}

/**
 * 定位一行文本里第一个"真标签"的 '<' 下标;行内码(反引号)内跳过;找不到返回 -1
 */
export function firstTagIndex(line: string): number {
  let inCode = false
  let codeLen = 0
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '`') {
      // 近似:连续的 ` 视为一个代码段定界
      if (!inCode) {
        codeLen = 1
        while (i + codeLen < line.length && line[i + codeLen] === '`') codeLen++
        inCode = true
        i += codeLen - 1
        continue
      }
      let close = 1
      while (i + close < line.length && line[i + close] === '`') close++
      if (close >= codeLen) inCode = false
      i += close - 1
      continue
    }
    if (inCode) continue
    if (ch === '<' && /[A-Za-z]/.test(line[i + 1] ?? '')) return i
    if (
      ch === '<' &&
      line.startsWith('</', i) &&
      /[A-Za-z]/.test(line[i + 2] ?? '')
    ) {
      return i
    }
  }
  return -1
}

/**
 * 该文本是否含 Vue 指令属性(:members/@click/v-if/#slot 等)。
 * 有则不属于"React 接管"区域,交由旧 HTML→JSX 路径处理(丢弃/提示),
 * 避免把 Vue 语法当 JSX 交给 oxc 报错。引号内与 {…} 表达式内不计。
 */
export function hasVueishAttr(text: string): boolean {
  let inQuote: string | null = null
  let brace = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuote) {
      if (c === '\\') i++
      else if (c === inQuote) inQuote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inQuote = c
      continue
    }
    if (c === '{') {
      brace++
      continue
    }
    if (c === '}') {
      brace = Math.max(0, brace - 1)
      continue
    }
    if (brace > 0) continue
    if ((c === ':' || c === '@') && /[A-Za-z_]/.test(text[i + 1] ?? '')) {
      return true
    }
    if (c === '#') {
      const prev = i === 0 ? ' ' : text[i - 1]
      if (/\s/.test(prev) && /[A-Za-z_]/.test(text[i + 1] ?? '')) return true
    }
  }
  return false
}

/**
 * 预扫数学保护区间:同一行内按 $ 出现顺序两两配对($…$ / $$…$$),
 * 每对的首个 $ 到第二个 $ 结束为保护区间({…} 分组不被当 JSX 表达式)。
 * 不成对的单个 $(价格、表格示例等)不产生保护——与 markdown-it-mathjax3
 * 的成对匹配语义一致,也不会把状态残留到后续行。
 */
export function computeMathRanges(src: string): [number, number][] {
  const ranges: [number, number][] = []
  for (let lineStart = 0; lineStart <= src.length;) {
    // 当前行 [lineStart, lineEnd)
    const nl = src.indexOf('\n', lineStart)
    const lineEnd = nl === -1 ? src.length : nl
    // 收集本行 $ 连续段(含起止)
    const runs: number[] = []
    for (let k = lineStart; k < lineEnd; k++) {
      if (src[k] !== '$') continue
      const s = k
      while (k + 1 < lineEnd && src[k + 1] === '$') k++
      runs.push(s, k + 1) // [start, end)
    }
    // 顺序两两配对:第 1 个 $ 起 → 第 2 个 $ 止(每对 2 个 run = 4 元素)
    for (let r = 0; r + 3 < runs.length; r += 4) {
      ranges.push([runs[r], runs[r + 3]])
    }
    if (nl === -1) break
    lineStart = nl + 1
  }
  return ranges
}
