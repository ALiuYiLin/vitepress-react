/** 大纲条目(PageData.headers 契约,与 VitePress headers 形状对齐) */
export interface MdxHeader {
  /** 标题级别 2-6(h1 不进大纲) */
  level: number
  /** 纯文本标题(不含 markdown/内联样式) */
  title: string
  /** 锚点 id(rehype-slug 或显式 \{#id\}) */
  slug: string
  children?: MdxHeader[]
}

export interface MdxPageData {
  /** YAML frontmatter(空对象兜底) */
  frontmatter: Record<string, unknown>
  /** h2-h6 大纲树 */
  headers: MdxHeader[]
  /** frontmatter.title ?? 首个 h1 纯文本 */
  title: string
}
