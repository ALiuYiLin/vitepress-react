// 默认主题(Vue 类名骨架)冒烟:结构/DOM/正文/页面导航/暗色/404;(忽略已知 dev/prod hydration #418)
import { chromium } from 'playwright-chromium'
const BASE = process.env.BASE || 'http://localhost:5197'
const browser = await chromium.launch()
const errors = []
const collect = (page) => {
  page.on('pageerror', (e) => { const s = String(e); if (!/Minified React error/.test(s)) errors.push('pageerror: ' + s.slice(0, 200)) })
  page.on('console', (m) => { const t = m.text(); if ((m.type()==='error'||m.type()==='warning') && !/Minified React error/.test(t)) errors.push('['+m.type()+'] ' + t.slice(0, 200)) })
}
const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()))

{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await ctx.newPage(); collect(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)
  console.log('VPNavBar:', await page.$('.VPNavBar').catch(()=>null)?true:false)
  console.log('VPSidebar:', await page.$('.VPSidebar').catch(()=>null)?true:false)
  console.log('vp-doc:', await page.$('.vp-doc').catch(()=>null)?true:false)
  console.log('topnav:', JSON.stringify(await texts(page, '.VPNavBarContent a, .VPNavBarContent .VPNavMenuLink')))
  console.log('sidebar items:', JSON.stringify(await texts(page, '.VPSidebarItem .text')))
  console.log('active:', JSON.stringify(await texts(page, '.VPSidebarItem.is-active .text')))
  console.log('outline links:', JSON.stringify(await texts(page, '.outline-link')))
  console.log('outline title:', JSON.stringify((await page.textContent('.VPDocAsideOutline .outline-title'))?.trim()))
  console.log('vp-doc has marker:', (await page.textContent('.vp-doc')).includes('M0-SMOKE-MARKER'))
  console.log('footer:', JSON.stringify((await page.textContent('.VPFooter .container'))?.replace(/\s+/g,' ').trim()))
  // 暗色
  await page.locator('.VPNavAppearance button').first().click(); await page.waitForTimeout(500)
  console.log('dark class:', await page.evaluate(()=>document.documentElement.classList.contains('dark')))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const page = await ctx.newPage(); collect(page)
  await page.goto(BASE + '/zzz-missing', { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  console.log('404 code:', JSON.stringify((await page.textContent('.NotFound .code'))?.trim()))
  await ctx.close()
}
console.log('errors:', JSON.stringify(errors.slice(0,5)))
await browser.close(); console.log('done')