import { describe, it, expect } from 'vitest'
import { compileDocument } from '../src/index'

describe('compileDocument: attrs(转义语法)', () => {
  // attrs 正向语义(标题 id/块 class/链接属性注入、headers 采集联动)
  // 在 scripts/smoke-attrs.mjs 用 tsx 生产语义验证(见 vitest.config.ts 注释)。
  // vitest 下 remark-attributes 触发上游 micromark 断言缺陷,故此处仅保留不触发的用例。

  it('裸 {#x} 被 MDX 当表达式 → 编译报错(v1 需手动转义)', async () => {
    await expect(compileDocument('# 标题 {#t1}\n')).rejects.toThrow()
  })

  it('fence / 行内码内的 {…} 不受影响(字面示例)', async () => {
    const { code } = await compileDocument('```js\nconst x = {#literal: true}\n```\n\n`{#code}` 字面\n')
    expect(code).toContain('{#literal: true}')
    expect(code).toContain('{#code}')
  })
})

describe('compileDocument: frontmatter 与 title', () => {
  it('frontmatter 被采集且暴露为 export const frontmatter', async () => {
    const { code, data } = await compileDocument(
      '---\ntitle: Hello\nsidebar: false\norder: 3\n---\n\n# Body\n'
    )
    expect(data.frontmatter).toMatchObject({ title: 'Hello', sidebar: false, order: 3 })
    expect(data.title).toBe('Hello')
    expect(code).toContain('export const frontmatter =')
  })

  it('无 frontmatter.title 时回退到首个 h1', async () => {
    const { data } = await compileDocument('# 第一个标题\n\n## 小节\n')
    expect(data.title).toBe('第一个标题')
    expect(data.frontmatter).toEqual({})
  })

  it('无 h1/frontmatter 时 title 为空串', async () => {
    const { data } = await compileDocument('普通段落\n')
    expect(data.title).toBe('')
  })
})

describe('compileDocument: headers 大纲树', () => {
  it('h2 > h3 嵌套,新 h2 回到顶层;h1 不进大纲', async () => {
    const { data } = await compileDocument(
      '# 页标题\n\n## A\n\n### A1\n\n## B\n\n#### B1\n'
    )
    expect(data.headers.map((h) => h.title)).toEqual(['A', 'B'])
    expect(data.headers[0].children?.map((h) => h.title)).toEqual(['A1'])
    expect(data.headers[1].children?.[0]).toMatchObject({ level: 4, title: 'B1' })
  })

  it('无 slug 插件的标题由 rehype-slug 生成 id', async () => {
    const { code, data } = await compileDocument('## Quick Start\n')
    expect(code).toMatch(/"h2"/)
    expect(data.headers[0].slug).toBeTruthy()
  })
})

describe('compileDocument: math 与 gfm', () => {
  it('inline/block math 出 katex', async () => {
    const { code } = await compileDocument('欧拉 $e^{i\\pi}+1=0$\n\n$$\\int_0^1 x\\,dx = \\frac12$$\n')
    expect(code).toContain('katex')
  })

  it('gfm 表格渲染', async () => {
    const { code } = await compileDocument('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
    expect(code).toContain('"table"')
  })
})

describe('compileDocument: 关闭开关', () => {
  it('gfm:false 时表格按普通文本', async () => {
    const { code } = await compileDocument('| a | b |\n| --- | --- |\n| 1 | 2 |\n', { gfm: false })
    expect(code).not.toContain('"table"')
  })

  it('math:false 不引 katex', async () => {
    const { code } = await compileDocument('$a+b$\n', { math: false })
    expect(code).not.toContain('katex')
  })
})

describe('compileDocument: scopeAttr(markdownScopedCss 宿主注入)', () => {
  it('scopeAttr 注入到产物所有元素(标题/段落/代码占位)', async () => {
    const { code } = await compileDocument(
      '# 标题\n\n正文段落 **粗**\n\n```ts\nconst x = 1\n```\n',
      { scopeAttr: 'data-v-abc123', srcDir: '.', filePath: '/tmp/scope-test.mdx' }
    )
    expect(code).toContain('data-v-abc123')
    const first = code.indexOf('data-v-abc123')
    expect(first).toBeGreaterThan(-1)
    // 标题与代码块占位 pre 都被注入(计数>=3:h1/p/pre)
    expect(code.match(/data-v-abc123/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('不传 scopeAttr 不注入 data-v-*', async () => {
    const { code } = await compileDocument('段落正文\n')
    expect(code).not.toContain('data-v-')
  })
})
