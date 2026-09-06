// P1b snippet/include 自研件测试(纯文本展开层,不触发 remark-attributes)
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { compileDocument, expandSnippets, parseSnippetPath } from '../src/index'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const opts = { srcDir: fixtures, filePath: path.join(fixtures, 'page.md') }

describe('parseSnippetPath', () => {
  it('剥离 title/lines/attrs/region,保留路径原文', () => {
    expect(parseSnippetPath('@/snippets/snippet.js#snippet{1}')).toEqual({
      filepath: '@/snippets/snippet.js',
      extension: 'js',
      region: 'snippet',
      lines: '1',
      lang: '',
      attrs: '',
      title: 'snippet.js'
    })
  })
  it('meta 含 lang 与 attrs,自定义 title', () => {
    const p = parseSnippetPath('../x/code.js{2-4 js twoslash} [片段标题]')
    expect(p).toMatchObject({
      filepath: '../x/code.js',
      region: '',
      lines: '2-4',
      lang: 'js',
      attrs: 'twoslash',
      title: '片段标题'
    })
  })
})

describe('expandSnippets(字符层)', () => {
  it('@/ 解析 + 内容注入为 fence,lang 取扩展名', async () => {
    const r = await expandSnippets('<<< @/snippets/init.ansi\n', opts)
    expect(r.src).toContain('```ansi')
    expect(r.src).toContain("base: './'")
    expect(r.src.trimEnd().endsWith('```')).toBe(true)
    expect(r.dependencies).toHaveLength(1)
    expect(r.dependencies[0].endsWith('init.ansi')).toBe(true)
  })

  it('region 裁剪 + 去标记 + 去缩进,lines meta 保留在 info', async () => {
    const r = await expandSnippets('<<< @/snippets/snippet.js#snippet{1}\n', opts)
    expect(r.src).toContain('```js {1} [snippet.js]')
    expect(r.src).toContain('const b = 2')
    expect(r.src).toContain('const c = 3')
    expect(r.src).not.toContain('#region')
    expect(r.src).not.toContain('const d = 4')
  })

  it('相对路径解析(filePath 基准)', async () => {
    const r = await expandSnippets('<<< snippets/snippet.js{2}\n', opts)
    expect(r.src).toContain('```js {2} [snippet.js]')
  })

  it('fence 内的 <<< 是代码,不展开', async () => {
    const r = await expandSnippets('```\n<<< @/snippets/init.ansi\n```\n', opts)
    expect(r.src).toContain('<<< @/snippets/init.ansi')
    expect(r.src).not.toContain('base:')
  })

  it('缺失文件:默认抛错,silent 警告输出空', async () => {
    await expect(expandSnippets('<<< @/snippets/nope.js\n', opts)).rejects.toThrow(/not found/)
    const warned: string[] = []
    const r = await expandSnippets('<<< @/snippets/nope.js\n', {
      ...opts,
      silent: true,
      warn: (m) => warned.push(m)
    })
    expect(warned.length).toBeGreaterThan(0)
    expect(r.src).not.toContain('nope.js')
  })
})

describe('compileDocument + snippet/include(端到端)', () => {
  it('snippet 经编译后 code 含注入代码', async () => {
    const r = await compileDocument('示例:\n\n<<< @/snippets/snippet.js#snippet\n', opts)
    expect(r.code).toContain('const b = 2')
    expect(r.code).not.toContain('#region')
    expect(r.dependencies.some((d) => d.endsWith('snippet.js'))).toBe(true)
  })

  it('include: 整段 + 行范围(frontmatter 剥离后行号)', async () => {
    const r = await compileDocument('前文\n\n<!-- @include: ./parts/basics.md{1,1} -->\n\n后文\n', opts)
    expect(r.code).toContain('第一段')
    expect(r.code).not.toContain('第二段')
    expect(r.code).toContain('前文')
    expect(r.code).toContain('后文')
  })

  it('include: frontmatter 剥离 + 完整包含', async () => {
    const r = await compileDocument('<!-- @include: ./parts/basics.md -->\n', opts)
    expect(r.code).not.toContain('片段页')
    expect(r.code).toContain('第一段')
    expect(r.code).toContain('第二段')
  })

  it('include: 循环引用原样保留', async () => {
    // filePath 即被包含文件自身:include 自身 → 展开一层后内部再次命中被保留
    const r = await compileDocument('开头\n<!-- @include: ./basics.md -->\n', {
      ...opts,
      filePath: path.join(fixtures, 'parts', 'basics.md')
    })
    expect(r.code).toContain('开头')
    expect(r.code).toContain('@include') // 循环指令按字面保留
    expect(r.code).not.toContain('第二段') // 未实际展开
  })

  it('include 缺失:silent 空替换 + 警告', async () => {
    const warned: string[] = []
    const r = await compileDocument('<!-- @include: ./parts/nope.md -->\n', {
      ...opts,
      silent: true,
      warn: (m) => warned.push(m)
    })
    expect(warned.length).toBeGreaterThan(0)
    expect(r.code).not.toContain('@include')
  })
})

describe('<Snippet src="…" /> 标签式(remark 树层展开)', () => {
  it('展开为代码:内容注入、无 Snippet 残留、依赖记录', async () => {
    const r = await compileDocument(
      '前文\n\n<Snippet src="@/snippets/snippet.js" />\n\n后文\n',
      opts
    )
    expect(r.code).toContain('const a = 1')
    expect(r.code).toContain('const d = 4')
    expect(r.code).not.toContain('Snippet')
    expect(r.dependencies.some((d) => d.endsWith('snippet.js'))).toBe(true)
  })

  it('region 属性:裁剪 + 去标记 + 去缩进', async () => {
    const r = await compileDocument(
      '<Snippet src="@/snippets/snippet.js" region="snippet" />',
      opts
    )
    expect(r.code).toContain('const b = 2')
    expect(r.code).toContain('const c = 3')
    expect(r.code).not.toContain('const a = 1')
    expect(r.code).not.toContain('const d = 4')
    expect(r.code).not.toContain('#region')
  })

  it('相对路径 src(filePath 基准)', async () => {
    const r = await compileDocument('<Snippet src="snippets/snippet.js" />', opts)
    expect(r.code).toContain('const a = 1')
  })

  it('值可用简单 {expr} 字符串字面量', async () => {
    const r = await compileDocument(
      "<Snippet src={'@/snippets/snippet.js'} />",
      opts
    )
    expect(r.code).toContain('const a = 1')
  })

  it('缺失文件:默认抛错,silent 时删除节点并告警', async () => {
    await expect(
      compileDocument('<Snippet src="@/snippets/nope.js" />', opts)
    ).rejects.toThrow()
    const warned: string[] = []
    const r = await compileDocument('<Snippet src="@/snippets/nope.js" />', {
      ...opts,
      silent: true,
      warn: (m) => warned.push(m)
    })
    expect(warned.length).toBeGreaterThan(0)
    expect(r.code).not.toContain('Snippet')
  })
})
