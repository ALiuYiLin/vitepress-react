// 默认主题(shadcn 重构)冒烟:侧栏/大纲/页脚/顶栏/vp-doc/暗色/SPA/移动端 Sheet
import { chromium } from 'playwright-chromium'

const BASE = process.env.BASE || 'http://localhost:5198'
const browser = await chromium.launch()
const errors = []
const collect = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 220)))
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push('[' + m.type() + '] ' + m.text().slice(0, 220))
  })
}
const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()))

{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  const page = await ctx.newPage()
  collect(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)

  console.log('sidebar:', JSON.stringify(await texts(page, '[data-slot="sidebar-content"] a')))
  console.log('outline:', JSON.stringify(await texts(page, 'aside.w-48 a')))
  console.log('nav:', JSON.stringify(await texts(page, 'header nav button, header nav a')))
  console.log('brand:', JSON.stringify((await page.textContent('header')).trim().slice(0, 20)))
  console.log('footer:', JSON.stringify((await page.textContent('footer'))?.replace(/\s+/g, ' ').trim()))
  console.log('vp-doc renders:', (await page.textContent('article .vp-doc')).includes('count is 0'))
  console.log('sidebar bg:', await page.$eval('[data-slot="sidebar"]', (e) => getComputedStyle(e).backgroundColor).catch(() => 'n/a'))

  await page.locator('button[aria-label="切换外观"]').click()
  await page.waitForTimeout(500)
  console.log('dark:', await page.evaluate(() => document.documentElement.classList.contains('dark')))
  console.log('stored:', await page.evaluate(() => localStorage.getItem('vitepress-theme-appearance')))

  await page.locator('[data-slot="sidebar-content"] a[href="/guide"]').first().click()
  await page.waitForTimeout(1200)
  console.log('after click url:', page.url())
  await ctx.close()
}

{
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } })
  const page = await ctx.newPage()
  collect(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  console.log('mobile sidebar display:', await page.$eval('[data-slot="sidebar"]', (e) => getComputedStyle(e).display).catch(() => 'n/a'))
  await page.locator('[data-sidebar="trigger"]').first().click()
  await page.waitForTimeout(600)
  const sheetVisible = await page.$$eval('[data-mobile="true"]', (els) => els.some((e) => getComputedStyle(e).display !== 'none'))
  console.log('mobile sheet open:', sheetVisible)
  console.log('sheet menu len:', (await texts(page, '[data-slot="sidebar-content"] a')).length)
  await ctx.close()
}

console.log('errors:', JSON.stringify(errors.slice(0, 6)))
await browser.close()
console.log('\ndone')