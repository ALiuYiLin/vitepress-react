// 扫描 zh mdx 页残留的旧/未迁移语法;fence 内(教学示例)与正文分开标注。
// 用法:node scripts/scan-zh-remains.mjs(仓库根)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.mdx')) out.push(p)
  }
  return out
}

const files = walk('docs/zh').sort()
const patterns = [
  ['((attrs)) 双括号', /\(\([^()]*\)\)/],
  ['::: react|code-group|github-alert|template|vue', /^:::\s*(react|code-group|github-alert|template|vue)\b/],
  ['正文/教学 <script', /<script/],
  ['github alert > [!..]', /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER|INFO)\]/i],
  [':emoji: 词法', /:[a-zA-Z_+-]{2,}:/],
  ['<Badge/VPBadge 组件', /<\s*(?:VP)?Badge\b/],
  ['裸标题行尾 {#id}', /^#+ .* [^{}\n]*\{[^}]*\}\s*$/],
  ['mustache {{', /\{\{/]
]
let total = 0
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n')
  let inFence = false
  const hits = []
  lines.forEach((ln, i) => {
    if (/^\s*```/.test(ln.trim())) { inFence = !inFence; return }
    for (const [name, re] of patterns) {
      if (re.test(ln)) hits.push({ name, i: i + 1, in: inFence ? 'fence' : 'body', t: ln.trim().slice(0, 88) })
    }
  })
  if (hits.length) {
    console.log(`\n## ${f} (${hits.length})`)
    for (const h of hits) console.log(`  [${h.in}] ${h.name} L${h.i}: ${h.t}`)
    total += hits.length
  }
}
console.log(`\n== 总命中 ${total}(正文 body / 示例 fence) ==`)
