// M0-M2 冒烟回归脚本(临时):headless chromium 检查 SSR 水合、SPA 导航、
// head 同步与默认 404。
// 用法:先起服务再跑;默认 http://localhost:5198,可用 BASE 环境变量覆盖。
import { chromium } from 'playwright-chromium'

const base = process.env.BASE || 'http://localhost:5198'
const browser = await chromium.launch()

async function open(path) {
  const page = await browser.newPage()
  const consoleMsgs = []
  const pageErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMsgs.push(`[${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  console.log(`\n===== goto ${base}${path} =====`)
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    console.log('goto failed:', e.message.split('\n')[0])
  }
  await page.waitForTimeout(1200)
  return { page, consoleMsgs, pageErrors }
}

async function dumpState(tag, page) {
  const appText = await page.evaluate(
    () => document.getElementById('app')?.textContent.trim().slice(0, 200) ?? ''
  )
  const headInfo = await page.evaluate(() => ({
    title: document.title,
    description: document.head
      .querySelector('meta[name="description"]')
      ?.getAttribute('content'),
    keywords: document.head
      .querySelector('meta[name="keywords"]')
      ?.getAttribute('content'),
    ogTitle: document.head
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content')
  }))
  console.log(tag, JSON.stringify({ app: appText, ...headInfo }))
}

// ---- 首页 + SPA 导航 + head 同步 ----
{
  const { page, consoleMsgs, pageErrors } = await open('/')
  await dumpState('HOME', page)

  const counterText = await page
    .locator('button[type="button"]')
    .first()
    .textContent()
    .catch(() => null)
  console.log('counter initial:', JSON.stringify(counterText))
  console.log('literal {{ count }} kept:', (await page.textContent('body')).includes('{{ count }}'))
  const btn = page.locator('button[type="button"]').first()
  if ((await btn.count()) > 0) {
    await btn.click()
    await page.waitForTimeout(250)
    console.log('counter after click:', JSON.stringify(await btn.textContent()))
  }

  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) =>
      (x.getAttribute('href') || '').includes('guide')
    )
    a?.click()
  })
  await page.waitForTimeout(1200)
  await dumpState('AFTER SPA /guide', page)
  console.log('url after click:', page.url())
  console.log('console:', consoleMsgs.slice(0, 8))
  console.log('pageerror:', pageErrors.slice(0, 4))
  await page.close()
}

// ---- 直接打开 /guide ----
{
  const { page, consoleMsgs, pageErrors } = await open('/guide')
  await dumpState('GUIDE', page)
  console.log('console:', consoleMsgs.slice(0, 8))
  console.log('pageerror:', pageErrors.slice(0, 4))
  await page.close()
}

// ---- 默认 404(不存在路径) ----
{
  const { page, consoleMsgs, pageErrors } = await open('/definitely-missing-xyz')
  await dumpState('404', page)
  const text = await page.evaluate(() => document.getElementById('app')?.textContent ?? '')
  console.log('has 404 text:', text.includes('404'))
  console.log('console:', consoleMsgs.slice(0, 8))
  console.log('pageerror:', pageErrors.slice(0, 4))
  await page.close()
}

await browser.close()
console.log('\ndone')
