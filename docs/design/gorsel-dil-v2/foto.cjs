// Maketlerin ekran görüntülerini alır (PDF için). Kullanım: node foto.cjs  (bahcelab-frontend/node_modules'daki Playwright)
const { createRequire } = require('module')
const req = createRequire(require('path').resolve(__dirname, '../../../bahcelab-frontend/package.json'))
const { chromium } = req('@playwright/test')
const path = require('path')
;(async () => {
  const b = await chromium.launch()
  for (const yon of ['a', 'b', 'c']) for (const ek of ['liste', 'durum', 'su', 'gecmis']) for (const [w, h] of [[1440, 900], [390, 844]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
    const p = await c.newPage()
    p.on('pageerror', (e) => console.log('hata', yon, ek, w, String(e).slice(0, 100)))
    await p.goto('file://' + path.join(__dirname, `yon-${yon}`, `${ek}-${w}.html`))
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400)
    await p.screenshot({ path: path.join(__dirname, 'onizleme', `${yon}-${ek}-${w}.png`) })
    await c.close()
  }
  await b.close(); console.log('tamam')
})()
