// 占位符体系唯一契约源(markdown-it token 级规则与 HTML→JSX 序列化共享)。
// 写入方:markdown/jsxTokenRules.ts(A/B/C token 规则,经 env.jsxStore 写入);
// 读取方:markdown/serializeHtmlToJsx.ts(textWithHtml / data-vp-jsx 哨兵还原)。
// 正文裸 {…} 一律字面文本(V2),占位只承载"作者显式 JSX/HTML 原文"。
// 任何一侧调整 token 格式都必须同步到这里,保证「写入格式 == 读取格式」。

/** 接管占位记录:作者写的 JSX 原文(整行/整块占位,不进入 markdown-it 行内解析) */
export interface PlaceholderEntry {
  html: string
}

/** token 规则与序列化共用的记录数组(下标即占位编号) */
export type PlaceholderStore = PlaceholderEntry[]

/**
 * <script setup> 开标签判定(与 @mdit-vue/plugin-sfc 的
 * SCRIPT_SETUP_TAG_OPEN_REGEXP 语义一致;jsxTokenRules 的 A 规则复用)。
 */
export const SCRIPT_SETUP_TAG_OPEN_RE = /^<script\s+.*?\bsetup\b.*?>$/is

/** 行内 JSX 标签占位 token(token 规则写入,序列化时原样还原) */
export const htmlToken = (n: number) => `@@VP_HTML_${n}@@`

/** 行内 JSX 占位 token 前缀(快速短路判断用) */
export const VP_HTML_TOKEN_MARKER = '@@VP_HTML_'

/** 行内 JSX 占位全局正则(带 /g;调用方负责 lastIndex 复位或交给 replace) */
export const VP_HTML_TOKEN_GLOBAL_RE = /@@VP_HTML_(\d+)@@/g

/**
 * 块级 JSX 占位(替换 `::: react` 容器、独立标签块与整段 Fragment):
 * markdown-it 视作 html_block,不会包进 <p>;序列化器按 data-vp-jsx 哨兵
 * 还原原文。
 */
export const jsxBlockPlaceholder = (n: number) =>
  `<div data-vp-jsx="${n}"></div>`

/** 块级 JSX 占位的哨兵属性名(写入方与序列化读取方共用) */
export const DATA_VP_JSX_ATTR = 'data-vp-jsx'
