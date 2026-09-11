import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

import { resolveConfig } from '../../../src/node/config'
import { disposeMdItInstance } from '../../../src/node/markdown/markdown'
import { createMarkdownToReactRenderFn } from '../../../src/node/markdownToReact'

// 语义契约(jsxTokenRules 的 D 规则):作者在 md 正文里写的标签
// (HTML 标签 / 组件标签 / <></>)就是 **JSX 元素**,一律原样交给 React;
// 属性按 React JSX 语法写。只有 md 层自己生成的 HTML(attrs {.class}、锚点、
// 容器、Shiki…)才在序列化时做属性转换。
//
// 背景:markdown-it 的 inline HTML 语法不接受"未加引号且含空格的属性值"
// (如 `onClick={() => …}`),这类作者标签不会被 token 化,旧的"纯 HTML 段落/
// HTML 块"判定接管不到 → 退化成字面文本(还会丢掉闭合标签)。D 规则用自带的
// 括号感知扫描器切出整段元素,不再依赖 md-it 的 HTML 语法。

async function renderReact(src: string) {
  const root = await mkdtemp(join(tmpdir(), 'vpr-authtag-'))
  try {
    const mdPath = join(root, 'page.md')
    await mkdir(join(root, '.vitepress-react'))
    await writeFile(
      join(root, '.vitepress-react', 'config.ts'),
      `export default { title: 'T' }`
    )
    await writeFile(mdPath, src)
    disposeMdItInstance()
    const siteConfig = await resolveConfig(root, 'build', 'production')
    const render = await createMarkdownToReactRenderFn(
      siteConfig.srcDir,
      siteConfig.markdown ?? {},
      '/',
      false,
      false,
      siteConfig
    )
    const result = await render(await readFile(mdPath, 'utf-8'), mdPath)
    return (result as any).reactSrc as string
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const fm = ['---', 'title: t', '---', ''].join('\n')

/** 只看 page 渲染体,压掉换行缩进便于断言 */
const page = (code: string) => {
  const i = code.indexOf('<div className="vp-doc">')
  return code.slice(i).replace(/\s*\n\s*/g, ' ')
}

describe('author tags are handed to React as JSX', () => {
  test('整行 HTML 标签 + 箭头函数属性(曾经退化为字面文本)', async () => {
    const out = page(
      await renderReact(
        [fm, '<button onClick={() => setCount(count + 1)}>+1</button>'].join(
          '\n'
        )
      )
    )
    expect(out).toContain(
      '<button onClick={() => setCount(count + 1)}>+1</button>'
    )
    // 整行元素按块级接管,不被包进 <p>
    expect(out).not.toContain('<p><button')
  })

  test('行内混排:文字 + 元素 + 文字', async () => {
    const out = page(
      await renderReact(
        [
          fm,
          '前 <button onClick={() => setCount(count + 1)}>+1</button> 后'
        ].join('\n')
      )
    )
    expect(out).toContain('{"前 "}')
    expect(out).toContain(
      '<button onClick={() => setCount(count + 1)}>+1</button>'
    )
    expect(out).toContain('{" 后"}')
  })

  test('组件属性里的箭头函数不被截断', async () => {
    const out = page(
      await renderReact(
        [
          fm,
          '<script>',
          'const Counter = () => <button>+1</button>',
          'export { Counter }',
          '</script>',
          '',
          '<Counter initial={n => n + 1} />'
        ].join('\n')
      )
    )
    expect(out).toContain('<Counter initial={n => n + 1} />')
    expect(out).not.toContain('initial="{n"')
  })

  test('属性里的比较表达式 / 对象字面量 / 模板字符串', async () => {
    expect(
      page(
        await renderReact(
          [fm, '<Badge type={a > b ? "tip" : "info"} text="new" />'].join('\n')
        )
      )
    ).toContain('<Badge type={a > b ? "tip" : "info"} text="new" />')

    expect(
      page(
        await renderReact(
          [fm, '<div style={{ color: "red" }}>x</div>'].join('\n')
        )
      )
    ).toContain('<div style={{ color: "red" }}>x</div>')

    expect(
      page(await renderReact([fm, '<span title={`a > b`}>x</span>'].join('\n')))
    ).toContain('<span title={`a > b`}>x</span>')
  })

  test('嵌套元素整段交给 React', async () => {
    const out = page(
      await renderReact(
        [fm, '<div class="a"><span>内层 <b>粗</b></span></div>'].join('\n')
      )
    )
    expect(out).toContain('<div class="a"><span>内层 <b>粗</b></span></div>')
  })

  test('行内 HTML 回归:简单标签仍正常渲染', async () => {
    expect(
      page(await renderReact([fm, '文字 <b>粗</b> 结束'].join('\n')))
    ).toContain('<b>粗</b>')
  })

  test('Vue 写法不接管(仍走告警/丢弃路径)', async () => {
    const directive = page(
      await renderReact([fm, '<div :class="x">y</div>'].join('\n'))
    )
    expect(directive).not.toContain(':class="x"')
    expect(directive).toContain('{"y"}')

    const mustache = page(
      await renderReact([fm, '<div>{{ msg }}</div>'].join('\n'))
    )
    expect(mustache).toContain('{{ msg }}')
  })

  test('不成对 / 非标签文本不接管', async () => {
    const broken = page(
      await renderReact([fm, '<div class="probe">未闭合'].join('\n'))
    )
    expect(broken).toContain('未闭合')

    const math = page(await renderReact([fm, 'a < b 且 3 <4'].join('\n')))
    expect(math).toContain('{"a < b 且 3 <4"}')
  })
})
