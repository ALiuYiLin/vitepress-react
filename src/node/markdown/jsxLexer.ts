// 词法级文本工具集(自 markdownToReact.ts 拆分,纯函数、无副作用)。
// 服务对象:markdown/jsxMasking.ts 的 fence/引号/标签配平扫描(JSX 区域接管)。
// V2 契约(见根目录 MD-DYNAMIC-SYNTAX-V2.md)下正文裸 {…} 一律字面,不再需要
// 括号配对/数学区间等表达式工具;tagDepth/firstTagIndex 需识别 Fragment
// 空标签名(`<>` / `</>`),以便 `<>{expr}</>` 被当作 JSX 区域接管。

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
 * 计算一段文本里"标签深度":<tag>+1、</tag>-1、Fragment <>+1、</>-1;
 * 跳过引号/注释;`{…}`(JSX 表达式)里的 <tag/> 也按标签计数,可被完整
 * 成对抵消。返回最终深度(>0 表示还有未闭合的标签)。
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
    // Fragment 开标签 <>:空标签名,直接 +1
    if (c === '<' && text[i + 1] === '>') {
      depth++
      i += 2
      continue
    }
    if (c === '<' && text[i + 1] === '/') {
      // 闭合标签 </tag> / </> 一律 -1
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
 * 定位一行文本里第一个"真标签/JSX 起头"的 '<' 下标;行内码(反引号)内跳过;
 * 找不到返回 -1。识别 `<tag`、`</tag` 与 Fragment 开标签 `<>`。
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
    // Fragment 开标签 <>:空标签名
    if (ch === '<' && line[i + 1] === '>') return i
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
 * 该文本是否带 Vue 特征(不属于 React 接管区域):
 *   - 指令属性 `:members` / `@click` / `#slot`;
 *   - `v-*` 指令属性(`v-if`/`v-for`/`v-pre`/…);
 *   - Vue 插值文本 `{{ … }}`(排除 JSX 的 `={{` 对象字面量)。
 * 有则交由旧 HTML→JSX 路径处理(属性丢弃并提示、文本按字面转义),避免把
 * Vue 语法当 JSX 交给 oxc 报错(上游 Vue 原样 HTML 文档页可原样编译)。
 * 引号内与 `{…}` 表达式内不计(JSX 行不受影响)。
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
      // `{{` 且前一字符不是 '='(JSX 的 `={{` 是对象字面量)→ Vue 插值文本
      if (text[i + 1] === '{' && (i === 0 || text[i - 1] !== '=')) {
        return true
      }
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
  // v-* 指令属性(剥掉引号内的取值后再看属性名)
  const attrScan = text.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, '')
  if (/[\s/]v-[\w:.-]+(?=[\s=/>]|$)/.test(attrScan)) return true
  return false
}
