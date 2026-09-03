// M3 内核验证(临时):DEV HMR 即时更新 + copy 剪贴板 + PROD hover 预取。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-chromium'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GUIDE = path.join(HERE, 'guide.md')
const BASE = process.env.BASE || 'http://localhost:5198'
const browser = await chromium.launch()

// ---------- DEV:HMR + copy ----------
{
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write']
  })
  const page = await context.newPage()
  const consoleMsgs = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleMsgs.push(m.text())
  })

  await page.goto(BASE + '/guide', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  console.log('guide initial contains marker:', (await page.textContent('body')).includes('M0-SMOKE-GUIDE-MARKER'))

  // HMR:修改 guide.md → 当前页应即时更新(不整页刷新)
  const original = fs.readFileSync(GUIDE, 'utf8')
  const stamp = `HMR-LIVE-${Date.now()}`
  try {
    await page.evaluate(() => {
      window.__noReloadFlag = 1
    })
    fs.writeFileSync(GUIDE, original + `\n\n${stamp}\n`, 'utf8')
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    console.log('after md edit contains stamp:', body.includes(stamp))
    console.log('no full reload happened:', await page.evaluate(() => window.__noReloadFlag === 1))
    console.log('url unchanged:', page.url().endsWith('/guide'))
  } finally {
    fs.writeFileSync(GUIDE, original, 'utf8')
    await page.waitForTimeout(1200)
  }

  // copy 按钮 → 剪贴板
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  const copyBtn = page.locator('button.copy').first()
  console.log('copy button exists:', (await copyBtn.count()) > 0)
  if ((await copyBtn.count()) > 0) {
    await copyBtn.click()
    await page.waitForTimeout(400)
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    console.log('clipboard text:', JSON.stringify(clip))
    console.log('clipboard has code:', clip.includes('const answer = 42'))
    console.log('button got copied class:', await copyBtn.evaluate((el) => el.classList.contains('copied')))
  }
  console.log('console errors:', consoleMsgs.slice(0, 5))
  await context.close()
}

// ---------- PROD:hover 预取 ----------
if (process.env.PREFETCH_BASE) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const fetchedGuide = []
  page.on('request', (req) => {
    if (/assets\/guide\.md\.[\w-]+\.js/.test(req.url())) fetchedGuide.push(req.url())
  })
  await page.goto(process.env.PREFETCH_BASE + '/', {
    waitUntil: 'networkidle',
    timeout: 30000
  })
  await page.waitForTimeout(500)
  console.log('guide chunk fetched before hover:', fetchedGuide.length > 0)
  await page.hover('a[href="/guide"]')
  await page.waitForTimeout(1800)
  console.log('guide chunk fetched after hover:', fetchedGuide.length > 0)
  console.log('still on / :', page.url().endsWith('/'))
  await context.close()
}

await browser.close()
console.log('\ndone')
