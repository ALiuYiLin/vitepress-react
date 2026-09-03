// React md 正文序列化:把 markdown-it 渲染出的静态 HTML 在编译期转成
// JSX 源码(页面模块以 automatic JSX runtime 由 oxc 编译)。
//
// 结构移植自蓝本 ActView(C:\code\vitepress) markdownToActView.ts 的
// serializeHtmlToJsx / parseOpenTag / decodeEntities,并在此之上补齐 React
// 语义差异(蓝本面向 ActView,属性原样透传;React 需要):
//   - class→className、for→htmlFor、tabindex→tabIndex 等属性映射;
//   - style="..." 字符串 → style={{ ... }} 对象字面量;
//   - 布尔属性(disabled/checked/…)按 JSX 裸属性输出。
// 语义要点(与蓝本一致):
//   - 大写开头标签命中「script 块导出名集合」→ 组件引用(属性透传);
//     未命中 → 渲染为转义文本 + 警告(避免 JSX 编译期 ReferenceError);
//   - 正文文本一律输出为 {"字符串字面量"} 表达式 —— 双花括号 {{ }} 与任何
//     正文表达式都不会被求值(迁移 D1:动态内容用 script 块导出组件)。
//   - 顶层固定 <div className="vp-doc"> 包裹(与上游 Vue 版 template 一致)。

interface JsxNode {
  tag: string
  attrs: [string, string | boolean][]
  children: (JsxNode | string)[]
}

/** 自闭合 void 元素 */
const VOID_TAGS = new Set([
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

/** 具名组件导出名的判定(首字母大写 + 标识符字符) */
const COMPONENT_TAG_RE = /^[A-Z][A-Za-z0-9_$]*$/

/**
 * 从 script 块内容收集模块顶层的大写开头标识符(组件引用解析用)。
 * 规则:行首(允许 export 前缀,不允许缩进)的 function/const/let/var/class、
 * export { A as B }、import { A as B } / import A from / import * as A。
 */
export function extractComponentNames(code: string): Set<string> {
  const names = new Set<string>()
  const add = (n: string | undefined) => {
    if (n && /^[A-Z]/.test(n)) names.add(n)
  }
  const declRe =
    /^(?:export\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm
  for (const m of code.matchAll(declRe)) add(m[1])
  for (const m of code.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim().split(/\s+as\s+/)
      add(seg[seg.length - 1]?.trim())
    }
  }
  for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim().split(/\s+as\s+/)
      add(seg[seg.length - 1]?.trim())
    }
  }
  for (const m of code.matchAll(
    /import\s+(\*?\s*as\s+)?([A-Za-z_$][\w$]*)\s*from/g
  )) {
    add(m[2])
  }
  return names
}

/** 解析开始标签:返回标签名(保留原大小写)、属性、自闭合与下一位置 */
function parseOpenTag(
  html: string,
  start: number
):
  | { tag: string; attrs: [string, string | boolean][]; selfClosing: boolean; next: number }
  | null {
  const len = html.length
  let i = start + 1
  let j = i
  while (j < len && !/[\s/>]/.test(html[j])) j++
  const tag = html.slice(i, j)
  if (!/^[a-zA-Z][\w:-]*$/.test(tag)) return null
  i = j

  const attrs: [string, string | boolean][] = []
  let selfClosing = false

  while (i < len) {
    while (i < len && /\s/.test(html[i])) i++
    if (i >= len) break
    const c = html[i]
    if (c === '>') {
      i++
      break
    }
    if (c === '/') {
      if (html[i + 1] === '>') {
        selfClosing = true
        i += 2
        break
      }
      i++
      continue
    }
    let k = i
    while (k < len && !/[\s=/>]/.test(html[k])) k++
    const name = html.slice(i, k)
    i = k
    while (i < len && /\s/.test(html[i])) i++
    let value: string | boolean = true
    if (html[i] === '=') {
      i++
      while (i < len && /\s/.test(html[i])) i++
      const q = html[i]
      if (q === '"' || q === "'") {
        const close = html.indexOf(q, i + 1)
        if (close === -1) {
          value = html.slice(i + 1)
          i = len
        } else {
          value = html.slice(i + 1, close)
          i = close + 1
        }
      } else {
        let v = i
        while (v < len && !/[\s>]/.test(html[v])) v++
        value = html.slice(i, v)
        i = v
      }
    }
    if (name) attrs.push([name, value])
  }

  return { tag, attrs, selfClosing, next: i }
}

// ============ React 属性适配层(蓝本之上新增) ============

