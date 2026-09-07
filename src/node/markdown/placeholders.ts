// 占位符体系唯一契约源(md 预处理与 HTML→JSX 序列化共享)。
// 由 markdownToReact.ts 重构拆分而来;V2 契约(见根目录 MD-DYNAMIC-SYNTAX-V2.md)
// 下只剩 **HTML/JSX 区域占位** 一类:
//   - 写入方:markdown/jsxMasking.ts(maskScriptBlocks / maskJsxHtmlLines);
//   - 读取方:markdown/serializeHtmlToJsx.ts(textWithExpr / data-vp-jsx 哨兵还原)。
// 正文裸 {…} 一律字面文本(V2),不再有 EXPR 表达式占位。
// 任何一侧调整 token 格式都必须同步到这里,保证「写入格式 == 读取格式」。

/** mask 阶段每一条占位记录:作者写的 JSX 标签原文(整行/整块占位,不进入 markdown-it) */
export interface PlaceholderEntry {
  html: string
}

/** maskScriptBlocks / maskJsxHtmlLines 共用的记录数组(下标即占位编号) */
export type PlaceholderStore = PlaceholderEntry[]

/**
 * <script> 块占位 key(mask 时写入 `<script setup>` 三行包裹,
 * 渲染后 restoreMaskedScripts 依此把 sfcBlocks.contentStripped 还原为真代码)。
 */
export const scriptBlockKey = (n: number) => `__VP_SCRIPT_BLOCK_${n}__`

/** <script> 占位 key 判定(restore 还原 与 maskJsxHtmlLines 跳过共用) */
export const SCRIPT_BLOCK_KEY_RE = /^__VP_SCRIPT_BLOCK_\d+__$/

/** 行内 JSX 标签占位 token(maskJsxHtmlLines 写入,序列化时原样还原) */
export const htmlToken = (n: number) => `@@VP_HTML_${n}@@`

/** 行内 JSX 占位 token 前缀(快速短路判断用) */
export const VP_HTML_TOKEN_MARKER = '@@VP_HTML_'

/** 行内 JSX 占位全局正则(带 /g;调用方负责 lastIndex 复位或交给 replace) */
export const VP_HTML_TOKEN_GLOBAL_RE = /@@VP_HTML_(\d+)@@/g

/**
 * 块级 JSX 占位(替换 `::: react` 容器与独立成行的标签块):markdown-it
 * 视作 html_block,不会包进 <p>;序列化器按 data-vp-jsx 哨兵还原原文。
 */
export const jsxBlockPlaceholder = (n: number) =>
  `<div data-vp-jsx="${n}"></div>`

/** 块级 JSX 占位的哨兵属性名(写入方与序列化读取方共用) */
export const DATA_VP_JSX_ATTR = 'data-vp-jsx'
