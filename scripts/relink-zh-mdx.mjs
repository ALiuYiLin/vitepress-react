// zh 页面 .md → .mdx 后,把 zh 文档内指向「曾为 zh 内 .md」的站内链接
// 目标扩展名同步为 .mdx(相对链接,保留 hash);代码块内不做(fence 感知)。
// 运行:node scripts/relink-zh-mdx.mjs(仓库根)
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const zhDir = path.join(root, 'docs', 'zh')

// 改名映射:相对 zhDir 的旧路径(.md) → 存在标记
const moved = new Set()
for (const f of fs.readdirSync(zhDir, { recursive: true, encoding: 'utf8' })) {
  if (f.endsWith('.md')) moved.add(f.replaceAll('\\', '/'))
}

function walk(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith('.mdx')) acc.push(p)
  }
  return acc
}

const linkTargetRE = /\]\(([^)]*?\.md)([#?][^)]*)?\)/g
const fenceOpenRE = /^ {0,3}(`{3,}|~{3,})/

let changedFiles = 0
let changedLinks = 0

for (const file of walk(zhDir, [])) {
  const src = fs.readFileSync(file, 'utf8')
  const dir = path.dirname(file)
  const relDir = path.posix.relative(zhDir, dir).replaceAll('\\', '/')
  let inFence = false
  let changed = 0
  const lines = src.split('\n').map((raw) => {
    const trim = raw.trim()
    if (!inFence && fenceOpenRE.test(trim)) {
      inFence = true
      return raw
    }
    if (inFence) {
      if (fenceOpenRE.test(trim)) inFence = false
      return raw
    }
    const next = raw.replace(linkTargetRE, (m, target, suffix) => {
      const clean = target.split(/[#?]/)[0]
      if (/^[a-zA-Z]+:/.test(clean) || clean.startsWith('//')) return m
      const resolved = path.posix.normalize(path.posix.join(relDir, clean))
      if (!moved.has(resolved)) return m
      changed++
      return `](${clean.replace(/\.md$/, '.mdx')}${suffix ?? ''})`
    })
    return next
  })
  if (changed > 0) {
    fs.writeFileSync(file, lines.join('\n') + (src.endsWith('\n') ? '\n' : ''))
    changedFiles++
    changedLinks += changed
    console.log(`${path.relative(zhDir, file).replaceAll('\\', '/')}: ${changed}`)
  }
}
console.log(`files changed: ${changedFiles}, links updated: ${changedLinks}`)
