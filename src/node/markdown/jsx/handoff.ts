// 交接层:区域原文交给谁(SFC / JSX store),以及"唯一占位出口"。
//
// - collectRegion:识别层产出 token 后立刻调用,把原文落到 env 上
//   (`sink: 'sfc'` → env.sfcBlocks;`sink: 'jsx'` → env.jsxStore + meta.jsxIndex)。
//   因为发生在规则内、按源码顺序,store 下标天然等于源码顺序。
// - registerRegionRenderer:renderer 规则,把区域 token 变成占位符。
//   `placeholders.ts` 只被这一个文件 import。

import type Token from 'markdown-it/lib/token.mjs'
import type { MarkdownItAsync } from 'markdown-it-async'

import type { MarkdownEnv } from '../../shared'
import { jsxBlockPlaceholder, jsxInlinePlaceholder } from '../placeholders'
import type { RegionMeta, RegionRule } from './regions'
import { isScriptSetup, toScriptBlock } from './scriptTags'

type SfcBlocks = NonNullable<MarkdownEnv['sfcBlocks']>
type SfcScriptBlock = SfcBlocks['scripts'][number]

const emptySfcBlocks = (): SfcBlocks => ({
  template: null,
  script: null,
  scriptSetup: null,
  scripts: [],
  styles: [],
  customBlocks: []
})

/**
 * 按 `rule.sink` 分派区域原文。
 * 块级区域带一行 `JSX md:<行号>` 的 JSX 注释前缀,便于 oxc 报错时回到源 md 行。
 */
export function collectRegion(
  env: MarkdownEnv,
  token: Token,
  meta: RegionMeta,
  rule: RegionRule
): void {
  if (rule.sink === 'sfc') {
    const sfc = (env.sfcBlocks ??= emptySfcBlocks())
    const block = toScriptBlock(token.content) as SfcScriptBlock
    sfc.scripts.push(block)
    if (isScriptSetup(block.tagOpen)) sfc.scriptSetup = block
    else sfc.script = block
    return
  }

  const store = (env.jsxStore ??= [])
  const index = store.length
  store.push({
    html:
      meta.placement === 'block' && meta.line > 0
        ? `{/* JSX md:${meta.line} */}\n${token.content}`
        : token.content
  })
  meta.jsxIndex = index
}

/** 占位符的唯一出口(格式见 ../placeholders:带 nonce 的元素哨兵) */
export function registerRegionRenderer(md: MarkdownItAsync): void {
  md.renderer.rules.vp_jsx_inline = (tokens, idx) =>
    jsxInlinePlaceholder((tokens[idx].meta as RegionMeta).jsxIndex!)
  md.renderer.rules.vp_jsx_block = (tokens, idx) =>
    jsxBlockPlaceholder((tokens[idx].meta as RegionMeta).jsxIndex!)
  md.renderer.rules.vp_script = () => ''
}
