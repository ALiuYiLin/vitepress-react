import { mkdir, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import getPort from 'get-port'
import { nanoid } from 'nanoid'
import { chromium } from 'playwright-chromium'
import {
  createServer,
  scaffold,
  ScaffoldThemeType
} from '@10coding/vitepress-react'

const tempDir = fileURLToPath(new URL('./.temp', import.meta.url))
const getTempRoot = () => path.join(tempDir, nanoid())

const browser = await chromium.launch({
  headless: !process.env.DEBUG,
  args: process.env.CI
    ? ['--no-sandbox', '--disable-setuid-sandbox']
    : undefined
})

const page = await browser.newPage()

const themes = [
  ScaffoldThemeType.Default,
  ScaffoldThemeType.DefaultCustom,
  ScaffoldThemeType.Custom
]
const usingTs = [false, true]
const variations = themes.flatMap((theme) =>
  usingTs.map(
    (useTs) => [`${theme}${useTs ? ' + ts' : ''}`, { theme, useTs }] as const
  )
)

afterAll(async () => {
  await page.close()
  await browser.close()
  await rm(tempDir, { recursive: true, force: true })
})

test.each(variations)('init %s', async (_, { theme, useTs }) => {
  const root = getTempRoot()
  await rm(root, { recursive: true, force: true })
  await scaffold({ root, theme, useTs, injectNpmScripts: false })

  const port = await getPort()
  const server = await createServer(root, { port })
  await server.listen()

  async function goto(path: string) {
    await page.goto(`http://localhost:${port}${path}`)
    await page.waitForSelector('#app div')
  }

  try {
    await goto('/')
    expect(await page.textContent('h1')).toMatch('My Awesome Project')

    await page.click('a[href="/markdown-examples.html"]')
    await page.waitForFunction('document.querySelector("pre code")')
    expect(await page.textContent('h1')).toMatch('Markdown Extension Examples')

    await goto('/')
    expect(await page.textContent('h1')).toMatch('My Awesome Project')

    await page.click('a[href="/api-examples.html"]')
    await page.waitForFunction('document.querySelector("pre code")')
    expect(await page.textContent('h1')).toMatch('Runtime API Examples')

    // 回归:SPA 导航后 URL 带 .html,侧栏当前项仍需高亮
    // (高亮基于 pageData.relativePath + isActive,而非 URL pathname)
    if (theme !== ScaffoldThemeType.Custom) {
      const active = page.locator('.VPSidebarItem.is-active .text').first()
      await active.waitFor({ state: 'visible', timeout: 5000 })
      expect(await active.textContent()).toContain('API Examples')
    }

    // teardown
  } finally {
    await server.close()
  }
})

test('init injects framework + react devDependencies when writing scripts', async () => {
  const root = getTempRoot()
  await rm(root, { recursive: true, force: true })
  await mkdir(root, { recursive: true })
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'scaffold-deps', private: true, type: 'module' })
  )

  // scaffold writes scripts/deps into the package.json at process.cwd()
  const cwd = process.cwd()
  process.chdir(root)
  try {
    await scaffold({
      root: '.',
      theme: ScaffoldThemeType.Default,
      useTs: false,
      injectNpmScripts: true,
      addNpmScriptsPrefix: false
    })
  } finally {
    process.chdir(cwd)
  }

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  expect(pkg.scripts).toMatchObject({ dev: 'vitepress-react dev' })
  expect(pkg.devDependencies['@10coding/vitepress-react']).toMatch(/^\^/)
  expect(pkg.devDependencies.react).toBe('^19.0.0')
  expect(pkg.devDependencies['react-dom']).toBe('^19.0.0')
})
