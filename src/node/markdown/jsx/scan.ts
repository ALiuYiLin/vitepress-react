// 词法原语:作者标签 / 片段的扫描(纯函数,无副作用)。
//
// 唯一使用者:markdown/jsx/regions.ts(识别层)。
//
// 语义契约:作者在 md 正文里写的标签(HTML 标签 / 组件标签 / <></>)就是
// **JSX 元素**,按 React JSX 语法原样交给 React。因此扫描器必须能正确切出
// "一个元素 / 一段片段":引号、模板字符串、注释、`{…}` 表达式都要整体跳过
// (`{…}` 里的 `>` 不结束标签,`<` 也不开始新标签)。

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
export function skipQuoted(
  text: string,
  i: number,
  limit = text.length
): number {
  const quote = text[i]
  i++
  while (i < limit) {
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === quote) return i + 1
    i++
  }
  return limit
}

/**
 * 跳过一个 `{…}` JSX 表达式:i 指向 `{`,返回配对 `}` 之后的位置。
 * 引号/模板字符串/注释感知;表达式内的 `>` 与 `<` 不参与标签配平。
 */
export function skipBrace(
  text: string,
  i: number,
  limit = text.length
): number {
  let depth = 0
  while (i < limit) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i, limit)
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 || end + 2 > limit ? limit : end + 2
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i + 2)
      i = end === -1 || end > limit ? limit : end
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return limit
}

/** 跳过一个注释(HTML 注释 / JS 块注释 / JS 行注释);不是注释返回 -1 */
function skipComment(text: string, i: number, limit: number): number {
  if (text.startsWith('<!--', i)) {
    const end = text.indexOf('-->', i + 4)
    return end === -1 || end + 3 > limit ? limit : end + 3
  }
  if (text.startsWith('/*', i)) {
    const end = text.indexOf('*/', i + 2)
    return end === -1 || end + 2 > limit ? limit : end + 2
  }
  if (text.startsWith('//', i)) {
    const end = text.indexOf('\n', i + 2)
    return end === -1 || end > limit ? limit : end
  }
  return -1
}

/**
 * 读一个标签:i 指向 `<`,返回标签名/是否闭合标签/标签结束(`>`)之后的位置/
 * 是否自闭合;不是标签(如 `<3`、`<>`、`<!…`)返回 null。
 */
export function readTag(
  text: string,
  i: number,
  limit = text.length
): { name: string; close: boolean; end: number; selfClosing: boolean } | null {
  if (text[i] !== '<') return null
  let j = i + 1
  const close = text[j] === '/'
  if (close) j++
  if (!/[A-Za-z]/.test(text[j] ?? '')) return null
  const nameStart = j
  while (j < limit && /[A-Za-z0-9-]/.test(text[j])) j++
  const name = text.slice(nameStart, j)

  // 扫到该标签结束的 '>':引号/花括号感知
  let k = j
  while (k < limit) {
    const c = text[k]
    if (c === '"' || c === "'" || c === '`') {
      k = skipQuoted(text, k, limit)
      continue
    }
    if (c === '{') {
      k = skipBrace(text, k, limit)
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
  i: number,
  limit = text.length
): { end: number; name: string; selfClosing: boolean } | null {
  const open = readTag(text, i, limit)
  if (!open || open.close) return null
  if (open.selfClosing || VOID_HTML_TAGS.has(open.name.toLowerCase())) {
    return { end: open.end, name: open.name, selfClosing: true }
  }

  let depth = 1
  let j = open.end
  while (j < limit) {
    const c = text[j]
    if (c === '"' || c === "'" || c === '`') {
      j = skipQuoted(text, j, limit)
      continue
    }
    if (c === '{') {
      j = skipBrace(text, j, limit)
      continue
    }
    if (c === '<') {
      const commentEnd = skipComment(text, j, limit)
      if (commentEnd !== -1) {
        j = commentEnd
        continue
      }
      if (text[j + 1] === '>') {
        depth++
        j += 2
        continue
      }
      if (text[j + 1] === '/') {
        depth--
        // 闭合标签(含 </>)按名称无关处理,与片段扫描保持一致
        const end = text.indexOf('>', j)
        if (end === -1 || end >= limit) return null
        if (depth === 0) {
          return { end: end + 1, name: open.name, selfClosing: false }
        }
        j = end + 1
        continue
      }
      const tag = readTag(text, j, limit)
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
 * 切出"作者元素序列":一个或多个元素,元素之间与末尾只允许空白。
 * 返回原文与结束位置;不是元素序列、含被排除标签、不配平返回 null。
 */
export function scanElementSequence(
  text: string,
  i: number,
  limit = text.length,
  exclude?: (name: string) => boolean
): { raw: string; end: number } | null {
  let pos = i
  let end = i
  let count = 0
  while (pos < limit) {
    while (pos < limit && /[ \t\r\n]/.test(text[pos])) pos++
    if (text[pos] !== '<') break
    const next = text[pos + 1]
    if (next === '/' || next === '!' || next === '>') break
    const el = scanElement(text, pos, limit)
    if (!el) return null
    if (exclude?.(el.name)) return null
    pos = el.end
    end = el.end
    count++
  }
  if (count === 0) return null
  return { raw: text.slice(i, end), end }
}

/**
 * 片段配平扫描:`<>` 深度 +1、`</>` 深度 -1;嵌套元素整体跳过;
 * 引号/模板字符串/注释/`{…}` 表达式整体跳过。
 * 返回配平结束位置(不含),未配平返回 -1。
 */
export function scanFragment(
  text: string,
  i: number,
  limit = text.length
): number {
  if (text[i] !== '<' || text[i + 1] !== '>') return -1
  let depth = 1
  let pos = i + 2
  while (pos < limit) {
    const c = text[pos]
    if (c === '"' || c === "'" || c === '`') {
      pos = skipQuoted(text, pos, limit)
      continue
    }
    if (c === '{') {
      pos = skipBrace(text, pos, limit)
      continue
    }
    if (c === '<') {
      const commentEnd = skipComment(text, pos, limit)
      if (commentEnd !== -1) {
        pos = commentEnd
        continue
      }
      if (text.startsWith('<>', pos)) {
        depth++
        pos += 2
        continue
      }
      if (text.startsWith('</>', pos)) {
        depth--
        pos += 3
        if (depth === 0) return pos
        continue
      }
      const el = scanElement(text, pos, limit)
      if (el) {
        pos = el.end
        continue
      }
    }
    pos++
  }
  return -1
}

/**
 * 片段内部是否含动态部分:`{…}` 表达式或真正的标签 `<…>`。
 * 引号/模板字符串/注释内的字面 `{`、`<` 不计 —— 这正是 `<>`、`<></>`、
 * `<>纯文字</>`、`a <> b`、`Array<>` 保持字面文本的判据。
 */
export function hasDynamicPart(text: string, from: number, to: number): boolean {
  let i = from
  while (i < to) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(text, i, to)
      continue
    }
    if (c === '{') return true
    if (c === '<') {
      const commentEnd = skipComment(text, i, to)
      if (commentEnd !== -1) {
        i = commentEnd
        continue
      }
      if (readTag(text, i, to)) return true
    }
    i++
  }
  return false
}
