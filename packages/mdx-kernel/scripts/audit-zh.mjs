// P3 审计:对 docs/zh/**/*.md 全量跑 compileDocument,分类「纯文档页」与
// 「M1 专属语法页」,统计可编译性与首个编译错误,输出 JSON 报告。
// 运行:pnpm --filter @10coding/mdx-kernel exec vite-node --mode=production scripts/audit-zh.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileDocument } from '../src/index'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const docsDir = path.join(root, 'docs')
const zhDir = path.join(docsDir, 'zh')
const outFile = path.join(root, 'temp', 'p3-mdx', 'report.json')

// M1 专属语法启发式:含则不能按纯文档页评估(mdx 语义未覆盖或需迁移)
const M1_ONLY_RE = [
  /<script\b/i, // 页级 script(提取 → D3 迁移)
  /<style\b/i,
  /^:::\s*react\b/m, // react 容器(JSX 原样区域)
  /^:::.*\{[^}]+\}/m, // 容器 attrs 未迁移({…} 大括号写法)
  /data-vp-jsx/,
  /@@VP_/,
  /\{\{[^}]+\}\}/ // {{}} Vue 插值(需移除)
]

function walk(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith('.md') || ent.name.endsWith('.mdx')) acc.push(p)
  }
  return acc
}

function m1Flags(src) {
  const flags = []
  for (const re of M1_ONLY_RE) {
    if (re.test(src)) flags.push(String(re))
  }
  return flags
}

const files = walk(zhDir, [])
const rows = []
let ok = 0
let fail = 0
let pureOk = 0
let pureTotal = 0

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const rel = path.relative(zhDir, file).replaceAll('\\', '/')
  const flags = m1Flags(src)
  const row = { file: rel, m1Flags: flags }
  rows.push(row)

  try {
    const r = await compileDocument(src, { srcDir: docsDir, filePath: file })
    row.title = r.data.title
    row.frontmatter = !!r.data.frontmatter && Object.keys(r.data.frontmatter).length
    row.headers = r.data.headers.length
    ok++
    if (flags.length === 0) pureOk++
  } catch (e) {
    row.error = String(e.message || e).split('\n')[0]
    fail++
  }
  if (flags.length === 0) pureTotal++
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify({ total: files.length, ok, fail, pureTotal, pureOk, rows }, null, 2))

console.log(`total=${files.length} compile-ok=${ok} compile-fail=${fail}`)
console.log(`pure-doc(total,无 M1 专属语法)=${pureTotal} 其中可编译=${pureOk}`)
console.log('--- 编译失败页(全量) ---')
for (const r of rows.filter((r) => r.error)) {
  console.log(`${r.file}\n    ${r.error}`)
}
console.log('--- 纯文档页但编译失败(需重点迁移) ---')
for (const r of rows.filter((r) => r.error && r.m1Flags.length === 0)) {
  console.log(`${r.file}\n    ${r.error}`)
}
console.log('report:', outFile)
