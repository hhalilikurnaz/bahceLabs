// Landing ve giriş/kayıt ekran görüntüleri (öncesi/sonrası karşılaştırma ve gözle kontrol).
//   node scripts/landing-onizleme.mjs <etiket> [CAPTURE_BASE=http://localhost:5198] [CAPTURE_OUT=klasör]
// Her genişlik için: hero kaydırma durakları, sayfa bölümleri, /login, /register, /blog.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const etiket = process.argv[2] ?? 'yeni'
const base = process.env.CAPTURE_BASE ?? 'http://localhost:5198'
const out = path.resolve(process.env.CAPTURE_OUT ?? 'landing-onizleme')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
for (const [ad, vp] of [['d', { width: 1440, height: 900 }], ['m', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'tr-TR' })
  const page = await ctx.newPage()
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const toplam = await page.evaluate(() => document.documentElement.scrollHeight)
  const adimlar = [0, 0.9, 1.5, 2.5, 3.5]
  for (const s of adimlar) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), s * vp.height)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${out}/${etiket}-${ad}-hero-${s}.png` })
  }
  // hero sonrası bölümler: her bölümün başına git
  const idler = await page.evaluate(() => [...document.querySelectorAll('main section')].map((s, i) => ({ i, id: s.id, top: s.getBoundingClientRect().top + scrollY })))
  let n = 0
  for (const b of idler) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.max(0, b.top - 70))
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/${etiket}-${ad}-bolum-${n++}-${b.id || 'son'}.png` })
  }
  console.log(ad, 'toplam yükseklik', toplam, 'bölüm', idler.length)
  for (const p of ['/login', '/register', '/blog']) {
    await page.goto(`${base}${p}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/${etiket}-${ad}${p.replace('/', '-')}.png` })
  }
  await ctx.close()
}
await browser.close()
