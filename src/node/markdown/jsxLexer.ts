// 词法级文本工具集(纯函数、无副作用)。
// 服务对象:markdown/jsxTokenRules.ts 的标签配平扫描(tagDepth/scanElement)与
// "是否 React 接管"的 Vue 特征判定(hasVueishAttr)。
// V2 契约下正文裸 {…} 一律字面。
// 语义契约:作者在 md 正文里写的标签(HTML 标签 / 组件标签 / <></>)就是
// **JSX 元素**,按 React JSX 语法原样交给 React;只有 md 层自己生成的 HTML
// (attrs 语法 {.class}、标题锚点、容器、Shiki 等)才在组合进 JSX 时做属性转换。
// 因此本文件需要能正确切出"作者写的一个元素":跳过字符串/模板字符串/注释,
// 并**把 {…} 表达式视为整体**(其中的 > 不是标签结束、< 也不开始新标签)。

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

/** 跳过一个字符串/模板字符串:i 指向引号,返回其后位置 */
function skipQuoted(text: string, i: number): number {
  const quote = text[i]
  i++
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === quote) return i + 1
    i++
  }
  return text.length
}

/**
 * 跳过一个 `{…}` JSX 表达式:i 指向 `{`,返回配对 `}` 之后的位置。
 * 引号/模板字符串/注释感知;表达式内的 `>` 与 `<` 不参与标签配平。
 */
function skipBrace(text: string, i: number): number {
  let depth = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i + 2)
      i = end === -1 ? text.length : end
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return text.length
}

/**
 * 读一个标签:i 指向 `<`,返回标签名/是否闭合标签/标签结束(`>`)之后的位置/
 * 是否自闭合;不是标签(如 `<3`、`<>`、`<!…`)返回 null。
 */
function readTag(
  text: string,
  i: number
): { name: string; close: boolean; end: number; selfClosing: boolean } | null {
  if (text[i] !== '<') return null
  let j = i + 1
  const close = text[j] === '/'
  if (close) j++
  if (!/[A-Za-z]/.test(text[j] ?? '')) return null
  const nameStart = j
  while (j < text.length && /[A-Za-z0-9-]/.test(text[j])) j++
  const name = text.slice(nameStart, j)

  // 扫到该标签结束的 '>':括号/引号感知
  let k = j
  while (k < text.length) {
    const c = text[k]
    if (c === '"' || c === "'" || c === '`') {
      k = skipQuoted(text, k)
      continue
    }
    if (c === '{') {
      k = skipBrace(text, k)
      continue
    }
    if (c === '>') {
      return {
        name,
        close,
        end: k + 1,
        selfClosing: /\/\s*$/.test(text.slice(j, k))
      }
    }
    k++
  }
  return null
}

/**
 * 切出作者写的一个元素:i 指向 `<`,返回整段(开标签+子节点+闭标签,或自闭合)
 * 结束后的位置与标签名;不配平/不是元素返回 null。
 */
export function scanElement(
  text: string,
  i: number
): { end: number; name: string; selfClosing: boolean } | null {
  const open = readTag(text, i)
  if (!open || open.close) return null
  if (open.selfClosing || VOID_HTML_TAGS.has(open.name.toLowerCase())) {
    return { end: open.end, name: open.name, selfClosing: true }
  }

  let depth = 1
  let j = open.end
  while (j < text.length) {
    const c = text[j]
    if (c === '"' || c === "'" || c === '`') {
      j = skipQuoted(text, j)
      continue
    }
    if (c === '{') {
      j = skipBrace(text, j)
      continue
    }
    if (c === '<') {
      if (text.startsWith('<!--', j)) {
        const end = text.indexOf('-->', j)
        if (end === -1) return null
        j = end + 3
        continue
      }
      if (text[j + 1] === '>') {
        depth++
        j += 2
        continue
      }
      if (text[j + 1] === '/') {
        depth--
        // 闭合标签(含 </>)按名称无关处理,与 fragment 扫描保持一致
        const end = text.indexOf('>', j)
        if (end === -1) return null
        if (depth === 0) {
          return { end: end + 1, name: open.name, selfClosing: false }
        }
        j = end + 1
        continue
      }
      const tag = readTag(text, j)
      if (tag) {
        if (
          !tag.close &&
          !tag.selfClosing &&
          !VOID_HTML_TAGS.has(tag.name.toLowerCase())
        ) {
          depth++
        }
        j = tag.end
        continue
      }
    }
    j++
  }
  return null
}

/**
 * 计算一段文本里"标签深度":<tag>+1、</tag>-1、Fragment <>+1、</>-1;
 * 跳过引号/模板字符串/注释/`{…}` 表达式(表达式整体跳过:其中的 `>` 不是标签
 * 结束、`<` 也不起新标签)。返回最终深度(>0 表示还有未闭合的标签)。
 */
export function tagDepth(text: string): number {
  let depth = 0
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (c === '{') {
      i = skipBrace(text, i)
      continue
    }
    if (c === '<') {
      if (text.startsWith('<!--', i)) {
        const end = text.indexOf('-->', i)
        if (end === -1) break
        i = end + 3
        continue
      }
      // Fragment 开标签 <>:空标签名,直接 +1
      if (text[i + 1] === '>') {
        depth++
        i += 2
        continue
      }
      // 闭合标签 </tag> / </> 一律 -1
      if (text[i + 1] === '/') {
        depth--
        const end = text.indexOf('>', i)
        if (end === -1) break
        i = end + 1
        continue
      }
      const tag = readTag(text, i)
      if (tag) {
        if (
          !tag.close &&
          !tag.selfClosing &&
          !VOID_HTML_TAGS.has(tag.name.toLowerCase())
        ) {
          depth++
        }
        i = tag.end
        continue
      }
    }
    i++
  }
  return depth
}

/**
 * 该文本是否带 Vue 特征(不属于 React 接管区域):
 *   - 指令属性 `:members` / `@click` / `#slot`;
 *   - `v-*` 指令属性(`v-if`/`v-for`/`v-pre`/…);
 *   - Vue 插值文本 `{{ … }}`(排除 JSX 的 `={{` 对象字面量)。
 * 有则交由旧 HTML→JSX 路径处理(属性丢弃并提示、文本按字面转义),避免把
 * Vue 语法当 JSX 交给 oxc 报错(en 已移除后仅剩作者误贴 Vue 片段的兜底)。
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
