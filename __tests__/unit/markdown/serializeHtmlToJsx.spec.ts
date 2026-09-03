// serializeHtmlToJsx 关键行为单测(M1 md 管线核心,React 适配面)
import { describe, expect, it } from 'vitest'

import {
  extractComponentNames,
  serializeHtmlToJsx
} from '../../../src/node/markdown/serializeHtmlToJsx'

const round = (html: string, names: string[] = []) =>
  serializeHtmlToJsx(html, new Set(names)).code

describe('serializeHtmlToJsx', () => {
  it('always renders text as string literals so {{ }} stays literal', () => {
    const code = round('<p>{{ count }} 和 {expr} 均原样</p>')
    expect(code).toContain('{"{{ count }} 和 {expr} 均原样"}')
    expect(code).not.toContain('{count')
  })

  it('maps class to className and common attrs to React names', () => {
    const code = round('<div class="box" tabindex="0" for="x">hi</div>')
    expect(code).toContain('className="box"')
    expect(code).toContain('tabIndex="0"')
    expect(code).toContain('htmlFor="x"')
    expect(code).not.toContain('class="')
  })

  it('turns style strings into style objects (camelCased keys)', () => {
    const code = round('<p style="color:red;background-color:#fff;font-size:12px">t</p>')
    expect(code).toContain('style={{ "color": "red"')
    expect(code).toContain('"backgroundColor": "#fff"')
    expect(code).toContain('"fontSize": "12px"')
  })

  it('emits boolean attributes bare', () => {
    const code = round('<input disabled checked>')
    expect(code).toContain('<input disabled checked')
    expect(code).not.toContain('disabled="')
  })

  it('self-closes void tags', () => {
    const code = round('<img src="a.png" alt="x"><br>')
    expect(code).toContain('<img src="a.png" alt="x" />')
    expect(code).toContain('<br />')
  })

  it('decodes html entities in text and attributes', () => {
    const code = round('<p title="a &amp; b">c &lt; d &#8203;</p>')
    expect(code).toContain('"c < d \u200b"')
    expect(code).toContain('title="a &amp; b"')
  })

  it('resolves uppercase tags listed in componentNames as components', () => {
    const code = round('<Counter /><span>keep</span>', ['Counter'])
    expect(code).toContain('<Counter />')
  })

  it('degrades unknown uppercase tags to escaped text with a warning', () => {
    const { code, warnings } = serializeHtmlToJsx(
      '<UnknownTag>x</UnknownTag>',
      new Set()
    )
    expect(code).toContain(JSON.stringify('<UnknownTag>x</UnknownTag>'))
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('wraps output in a vp-doc div', () => {
    const code = round('<h1>t</h1>')
    expect(code.startsWith('<div className="vp-doc">')).toBe(true)
    expect(code.endsWith('</div>')).toBe(true)
  })

  it('tolerates unclosed tags', () => {
    const code = round('<p>a<div>b')
    expect(code).toContain('"a"')
    expect(code).toContain('"b"')
  })
})

describe('extractComponentNames', () => {
  it('collects exported component-ish identifiers from top-level code', () => {
    const names = extractComponentNames(
      [
        'import { useState } from "react"',
        'export function Counter() {}',
        'export const Badge = () => null',
        'const hidden = 1',
        'export { A as Alias, B }',
        'import Default from "x"',
        'import * as Star from "y"'
      ].join('\n')
    )
    expect(names).toContain('Counter')
    expect(names).toContain('Badge')
    expect(names).toContain('Alias')
    expect(names).toContain('B')
    expect(names).toContain('Default')
    expect(names).toContain('Star')
    expect(names).not.toContain('hidden')
  })
})
