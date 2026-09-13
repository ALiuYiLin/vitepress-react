// `<script>` 区域的判定规则(唯一定义处)。
//
// 现状:`<script>` 相关判定曾分散在 4 处(旧的区域接管规则、placeholders 的
// setup 正则、buildReactPageModule 的 client 正则、plugin-sfc 内部)。这里
// 收敛成一份,供识别层(regions)、交接层(handoff)与模块组装
// (buildReactPageModule)共用。

/** `<script>` 区域起始(排除 `client`,交给 plugin-sfc 走机器 HTML) */
export const SCRIPT_OPEN_RE = /^ {0,3}<script\b(?![^>]*\bclient\b)[^>]*>/i

/** `<script>` 区域结束(行尾 `</script>`) */
export const SCRIPT_CLOSE_RE = /<\/script>\s*$/

/** `<script client>`(MPA 客户端脚本) */
export const SCRIPT_CLIENT_RE = /<script\b[^>]*\bclient\b[^>]*>/i

/** `<script setup>` 开标签(与 @mdit-vue/plugin-sfc 的语义一致) */
export const SCRIPT_SETUP_OPEN_RE = /^<script\s+.*?\bsetup\b.*?>$/is

export const isScriptSetup = (tagOpen: string): boolean =>
  SCRIPT_SETUP_OPEN_RE.test(tagOpen)

/** 由区域原文拆出 SFC 块字段(形态与 @mdit-vue/plugin-sfc 一致) */
export function toScriptBlock(content: string): {
  type: string
  content: string
  contentStripped: string
  tagOpen: string
  tagClose: string
} {
  const lines = content.split('\n')
  return {
    type: 'script',
    content,
    contentStripped: lines.slice(1, -1).join('\n'),
    tagOpen: (lines[0] ?? '').trim(),
    tagClose: (lines[lines.length - 1] ?? '').trim()
  }
}
