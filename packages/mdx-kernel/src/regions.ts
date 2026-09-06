// 区段工具(复制自 vitepress-react src/node/markdown/regions.ts,语义一致):
// 识别 VS Code folding markers 风格的多语言 region 标记、去标记行、公共缩进去缩进。
export interface RegionMarker {
  start: RegExp
  end: RegExp
}

export interface Region {
  start: number
  end: number
  marker: RegionMarker
}

// cheap pre-filter so the marker regexes only run on candidate lines
const maybeMarkerRE = /region/i
const quotedRE = /^"(.*)"$/

function unquote(name: string) {
  return quotedRE.exec(name)?.[1] ?? name
}

export const markers: RegionMarker[] = [
  // line comments: js, ts, go, rust, java and json with comments, whose
  // markers make the hash optional, plus sql and bat, which require it
  {
    start: /^\s*(?:\/\/\s*#?|(?:--|::|@?[rR][eE][mM])\s*#)region\b\s*(.*?)\s*$/,
    end: /^\s*(?:\/\/\s*#?|(?:--|::|@?[rR][eE][mM])\s*#)endregion\b\s*(.*?)\s*$/
  },
  // hash comments: c# and coffeescript (`#region`), python, yaml and shell
  // (`# region`, and `# #region` in shell), visual basic (`#Region` closed by
  // `#End Region`), powershell (`#EndRegion`) and c/c++ (`#pragma region`)
  {
    start: /^\s*#\s*(?:#\s*|pragma\s+)?[rR]egion\b\s*(.*?)\s*$/,
    end: /^\s*#\s*(?:#\s*|pragma\s+)?[eE]nd ?[rR]egion\b\s*(.*?)\s*$/
  },
  // markdown (hash optional) and html (hash required), vue templates
  {
    start: /^\s*<!--\s*#?region\b\s*(.*?)\s*-->/,
    end: /^\s*<!--\s*#?endregion\b\s*(.*?)\s*-->/
  },
  // css, less and scss
  {
    start: /^\s*\/\*\s*#region\b\s*(.*?)\s*\*\//,
    end: /^\s*\/\*\s*#endregion\b\s*(.*?)\s*\*\//
  },
  // f# block comments
  {
    start: /^\s*\(\*\s*#region\b\s*(.*?)\s*\*\)/,
    end: /^\s*\(\*\s*#endregion\b\s*(.*?)\s*\*\)/
  },
  // json keys, e.g. `"// #region name": "",`
  {
    start: /^\s*"\/{2,}\s*#region\b\s*(.*?)":\s*"",?\s*$/,
    end: /^\s*"\/{2,}\s*#endregion\b\s*(.*?)":\s*"",?\s*$/
  }
]

export function findRegions(lines: string[], name: string): Region[] {
  const regions: Region[] = []
  const open: { name: string; start: number; marker: RegionMarker }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!maybeMarkerRE.test(line)) continue

    let isStart = false
    for (const marker of markers) {
      const startName = marker.start.exec(line)?.[1]
      if (startName != null) {
        open.push({ name: unquote(startName), start: i + 1, marker })
        isStart = true
        break
      }
    }
    if (isStart || open.length === 0) continue

    for (const marker of markers) {
      const rawEndName = marker.end.exec(line)?.[1]
      if (rawEndName == null) continue
      const endName = unquote(rawEndName)

      const index = endName
        ? open.findLastIndex((r) => r.name === endName)
        : open.findLastIndex((r) => r.marker === marker)
      if (index === -1) continue

      const [closed] = open.splice(index, open.length - index)
      if (closed.name === name && !open.some((r) => r.name === name)) {
        regions.push({ start: closed.start, end: i, marker: closed.marker })
      }
      break
    }
  }

  return regions
}

export function stripRegionMarkers(
  lines: string[],
  styles: RegionMarker[] = markers
): string[] {
  return lines.filter(
    (line) =>
      !maybeMarkerRE.test(line) ||
      !styles.some((m) => m.start.test(line) || m.end.test(line))
  )
}

export function dedent(lines: string[]): string[] {
  let minIndent = Infinity

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== ' ' && line[i] !== '\t') {
        minIndent = Math.min(i, minIndent)
        break
      }
    }
    if (minIndent === 0) break
  }

  if (minIndent === Infinity || minIndent === 0) return lines
  return lines.map((line) => line.slice(minIndent))
}
