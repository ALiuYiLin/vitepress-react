import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

/**
 * 选择器宏回归:构建产物里**不允许**残留 `:global(...)` / `:deep(...)`。
 *
 * 这两种写法是给 @10coding/postcss-jsx-scoped 的宏,必须在构建期展开成普通
 * 选择器;一旦泄漏进 CSS(历史上出现过:本仓库的字符串补丁没覆盖 @media 里的
 * 混合规则;上游插件也会漏掉"一条选择器里的第二个宏"),浏览器会把它当无效
 * 选择器整条丢弃,lightningcss minify 还会报
 * "'global' is not a recognized pseudo-class"。
 */

const distClientDir = fileURLToPath(
  new URL('../../../dist/client', import.meta.url)
)

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

describe.runIf(existsSync(distClientDir))('dist scoped css macros', () => {
  test('no :global() / :deep() selector survives into dist css', () => {
    const offenders: string[] = []

    for (const file of walk(distClientDir).filter((f) => f.endsWith('.css'))) {
      // 先剥掉块注释(说明性文字里提到宏是允许的),再逐行找残留
      const stripped = readFileSync(file, 'utf8').replace(
        /\/\*[\s\S]*?\*\//g,
        ''
      )
      stripped.split('\n').forEach((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return
        if (/:global\(|:deep\(/.test(trimmed)) {
          offenders.push(
            `${path.relative(distClientDir, file)}:${i + 1} ${trimmed}`
          )
        }
      })
    }

    expect(offenders).toEqual([])
  })

  test('scoped css keeps its data-v attribute or is intentionally global', () => {
    // 抽查:VPNavBarTitle 的 `:global(.VPNavBarTitle.has-sidebar)` 应展开成无属性
    // 的全局选择器;同文件普通规则仍带 data-v
    const file = path.join(
      distClientDir,
      'theme-default/styles/components/vpnavbartitle.scoped.css'
    )
    if (!existsSync(file)) return
    const css = readFileSync(file, 'utf8')
    expect(css).toContain('.VPNavBarTitle.has-sidebar {')
    expect(css).not.toMatch(/\.VPNavBarTitle\.has-sidebar\[data-v-/)
    expect(css).toMatch(/\.title\[data-v-[\w-]+\]/)
  })
})
