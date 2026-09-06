// P3 采样:对代表纯文档页输出 mdx 编译语义要点(headers 树/容器/表格/产物特征),
// 供与 md-it 版页面(M1 基线)人工对照。运行同 audit-zh.mjs。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileDocument } from '../src/index'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const docsDir = path.join(root, 'docs')

const pages = [
  'zh/guide/markdown.md',
  'zh/guide/frontmatter.md',
  'zh/reference/default-theme-badge.md'
]

const counts = (code, re) => (code.match(re) ?? []).length

for (const rel of pages) {
  const file = path.join(docsDir, rel)
  if (!fs.existsSync(file)) {
    console.log(`== ${rel} (不存在,跳过)`)
    continue
  }
  const src = fs.readFileSync(file, 'utf8')
  try {
    const { code, data } = await compileDocument(src, { srcDir: docsDir, filePath: file })
    const classes = [...new Set((code.match(/className: "([^"]*custom-block[^"]*)"/g) ?? []).map((s) => s.slice(13, -1)))]
    console.log(`\n== ${rel}`)
    console.log(`title=${JSON.stringify(data.title)} fm=${JSON.stringify(Object.keys(data.frontmatter))}`)
    const flat = []
    const walk = (h, d) => { flat.push(`${'  '.repeat(d)}h${h.level} ${h.slug} | ${h.title}`); (h.children ?? []).forEach((c) => walk(c, d + 1)) }
    data.headers.forEach((h) => walk(h, 0))
    console.log(`headers(${data.headers.length} 根):`)
    flat.forEach((l) => console.log('  ' + l))
    console.log(`容器 class: ${classes.length ? classes.join(' | ') : '(无)'}`)
    console.log(`custom-block-title=${counts(code, /custom-block-title/g)} summary=${counts(code, /tagName: 'summary'|tagName: "summary"/g)} table=${counts(code, /_components\.table|tagName: ['"]table['"]/g)}`)
    console.log(`h2 产物=${counts(code, /children: 'h2'|"h2"/g)} code 元素=${counts(code, /tagName: ['"]code['"]/g)}`)
  } catch (e) {
    console.log(`\n== ${rel}\n[ERR] ${String(e.message || e).split('\n')[0]}`)
  }
}
