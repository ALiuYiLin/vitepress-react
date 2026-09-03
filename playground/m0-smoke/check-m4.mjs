// 默认主题(shadcn 骨架 + vp-doc 正文)冒烟回归:结构、暗色、SPA、零报错。
import { chromium } from 'playwright-chromium'

const BASE = process.env.BASE || 'http://localhost:5198'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 220)))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    errors.push(`[${m.type()}] ${m.text().slice(0, 220)}`)
  }
})

const texts = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()))

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1000)

console.log('nav:', JSON.stringify(await texts('header nav a')))
console.log('brand:', JSON.stringify((await page.textContent('header a')).trim().slice(0, 30)))
console.log('sidebar:', JSON.stringify(await texts('aside.w-60 a')))
console.log('outline:', JSON.stringify(await texts('aside.w-52 a')))
const footer = (await page.textContent('footer'))?.replace(/\s+/g, ' ').trim()
console.log('footer:', JSON.stringify(footer))
console.log('doc renders counter:', (await page.textContent('article')).includes('count is 0'))
const h1 = await page.$eval('article h1', (e) => getComputedStyle(e).fontSize).catch(() => 'n/a')
console.log('article h1 font-size:', h1)

// 暗色切换与持久化
await page.locator('button[aria-label="切换外观"]').click()
await page.waitForTimeout(500)
console.log('dark class:', await page.evaluate(() => document.documentElement.classList.contains('dark')))
console.log('stored:', await page.evaluate(() => localStorage.getItem('vitepress-theme-appearance')))
await page.screenshot({ path: 'shot-dark.png' })
await page.locator('button[aria-label="切换外观"]').click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'shot-light.png' })

// SPA:点侧栏 Guide → /guide
await page.locator('aside.w-60 a[href="/guide"]').first().click()
await page.waitForTimeout(1200)
console.log('after click url:', page.url())
console.log('guide content:', (await page.textContent('article')).includes('M0-SMOKE-GUIDE-MARKER'))

console.log('errors:', JSON.stringify(errors.slice(0, 6)))
await ctx.close()
await browser.close()
console.log('\ndone')
