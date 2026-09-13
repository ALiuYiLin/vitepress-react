// 作者 JSX / `<script>` 区域识别层的对外入口。
//
// 注册顺序:识别规则(regions)→ 交接输出(handoff)。
// 顺序约束只有三个锚点,详见 ./regions 与 design/jsxRegions.md §7。

import type { MarkdownItAsync } from 'markdown-it-async'

import { registerRegionRenderer } from './handoff'
import { registerRegionRules, type RegionOptions } from './regions'

export type {
  EndStrategy,
  RegionKind,
  RegionMeta,
  RegionOptions as JsxRegionOptions,
  RegionPlacement,
  RegionRule
} from './regions'
export { REGION_RULES } from './regions'

/**
 * 挂载区域识别规则与占位输出。
 *
 * @param options.authorTags 作者标签(HTML 标签 / 组件标签)是否按 JSX 接管
 * @param options.fragment   `<>…</>` 是否按 JSX 接管
 * @param options.script     `<script>`(非 client)是否捕获进 env.sfcBlocks
 * @param options.container  `::: react` 原始容器是否接管
 */
export function applyJsxRegions(
  md: MarkdownItAsync,
  options: RegionOptions = {}
): void {
  registerRegionRules(md, {
    script: options.script !== false,
    authorTags: options.authorTags !== false,
    fragment: options.fragment !== false,
    container: options.container !== false
  })
  registerRegionRenderer(md)
}
