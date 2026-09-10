import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

/**
 * 大小写回归:构建产物在 Windows 上生成时,曾经因为把"路径比较用的
 * normalizePath(会小写)"复用到 emitFile 的 fileName 上,把
 * `VPSidebarGroup.scoped.css` 写成 `vpsidebargroup.scoped.css`,而组件里的
 * 相对导入仍是原大小写。Windows 文件系统不敏感所以本地看不出来,消费方在
 * Linux 上构建时直接 ENOENT(找不到该 css)。
 *
 * 这里按"逐字节比较"的方式校验:目录项名称必须与导入/引用的大小写完全一致。
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

/** 该相对引用在当前文件系统上是否"大小写精确地"存在 */
function resolvesExactly(fromFile: string, specifier: string): boolean {
  const target = path.resolve(
    path.dirname(fromFile),
    specifier.split(/[?#]/)[0]
  )
  const dir = path.dirname(target)
  if (!existsSync(dir)) return false
  return readdirSync(dir).includes(path.basename(target))
}

const distExists = existsSync(distClientDir)

describe.runIf(distExists)('dist asset case sensitivity', () => {
  test('relative css imports in dist js resolve with exact case', () => {
    const problems: string[] = []

    for (const file of walk(distClientDir).filter((f) => f.endsWith('.js'))) {
      const code = readFileSync(file, 'utf8')
      const re =
        /\bfrom\s*['"](\.[^'"]+\.css)['"]|\bimport\s*['"](\.[^'"]+\.css)['"]/g
      for (const match of code.matchAll(re)) {
        const specifier = match[1] ?? match[2]
        if (!specifier) continue
        if (!resolvesExactly(file, specifier)) {
          problems.push(
            `${path.relative(distClientDir, file)} -> ${specifier} (case/file mismatch)`
          )
        }
      }
    }

    expect(problems).toEqual([])
  })

  test('relative url() refs in dist css resolve with exact case', () => {
    const problems: string[] = []

    for (const file of walk(distClientDir).filter((f) => f.endsWith('.css'))) {
      const code = readFileSync(file, 'utf8')
      const re = /url\(\s*['"]?(\.[^'")]+)['"]?\s*\)/g
      for (const match of code.matchAll(re)) {
        const specifier = match[1]
        if (!specifier) continue
        if (!resolvesExactly(file, specifier)) {
          problems.push(
            `${path.relative(distClientDir, file)} -> ${specifier} (case/file mismatch)`
          )
        }
      }
    }

    expect(problems).toEqual([])
  })
})