/** HTML 属性名 → React prop 名(小写键) */
const REACT_ATTR_ALIASES: Record<string, string> = {
  'accept-charset': 'acceptCharset',
  accesskey: 'accessKey',
  allowfullscreen: 'allowFullScreen',
  autocapitalize: 'autoCapitalize',
  autocomplete: 'autoComplete',
  autocorrect: 'autoCorrect',
  autofocus: 'autoFocus',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  class: 'className',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  enterkeyhint: 'enterKeyHint',
  for: 'htmlFor',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  'http-equiv': 'httpEquiv',
  inputmode: 'inputMode',
  maxlength: 'maxLength',
  minlength: 'minLength',
  novalidate: 'noValidate',
  playsinline: 'playsInline',
  readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy',
  rowspan: 'rowSpan',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap'
}

/** HTML 布尔属性:属性存在即视为 true(JSX 输出裸属性名) */
const BOOLEAN_PROPS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected'
])

/** CSS 属性名 → React style key(-ms- 前缀小写 ms,其余厂商前缀首字母大写) */
function cssToCamel(name: string): string {
  if (!name.includes('-')) return name
  const seg = name.split('-').filter(Boolean)
  const head = seg[0].toLowerCase()
  if (head === 'ms') seg[0] = 'ms'
  else if (head === 'webkit') seg[0] = 'Webkit'
  else if (head === 'moz') seg[0] = 'Moz'
  else if (head === 'o') seg[0] = 'O'
  else seg[0] = seg[0].toLowerCase()
  return seg
    .map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join('')
}

/** style="..." 字符串 → style={{ key: 'value', ... }} 对象字面量表达式 */
function styleExpr(value: string): string {
  const parts: string[] = []
  for (const decl of value.split(';')) {
    const idx = decl.indexOf(':')
    if (idx < 0) continue
    const key = decl.slice(0, idx).trim()
    const val = decl.slice(idx + 1).trim()
    if (!key || !val) continue
    const jsxKey = key.startsWith('--') ? key : cssToCamel(key)
    parts.push(`${JSON.stringify(jsxKey)}: ${JSON.stringify(val)}`)
  }
  if (!parts.length) return ''
  return `style={{ ${parts.join(', ')} }}`
}

