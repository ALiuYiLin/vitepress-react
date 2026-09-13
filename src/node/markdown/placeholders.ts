// 占位符体系唯一契约源(区域识别层的交接输出与 HTML→JSX 序列化共享)。
// 写入方:markdown/jsx/handoff.ts(renderer 规则);
// 读取方:markdown/serializeHtmlToJsx.ts(textWithHtml / 哨兵展开)。
// 正文裸 {…} 一律字面文本(V2),占位只承载"作者显式 JSX 原文"。
//
// 占位符是**元素哨兵**:
//   行内 <span data-vp-jsx="<nonce>:n"></span>
//   块级 <div  data-vp-jsx="<nonce>:n"></div>
//
// 两个设计点:
// 1. 用元素而不是文本 marker(旧的 `@@VP_HTML_n@@`):元素只在**已解析的 HTML
//    结构**上被识别,因此作者正文/代码块里写的同名字面量不会被误当成占位符
//    (文本 marker 是在 decodeEntities 之后做正则匹配,会被伪造/碰撞)。
// 2. 属性值带**进程级 nonce**:序列化器只认自己发出的 nonce,于是作者手写的
//    `<span data-vp-jsx="0">`(raw HTML 路径)也不会被当成占位符。
// 任何一侧调整格式都必须同步到这里,保证「写入格式 == 读取格式」。

/** 接管占位记录:作者写的 JSX 原文(整行/整块占位,不进入 markdown-it 行内解析) */
export interface PlaceholderEntry {
  html: string
}

/** 区域识别层与序列化共用的记录数组(下标即占位编号) */
export type PlaceholderStore = PlaceholderEntry[]

/** 哨兵属性名(写入方与序列化读取方共用) */
export const DATA_VP_JSX_ATTR = 'data-vp-jsx'

/** 本次构建(进程)的 nonce:序列化器只展开带它的哨兵 */
export const VP_JSX_NONCE = Math.random().toString(36).slice(2, 12)

const markerValue = (n: number) => `${VP_JSX_NONCE}:${n}`

/** 行内 JSX 占位:元素哨兵,序列化时就地展开原文 */
export const jsxInlinePlaceholder = (n: number) =>
  `<span ${DATA_VP_JSX_ATTR}="${markerValue(n)}"></span>`

/**
 * 块级 JSX 占位(替换 `::: react` 容器、独立标签块与整段 Fragment):
 * markdown-it 视作 html_block,不会包进 <p>。
 */
export const jsxBlockPlaceholder = (n: number) =>
  `<div ${DATA_VP_JSX_ATTR}="${markerValue(n)}"></div>`

/** 读取哨兵属性值:不是本进程 nonce 发出的哨兵返回 null */
export function parseJsxPlaceholder(
  value: string | boolean | undefined
): number | null {
  if (typeof value !== 'string') return null
  const prefix = `${VP_JSX_NONCE}:`
  if (!value.startsWith(prefix)) return null
  const raw = value.slice(prefix.length)
  return /^\d+$/.test(raw) ? Number(raw) : null
}
