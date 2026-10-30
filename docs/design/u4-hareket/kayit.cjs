// Hareket kayıtları (webm): sekme geçişi, grafik çizimi, nota uçuş, alt sayfa. Kullanım: node kayit.cjs  (dev sunucu + API + oturum çerezi: token.txt yolu ORTAM'dan)
// Gerekli ortam: TOKEN (access çerezi), BAHCE (bahçe kimliği), BASE (varsayılan http://localhost:5173)
const { createRequire } = require('module')
const path = require('path')
const req = createRequire(path.resolve(__dirname, '../../../bahcelab-frontend/package.json'))
const { chromium } = req('@playwright/test')
const fs = require('fs')
const BASE = process.env.BASE || 'http://localhost:5173'
const J = process.env.BAHCE
const TOKEN = process.env.TOKEN
const OUT = __dirname
const kayit = async (b, ad, w, h, senaryo) => {
  const dir = path.join(OUT, '.tmp-' + ad); fs.rmSync(dir, { recursive: true, force: true })
  const c = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } }, locale: 'tr-TR' })
  await c.addCookies([{ name: 'bahcelab_access', value: TOKEN, url: BASE }])
  const p = await c.newPage()
  await senaryo(p)
  await c.close()
  const f = fs.readdirSync(dir).find((x) => x.endsWith('.webm'))
  fs.renameSync(path.join(dir, f), path.join(OUT, ad + '.webm')); fs.rmSync(dir, { recursive: true, force: true })
  console.log('kayıt', ad)
}
;(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  await kayit(b, '1-sekme-gecisi', 1440, 900, async (p) => {
    await p.goto(`${BASE}/bahceler/${J}`); await p.waitForTimeout(6000)
    for (const t of ['Su', 'Analiz', 'Hava', 'Durum']) { await p.getByRole('tab', { name: t, exact: true }).click(); await p.waitForTimeout(2200) }
  })
  await kayit(b, '2-grafik-cizimi-ve-imlec', 1440, 900, async (p) => {
    await p.goto(`${BASE}/bahceler/${J}`); await p.waitForTimeout(2500)
    await p.getByTestId('sezon-egrisi').scrollIntoViewIfNeeded(); await p.waitForTimeout(2500)
    const y = await p.getByTestId('grafik-yuzey').boundingBox()
    if (y) for (let i = 0; i <= 24; i++) { await p.mouse.move(y.x + (y.width * i) / 24, y.y + y.height / 2); await p.waitForTimeout(120) }
    await p.waitForTimeout(800)
  })
  await kayit(b, '3-nota-ucus', 1440, 900, async (p) => {
    await p.goto(`${BASE}/bahceler/${J}`); await p.waitForTimeout(7000)
    const n = p.getByTestId('karto-not').first(); if (await n.count()) { await n.click(); await p.waitForTimeout(2200) }
  })
  await kayit(b, '4-alt-sayfa-390', 390, 844, async (p) => {
    await p.goto(`${BASE}/bahceler/${J}`); await p.waitForTimeout(6000)
    const t = p.getByTestId('alt-sayfa-tutamak'); const bx = await t.boundingBox()
    if (bx) {
      await t.focus(); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(900); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(900); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(900)
      await p.mouse.move(bx.x + bx.width / 2, bx.y + 10); await p.mouse.down(); for (let i = 0; i < 12; i++) { await p.mouse.move(bx.x + bx.width / 2, bx.y - 20 * i); await p.waitForTimeout(40) } await p.mouse.up(); await p.waitForTimeout(900)
    }
  })
  await b.close()
})()
