import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { resolveConfig } from 'node/config'
import { createContentLoader } from 'node/contentLoader'
import { disposeMdItInstance } from 'node/markdown/markdown'

describe('node/contentLoader', () => {
  let root: string | undefined

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true })
      root = undefined
    }
    delete (global as any).VITEPRESS_CONFIG
  })

  async function setup(cleanUrls: boolean) {
    root = await mkdtemp(path.join(tmpdir(), 'vitepress-content-loader-'))
    await writeFile(
      path.join(root, 'index.md'),
      '# Home\n\n[link](./other.md)\n'
    )
    await writeFile(path.join(root, 'other.md'), '# Other\n')

    const siteConfig = await resolveConfig(root, 'build', 'production')
    siteConfig.cleanUrls = cleanUrls
    ;(global as any).VITEPRESS_CONFIG = siteConfig
  }

  test('rendered internal links get .html when cleanUrls is false', async () => {
    await setup(false)

    const data = await createContentLoader('index.md', {
      render: true
    }).load()

    expect(data[0].html).toContain('href="./other.html"')
  })

  test('rendered internal links are clean when cleanUrls is true', async () => {
    await setup(true)

    const data = await createContentLoader('index.md', {
      render: true
    }).load()

    expect(data[0].html).toContain('href="./other"')
    expect(data[0].html).not.toContain('./other.html')
  })

  test('excerpts resolve $frontmatter without render', async () => {
    await setup(false)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(
      path.join(root!, 'post.md'),
      '---\ntitle: My Post\n---\n\nIntro says {{ $frontmatter.title }}.\n\n---\n\nBody.\n'
    )
    // fork 的 React 语义下 `{{ }}` 默认是字面文本;该用例验证的是 excerpt
    // 渲染(不依赖 render:true)在开启 eager 插值后能解析 $frontmatter,
    // 故在此显式开启 Vue 遗留插值选项并重建渲染器
    const siteConfig = (global as any).VITEPRESS_CONFIG as {
      markdown?: Record<string, unknown>
    }
    siteConfig.markdown = {
      ...siteConfig.markdown,
      eagerFrontmatterInterpolation: true
    }
    disposeMdItInstance()

    const data = await createContentLoader('post.md', {
      excerpt: true
    }).load()

    expect(data[0].excerpt).toContain('Intro says My Post.')
  })
})
