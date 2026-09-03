// M0 水合调试脚本(临时):headless chromium 复现用户看到的 404 现象
import { chromium } from 'playwright-chromium'

const base = process.env.BASE || 'http://localhost:5198'
const browser = await chromium.launch()

for (const path of ['/', '/guide']) {
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
  await page.waitForTimeout(1500)

  const appText = await page.evaluate(() => {
    const el = document.getElementById('app')
    return el ? el.textContent.trim().slice(0, 400) : '(no #app)'
  })
  const appHtmlHead = await page.evaluate(() => {
    const el = document.getElementById('app')
    return el ? el.innerHTML.slice(0, 300) : ''
  })
  console.log('URL   :', page.url())
  console.log('APP   :', JSON.stringify(appText))
  console.log('HTML  :', JSON.stringify(appHtmlHead))

  const guideLink = await page.locator('a').count()
  console.log('links :', guideLink)
  if (guideLink > 0) {
    const hrefs = await page.$$eval('a', (as) => as.map((a) => a.getAttribute('href')))
    console.log('hrefs :', hrefs.join(', '))
  }

  console.log('--- console ---')
  consoleMsgs.slice(0, 12).forEach((m) => console.log(m))
  console.log('--- pageerror ---')
  pageErrors.slice(0, 6).forEach((m) => console.log(m))

  if (path === '/') {
    // Counter 交互:SSR 后水合,点击按钮计数 +1
    const counterText = await page
      .locator('button[type="button"]')
      .first()
      .textContent()
      .catch(() => null)
    console.log('counter initial text:', JSON.stringify(counterText))
    const literalKept = (await page.textContent('body')).includes('{{ count }}')
    console.log('literal {{ count }} kept:', literalKept)
    const btn = page.locator('button[type="button"]').first()
    if ((await btn.count()) > 0) {
      await btn.click()
      await page.waitForTimeout(300)
      const after = await btn.textContent()
      console.log('counter after click:', JSON.stringify(after))
    }
    // 尝试点击内部链接做 SPA 导航
    const clicked = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((x) =>
        (x.getAttribute('href') || '').includes('guide')
      )
      if (a) {
        a.click()
        return a.getAttribute('href')
      }
      return null
    })
    console.log('clicked link:', clicked)
    await page.waitForTimeout(1500)
    console.log('after click URL:', page.url())
    const afterText = await page.evaluate(
      () => document.getElementById('app').textContent.trim().slice(0, 300)
    )
    console.log('after click APP:', JSON.stringify(afterText))
  }
  await page.close()
}

await browser.close()
console.log('\ndone')