/** JSX 属性字符串值转义(双引号 → 实体,避免破坏属性边界) */
function escapeJsxAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// ============ HTML 实体解码 ============

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  iexcl: '\u00A1',
  cent: '\u00A2',
  pound: '\u00A3',
  curren: '\u00A4',
  yen: '\u00A5',
  brvbar: '\u00A6',
  sect: '\u00A7',
  uml: '\u00A8',
  copy: '\u00A9',
  ordf: '\u00AA',
  laquo: '\u00AB',
  not: '\u00AC',
  shy: '\u00AD',
  reg: '\u00AE',
  macr: '\u00AF',
  deg: '\u00B0',
  plusmn: '\u00B1',
  sup2: '\u00B2',
  sup3: '\u00B3',
  acute: '\u00B4',
  micro: '\u00B5',
  para: '\u00B6',
  middot: '\u00B7',
  cedil: '\u00B8',
  sup1: '\u00B9',
  ordm: '\u00BA',
  raquo: '\u00BB',
  frac14: '\u00BC',
  frac12: '\u00BD',
  frac34: '\u00BE',
  iquest: '\u00BF',
  Agrave: '\u00C0',
  Aacute: '\u00C1',
  Acirc: '\u00C2',
  Atilde: '\u00C3',
  Auml: '\u00C4',
  Aring: '\u00C5',
  AElig: '\u00C6',
  Ccedil: '\u00C7',
  Egrave: '\u00C8',
  Eacute: '\u00C9',
  Ecirc: '\u00CA',
  Euml: '\u00CB',
  Igrave: '\u00CC',
  Iacute: '\u00CD',
  Icirc: '\u00CE',
  Iuml: '\u00CF',
  ETH: '\u00D0',
  Ntilde: '\u00D1',
  Ograve: '\u00D2',
  Oacute: '\u00D3',
  Ocirc: '\u00D4',
  Otilde: '\u00D5',
  Ouml: '\u00D6',
  times: '\u00D7',
  Oslash: '\u00D8',
  Ugrave: '\u00D9',
  Uacute: '\u00DA',
  Ucirc: '\u00DB',
  Uuml: '\u00DC',
  Yacute: '\u00DD',
  THORN: '\u00DE',
  szlig: '\u00DF',
  agrave: '\u00E0',
  aacute: '\u00E1',
  acirc: '\u00E2',
  atilde: '\u00E3',
  auml: '\u00E4',
  aring: '\u00E5',
  aelig: '\u00E6',
  ccedil: '\u00E7',
  egrave: '\u00E8',
  eacute: '\u00E9',
  ecirc: '\u00EA',
  euml: '\u00EB',
  igrave: '\u00EC',
  iacute: '\u00ED',
  icirc: '\u00EE',
  iuml: '\u00EF',
  eth: '\u00F0',
  ntilde: '\u00F1',
  ograve: '\u00F2',
  oacute: '\u00F3',
  ocirc: '\u00F4',
  otilde: '\u00F5',
  ouml: '\u00F6',
  divide: '\u00F7',
  oslash: '\u00F8',
  ugrave: '\u00F9',
  uacute: '\u00FA',
  ucirc: '\u00FB',
  uuml: '\u00FC',
  yacute: '\u00FD',
  thorn: '\u00FE',
  yuml: '\u00FF',
  OElig: '\u0152',
  oelig: '\u0153',
  Scaron: '\u0160',
  scaron: '\u0161',
  Yuml: '\u0178',
  fnof: '\u0192',
  circ: '\u02C6',
  tilde: '\u02DC',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  zwnj: '\u200C',
  zwj: '\u200D',
  lrm: '\u200E',
  rlm: '\u200F',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  sbquo: '\u201A',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bdquo: '\u201E',
  dagger: '\u2020',
  Dagger: '\u2021',
  bull: '\u2022',
  hellip: '\u2026',
  permil: '\u2030',
  prime: '\u2032',
  Prime: '\u2033',
  lsaquo: '\u2039',
  rsaquo: '\u203A',
  oline: '\u203E',
  frasl: '\u2044',
  euro: '\u20AC',
  image: '\u2111',
  weierp: '\u2118',
  real: '\u211C',
  trade: '\u2122',
  alefsym: '\u2135',
  larr: '\u2190',
  uarr: '\u2191',
  rarr: '\u2192',
  darr: '\u2193',
  harr: '\u2194',
  crarr: '\u21B5',
  lArr: '\u21D0',
  uArr: '\u21D1',
  rArr: '\u21D2',
  dArr: '\u21D3',
  hArr: '\u21D4',
  forall: '\u2200',
  part: '\u2202',
  exist: '\u2203',
  empty: '\u2205',
  nabla: '\u2207',
  isin: '\u2208',
  notin: '\u2209',
  ni: '\u220B',
  prod: '\u220F',
  sum: '\u2211',
  minus: '\u2212',
  lowast: '\u2217',
  radic: '\u221A',
  prop: '\u221D',
  infin: '\u221E',
  ang: '\u2220',
  and: '\u2227',
  or: '\u2228',
  cap: '\u2229',
  cup: '\u222A',
  int: '\u222B',
  there4: '\u2234',
  sim: '\u223C',
  cong: '\u2245',
  asymp: '\u2248',
  ne: '\u2260',
  equiv: '\u2261',
  le: '\u2264',
  ge: '\u2265',
  sub: '\u2282',
  sup: '\u2283',
  nsub: '\u2284',
  sube: '\u2286',
  supe: '\u2287',
  oplus: '\u2295',
  otimes: '\u2297',
  perp: '\u22A5',
  sdot: '\u22C5',
  lceil: '\u2308',
  rceil: '\u2309',
  lfloor: '\u230A',
  rfloor: '\u230B',
  lang: '\u2329',
  rang: '\u232A',
  loz: '\u25CA',
  spades: '\u2660',
  clubs: '\u2663',
  hearts: '\u2665',
  diams: '\u2666'
}

export function decodeEntities(str: string): string {
  return str.replace(
    /&(#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, ent: string) => {
      if (ent[0] === '#') {
        const code =
          ent[1] === 'x' || ent[1] === 'X'
            ? parseInt(ent.slice(2), 16)
            : parseInt(ent.slice(1), 10)
        if (Number.isFinite(code) && code > 0) {
          try {
            return String.fromCodePoint(code)
          } catch {
            return match
          }
        }
        return match
      }
      return NAMED_ENTITIES[ent] ?? match
    }
  )
}

// ============ 主序列化 ============

/**
 * 把 markdown-it 渲染出的 HTML 序列化为 JSX 源码片段。
 *
 * @param componentNames 可解析为组件引用的顶层标识符集合(script 块导出)
 * @returns { code } JSX 源码(顶层 <div className="vp-doc"> 包裹),
 *   { warnings } 序列化期的可修复提示(丢弃/降级项)
 */
