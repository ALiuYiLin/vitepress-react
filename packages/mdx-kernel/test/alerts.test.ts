// github-flavored-alerts + emoji(M2 内核):blockquote 首行 > [!TYPE] 转
// 容器(custom-block,标题缺省大写或同行自定义);:emoji: 转字符(fence/
// 行内码保持字面)。用例内容不含 attrs 形态(避开 remark-attributes 在
// vitest development 条件下的上游断言)。
import { describe, it, expect } from 'vitest'

import { compileDocument } from '../src/index'

const compile = (src: string) =>
  compileDocument(src, { srcDir: '.', filePath: '/tmp/alerts-test.mdx' })

describe('github-flavored alerts', () => {
  it('> [!NOTE] 转容器:类型 class + github-alert + 缺省标题', async () => {
    const { code } = await compile('> [!NOTE]\n> 需要用户注意的内容。\n')
    expect(code).toContain('className: "note custom-block github-alert"')
    expect(code).toContain('custom-block-title-default')
    expect(code).toContain('"NOTE"')
    expect(code).toContain('需要用户注意的内容')
    expect(code).not.toContain('[!NOTE]')
  })

  it('同行自定义标题 > [!WARNING] 标题', async () => {
    const { code } = await compile('> [!WARNING] 自定义警示\n> 小心。\n')
    expect(code).toContain('className: "warning custom-block github-alert"')
    expect(code).toContain('自定义警示')
  })

  it('容器内代码块保留;普通 blockquote 不受影响', async () => {
    const { code } = await compile(
      [
        '> [!TIP]',
        '> ```ts',
        '> const x = 1',
        '> ```',
        '',
        '> 普通引用',
        ''
      ].join('\n')
    )
    expect(code).toContain('className: "tip custom-block github-alert"')
    expect(code).toContain('const x = 1')
    expect(code).toContain('普通引用')
  })
})

describe('emoji(:gemoji:)', () => {
  it('正文 :tada: :100: 转为 emoji 字符;行内码与 fence 保持字面', async () => {
    const { code } = await compile(
      [
        'emoji::tada: :100:',
        '',
        '```md',
        ':tada:',
        '```',
        '',
        '行内码 `:tada:` 保持'
      ].join('\n')
    )
    expect(code).toContain('emoji:')
    expect(code).toContain('🎉')
    expect(code).toContain('💯')
    // fence 内字面保留(教学源码)
    expect(code).toContain('":tada:"')
  })
})
