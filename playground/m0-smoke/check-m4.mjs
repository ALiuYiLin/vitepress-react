// M4 参考主题冒烟(临时):布局结构、nav/sidebar/outline/footer、暗色切换与持久化、语言菜单。
import { chromium } from 'playwright-chromium'

const BASE = process.env.BASE || 'http://localhost:5198'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`)
})

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(900)

// 结构断言
const navTexts = await page.$$eval('.vp-nav-link', (els) => els.map((e) => e.textContent.trim()))
console.log('nav items order:', JSON.stringify(navTexts))
const brand = await page.textContent('.vp-brand')
console.log('brand:', JSON.stringify(brand.trim()))
const sidebarLinks = await page.$$eval('.vp-sidebar a.vp-sidebar-link', (els) => els.map((e) => e.textContent.trim()))
console.log('sidebar links:', JSON.stringify(sidebarLinks))
const outlineLinks = await page.$$eval('.vp-outline a', (els) => els.map((e) => e.textContent.trim()))
console.log('outline links:', JSON.stringify(outlineLinks))
const footerText = (await page.textContent('.vp-footer'))?.replace(/\s+/g, ' ').trim()
console.log('footer:', JSON.stringify(footerText))
const docHasCounter = (await page.textContent('.vp-doc')).includes('count is 0')
console.log('doc content renders:', docHasCounter)

// 暗色切换与持久化
const darkBtn = page.locator('.vp-header-actions .vp-icon-btn').last() // 语言菜单+外观+汉堡(桌面汉堡 display none)
const beforeDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
console.log('dark before:', beforeDark)
await page.locator('button[aria-label="Appearance"], button[aria-label="Switch to dark theme"], button[aria-label="Switch to light theme"]').click()
await page.waitForTimeout(400)
console.log('dark after toggle:', await page.evaluate(() => document.documentElement.classList.contains('dark')))
console.log('stored:', await page.evaluate(() => localStorage.getItem('vitepress-theme-appearance')))

// 语言菜单(多语言配置存在)
const langBtn = page.locator('.vp-header-actions .vp-nav-item button').first()
console.log('lang button exists:', (await langBtn.count()) > 0)
if ((await langBtn.count()) > 0) {
  await langBtn.hover()
  await page.waitForTimeout(400)
  const dropdownText = await page.evaluate(() => {
    const items = document.querySelectorAll('.vp-header-actions .vp-nav-dropdown a')
    return [...items].map((a) => a.textContent.trim())
  })
  console.log('lang dropdown:', JSON.stringify(dropdownText))
}

// SPA:点 sidebar Guide → /guide
await page.locator('.vp-sidebar a[href="/guide"]').first().click()
await page.waitForTimeout(1200)
console.log('after click url:', page.url())
const guideActiveNav = await page.$eval('.vp-nav-link.active', (e) => e.textContent.trim()).catch(() => 'none')
console.log('active nav on guide:', guideActiveNav)

console.log('errors:', errors.slice(0, 6))
await context.close()
await browser.close()
console.log('\ndone')