export function serializeHtmlToJsx(
  html: string,
  componentNames: ReadonlySet<string> = new Set(),
  expressions: Record<string, { expr?: string; literal?: string }> = {},
  indent = '  '
): { code: string; warnings: string[] } {
  const root: JsxNode = { tag: '', attrs: [], children: [] }
  const stack: JsxNode[] = [root]
  let i = 0
  let textBuf = ''
  const warnings: string[] = []

  const flushText = () => {
    if (!textBuf) return
    const parent = stack[stack.length - 1]
    // <pre> 内部文本原样保留(含空白),其余纯空白文本丢弃
    const inPre = stack.some((n) => n.tag === 'pre')
    if (inPre || textBuf.trim() !== '') {
      const last = parent.children[parent.children.length - 1]
      if (typeof last === 'string') {
        parent.children[parent.children.length - 1] = last + textBuf
      } else {
        parent.children.push(textBuf)
      }
    }
    textBuf = ''
  }

  while (i < html.length) {
    const ch = html[i]
    if (ch !== '<') {
      textBuf += ch
      i++
      continue
    }
    // 注释 / DOCTYPE / 处理指令
    if (html.startsWith('<!--', i)) {
      flushText()
      const end = html.indexOf('-->', i + 4)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      flushText()
      const end = html.indexOf('>', i)
      i = end === -1 ? html.length : end + 1
      continue
    }
    // 结束标签
    if (html.startsWith('</', i)) {
      flushText()
      const end = html.indexOf('>', i)
      if (end === -1) break
      const tag = html
        .slice(i + 2, end)
        .trim()
        .split(/\s+/)[0]
        .toLowerCase()
      for (let j = stack.length - 1; j > 0; j--) {
        if (stack[j].tag.toLowerCase() === tag) {
          stack.length = j
          break
        }
      }
      i = end + 1
      continue
    }
    // 开始标签
    flushText()
    const parsed = parseOpenTag(html, i)
    if (!parsed) {
      textBuf += '<'
      i++
      continue
    }
    const { tag, attrs, selfClosing, next } = parsed
    const node: JsxNode = { tag, attrs, children: [] }
    stack[stack.length - 1].children.push(node)
    if (!selfClosing && !VOID_TAGS.has(tag.toLowerCase())) stack.push(node)
    i = next
  }
  flushText()

  // 序列化
  const lines: string[] = []

  /**
   * 把一段已解码文本渲染成 JSX 表达式片段:
   * 含 @@VP_EXPR_n@@(还原成 {code} 表达式)或 @@VP_TXT_n@@(还原成字面
   * 花括号文本,见 markdownToReact 的 maskJsxExpressions),其余仍为字符串
   * 字面量段:{"a "}{expr}{" b"}
   */
  const VP_EXPR_RE = /@@VP_(EXPR|TXT)_(\d+)@@/g
  const textWithExpr = (decoded: string): string => {
    if (!decoded.includes('@@VP_')) return `{${JSON.stringify(decoded)}}`
    VP_EXPR_RE.lastIndex = 0
    const parts: string[] = []
    let last = 0
    let m: RegExpExecArray | null
    let hasExpr = false
    while ((m = VP_EXPR_RE.exec(decoded))) {
      hasExpr = true
      const pre = decoded.slice(last, m.index)
      if (pre) parts.push(`{${JSON.stringify(pre)}}`)
      const entry = expressions[`${Number(m[2])}`]
      if (m[1] === 'EXPR' && entry?.expr != null) {
        parts.push(`{${entry.expr}}`)
      } else if (m[1] === 'TXT' && entry?.literal != null) {
        parts.push(`{${JSON.stringify(entry.literal)}}`)
      } else {
        parts.push(`{${JSON.stringify(m[0])}}`)
      }
      last = m.index + m[0].length
    }
    const tail = decoded.slice(last)
    if (tail) parts.push(`{${JSON.stringify(tail)}}`)
    if (!hasExpr) return `{${JSON.stringify(decoded)}}`
    return parts.join('')
  }

  // 文本一律输出为 {"字符串字面量"} / 表达式段:正文里的 {{ }} / {expr} 默认
  // 永远是字面文本;命中 @@VP_EXPR_n@@ 的段会被还原成 JSX 表达式。
  const renderText = (raw: string, pad: string): string => {
    const decoded = decodeEntities(raw)
    if (!decoded) return ''
    return `${pad}${textWithExpr(decoded)}`
  }
  const renderChildren = (children: (JsxNode | string)[], depth: number) => {
    for (const child of children) {
      if (typeof child === 'string') {
        const l = renderText(child, indent.repeat(depth))
        if (l) lines.push(l)
        continue
      }
      renderNode(child, depth)
    }
  }
  const renderNode = (node: JsxNode, depth: number) => {
    const pad = indent.repeat(depth)
    const rawTag = node.tag
    // 大写开头但不在具名导出集合:JSX 中大写标签必为组件变量(未定义会
    // ReferenceError),不能原样输出 → 渲染为转义文本(语法展示等场景)
    if (COMPONENT_TAG_RE.test(rawTag) && !componentNames.has(rawTag)) {
      warnings.push(
        `unknown component <${rawTag}> (not in <script> named exports); rendered as text`
      )
      const inner = node.children
        .map((c) =>
          typeof c === 'string' ? decodeEntities(c) : `<${c.tag}>…</${c.tag}>`
        )
        .join('')
      lines.push(`${pad}{${JSON.stringify(`<${rawTag}>${inner}</${rawTag}>`)}}`)
      return
    }
    const tag = rawTag
    const nodeTag = tag.toLowerCase()
    const attrParts: string[] = []
    for (const [k, v] of node.attrs) {
      if (typeof v === 'string' && /^on[a-z]/i.test(k)) {
        warnings.push(
          `dropped string event attribute ${k}="…" (JSX events must be functions; use a <script> component)`
        )
        continue
      }
      if (/^[:@]/.test(k)) {
        warnings.push(
          `dropped Vue binding attribute "${k}" (no v-bind/v-on in JSX; use JSX expressions)`
        )
        continue
      }
      const lower = k.toLowerCase()

      // Vue 指令属性(v-pre/v-html/…):JSX 无对应语义,丢弃
      if (lower.startsWith('v-')) {
        warnings.push(
          `dropped Vue directive attribute "${k}" (not applicable in React JSX)`
        )
        continue
      }

      let prop = REACT_ATTR_ALIASES[lower] ?? k

      // SVG/HTML 的 kebab-case 属性 → React 驼峰(如 stroke-width → strokeWidth);
      // data-*/aria-* 必须保持连字符原样
      if (
        lower.includes('-') &&
        !lower.startsWith('data-') &&
        !lower.startsWith('aria-')
      ) {
        prop = lower
          .split('-')
          .map((seg, i) =>
            i === 0 ? seg : seg[0].toUpperCase() + seg.slice(1)
          )
          .join('')
      }

      // 静态 HTML 的受控感属性 → 非受控 default*(无 onChange 时可编辑且不告警)
      if (
        (nodeTag === 'input' || nodeTag === 'option') &&
        lower === 'checked'
      ) {
        attrParts.push('defaultChecked')
        continue
      }
      if (
        (nodeTag === 'select' || nodeTag === 'option') &&
        lower === 'selected'
      ) {
        attrParts.push('defaultSelected')
        continue
      }
      if (
        (nodeTag === 'input' ||
          nodeTag === 'textarea' ||
          nodeTag === 'select') &&
        lower === 'value'
      ) {
        prop = 'defaultValue'
      }

      if (BOOLEAN_PROPS.has(lower)) {
        // 布尔属性:HTML 语义下存在即 true
        attrParts.push(prop)
        continue
      }
      if (v === true) {
        attrParts.push(prop)
        continue
      }
      const value = decodeEntities(String(v))
      if (lower === 'style') {
        const expr = styleExpr(value)
        if (expr) attrParts.push(expr)
        continue
      }
      attrParts.push(`${prop}="${escapeJsxAttr(value)}"`)
    }
    const attrStr = attrParts.length ? ` ${attrParts.join(' ')}` : ''
    if (node.children.length === 0) {
      lines.push(`${pad}<${tag}${attrStr} />`)
      return
    }
    if (
      node.children.length === 1 &&
      typeof node.children[0] === 'string' &&
      !node.children[0].includes('\n')
    ) {
      const decoded = decodeEntities(node.children[0])
      if (decoded.trim() === '') {
        lines.push(`${pad}<${tag}${attrStr} />`)
      } else {
        lines.push(`${pad}<${tag}${attrStr}>${textWithExpr(decoded)}</${tag}>`)
      }
      return
    }
    lines.push(`${pad}<${tag}${attrStr}>`)
    renderChildren(node.children, depth + 1)
    lines.push(`${pad}</${tag}>`)
  }

  lines.push('<div className="vp-doc">')
  renderChildren(root.children, 1)
  lines.push('</div>')

  return { code: lines.join('\n'), warnings }
}
