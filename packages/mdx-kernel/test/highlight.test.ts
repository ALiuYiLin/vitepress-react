// 代码高亮(M2):compileDocument 开启 highlight 后,代码块输出与 md-it(M1)
// 同构的 div.language-* 结构(shiki token 着色 + copy/lang + 行号 + meta 行高亮)。
// 注意:remark-attributes 在 vitest(development 条件)下对含 \{\} 源会触发上游
// 断言,本文件用例内容均不含 attrs 形态。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { compileDocument, createCodeHighlighter } from '../src/index'
import type { CodeHighlighter } from '../src/index'

let highlighter: CodeHighlighter

beforeAll(async () => {
  highlighter = await createCodeHighlighter({
    theme: { light: 'github-light', dark: 'github-dark' }
  })
})

afterAll(() => {
  highlighter.dispose()
})

const compile = (src: string, runtime: Record<string, unknown> = {}) =>
  compileDocument(src, {
    srcDir: '.',
    filePath: '/tmp/highlight-test.mdx',
    highlight: { highlighter, runtime }
  })

describe('mdx 代码高亮', () => {
  it('基本高亮:输出 language wrapper + copy/lang + shiki token 着色', async () => {
    const { code } = await compile(
      ['```ts', 'const a: number = 1', 'console.log(a)', '```'].join('\n')
    )
    expect(code).toContain('language-ts')
    expect(code).toContain('className: "copy"')
    expect(code).toContain('className: "lang"')
    // shiki pre(双主题 css 变量)与 token 着色(css 变量样式)
    expect(code).toContain('shiki')
    expect(code).toContain('--shiki-dark')
    expect(code).toMatch(/style:/)
  })

  it('meta 行高亮 {1,3-5} 生效(与 M1 transformerMetaHighlight 语义一致)', async () => {
    const { code } = await compile(
      [
        '```ts {1,3-5}',
        'const a = 1',
        'const b = 2',
        'const c = 3',
        'const d = 4',
        'console.log(a)',
        '```'
      ].join('\n')
    )
    expect(code).toContain('language-ts')
    // transformerMetaHighlight 给命中行加 highlighted class
    expect(code).toMatch(/highlighted/)
  })

  it(':line-numbers meta 输出行号列与 line-numbers-mode', async () => {
    const { code } = await compile(
      ['```ts :line-numbers', 'const x = 1', 'const y = 2', '```'].join('\n')
    )
    expect(code).toContain('line-numbers-mode')
    expect(code).toContain('line-numbers-wrapper')
    expect(code).toContain('line-number')
  })

  it('全局 lineNumbers 默认开启,:no-line-numbers 可逐块关闭', async () => {
    const on = await compile(
      ['```ts', 'const x = 1', '```'].join('\n'),
      { lineNumbers: true }
    )
    expect(on.code).toContain('line-numbers-mode')

    const off = await compile(
      ['```ts :no-line-numbers', 'const x = 1', '```'].join('\n'),
      { lineNumbers: true }
    )
    expect(off.code).not.toContain('line-numbers-mode')
  })

  it('languageLabel / codeCopyButton 透传到 lang 标签与复制按钮', async () => {
    const { code } = await compile(['```vue', '<template />', '```'].join('\n'), {
      languageLabel: { vue: 'Vue SFC' },
      codeCopyButton: { tooltipText: '复制', copiedText: '已复制' }
    })
    expect(code).toContain('Vue SFC')
    expect(code).toContain('"复制"')
    expect(code).toContain('已复制')
  })

  it('不传 highlight 时保持普通代码块(无 shiki/wrapper)', async () => {
    const { code } = await compileDocument(
      ['```ts', 'const x = 1', '```'].join('\n'),
      { srcDir: '.', filePath: '/tmp/highlight-test.mdx' }
    )
    expect(code).not.toContain('shiki')
    expect(code).not.toContain('className: "copy"')
    expect(code).not.toContain('line-numbers-wrapper')
    expect(code).toContain('const x = 1')
  })

  it('code-group 输出 tabs/blocks 结构(radio+label,首块 active)', async () => {
    const src = [
      '::: code-group',
      '',
      '```js [foo.js]',
      'const a = 1',
      '```',
      '',
      '```ts [bar.ts]',
      'const b: number = 2',
      '```',
      '',
      ':::'
    ].join('\n')
    const { code } = await compile(src)
    expect(code).toContain('vp-code-group')
    expect(code).toContain('className: "tabs"')
    expect(code).toContain('blocks')
    // tabs:radio + label(foo.js / bar.ts),第一个 checked
    expect(code).toContain('type: "radio"')
    expect(code).toContain('foo.js')
    expect(code).toContain('bar.ts')
    const firstInput = code.indexOf('defaultChecked: true')
    expect(firstInput).toBeGreaterThan(-1)
    // 首块高亮 wrapper 带 active,两个语言块都渲染
    expect(code).toContain('language-js active')
    expect(code).toContain('language-ts')
    // data 占位残留清除
    expect(code).not.toContain('data-cg-active')
    // 组内块的 [title] 已作 tab 名,不渲染标题条(避免与 tab 重复)
    expect(code).not.toContain('vp-code-block-title')
    // 不再按普通容器渲染
    expect(code).not.toContain('code-group custom-block')
  })

  it('独立 fence 的 [title] 渲染标题条(vp-code-block-title)', async () => {
    const { code } = await compile(
      ['```json [package.json]', '{ "scripts": { "dev": "vitepress" } }', '```'].join('\n')
    )
    expect(code).toContain('vp-code-block-title')
    expect(code).toContain('package.json')
    expect(code).toContain('language-json')
    // 标题条在 shiki pre 之前(children 顺序序列化)
    expect(code.indexOf('vp-code-block-title')).toBeLessThan(
      code.indexOf('shiki')
    )
  })

  it('未启用高亮时 code-group 保持普通容器(无 tabs)', async () => {
    const src = ['::: code-group', '', '```js', 'const a = 1', '```', '', ':::'].join('\n')
    const { code } = await compileDocument(src, {
      srcDir: '.',
      filePath: '/tmp/highlight-test.mdx'
    })
    expect(code).not.toContain('vp-code-group')
    expect(code).toContain('code-group custom-block')
  })
})
