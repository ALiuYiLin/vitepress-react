import { useData } from '@10coding/vitepress-react'

/** 编辑页链接:由 theme.editLink.pattern 替换 :path,或函数 pattern(page) */
export function useEditLink(): { url?: string; text?: string } {
  const { theme, page } = useData()
  const cfg = theme as {
    editLink?: { pattern?: string; text?: string }
  }
  const pattern = cfg.editLink?.pattern
  if (!pattern) return {}
  const filePath = (page as { filePath?: string })?.filePath ?? ''
  const url = pattern.replace(/:path/g, filePath)
  return { url, text: cfg.editLink?.text ?? '为此页提出修改' }
}
