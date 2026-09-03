import type { VpBlock } from '../lib/vp-data'

// 把 vp-data 中的 blocks 渲染为文档正文(带锚点 id,大纲据此滚动侦测)

function Code({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border bg-muted/50 text-sm">
      <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-1.5 font-mono text-xs text-muted-foreground">
        <span>{lang || 'text'}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function RenderBlocks({ blocks }: { blocks: VpBlock[] }) {
  let row = 0
  return (
    <div className="max-w-none">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const Tag = b.level === 2 ? 'h2' : 'h3'
          return (
            <Tag
              key={i}
              id={b.id}
              className={
                b.level === 2
                  ? 'mt-10 mb-4 scroll-mt-28 text-2xl font-bold tracking-tight first:mt-0'
                  : 'mt-8 mb-3 scroll-mt-28 text-lg font-semibold tracking-tight'
              }
            >
              {b.text}
            </Tag>
          )
        }
        if (b.type === 'p') {
          return (
            <p key={i} className="my-4 leading-7 text-foreground/90">
              {b.text}
            </p>
          )
        }
        if (b.type === 'list') {
          return (
            <ul
              key={i}
              className="my-4 list-disc space-y-2 pl-6 text-foreground/90 marker:text-muted-foreground"
            >
              {b.items.map((it, j) => (
                <li key={j} className="leading-7">
                  {it}
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'code') {
          return <Code key={i} lang={b.lang} code={b.code} />
        }
        if (b.type === 'table') {
          return (
            <div key={i} className="my-5 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {b.head.map((h, j) => (
                      <th
                        key={j}
                        className="px-4 py-2.5 text-left font-semibold text-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr
                      key={ri}
                      className={`border-b last:border-0 ${
                        row++ % 2 === 1 ? 'bg-muted/30' : ''
                      }`}
                    >
                      {r.map((cell, ci) => (
                        <td key={ci} className="px-4 py-2 text-foreground/90">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
