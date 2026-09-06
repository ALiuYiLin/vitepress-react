export { compileDocument } from './compile'
export type {
  MdxCompileOptions,
  MdxCompileResult
} from './compile'
export type { MdxPageData, MdxHeader } from './types'
export { createCodeHighlighter, rehypeCodeHighlight } from './highlight'
export type {
  CodeHighlighter,
  CodeHighlightOptions,
  CodeHighlightRuntime,
  HighlightTheme
} from './highlight'
// 自研件:include/snippet 展开、容器行规整(供调用方与测试直接使用)
export { expandIncludes } from './includes'
export { expandSnippets, parseSnippetPath } from './snippets'
export {
  normalizeContainerSpacing,
  remarkContainers,
  DEFAULT_CONTAINER_TITLES
} from './containers'
export { remarkGithubAlerts } from './alerts'
export { findRegions, stripRegionMarkers, dedent } from './regions'
