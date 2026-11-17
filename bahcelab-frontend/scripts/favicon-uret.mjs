// public/favicon.svg → PNG boyutları (192, 48, 32). Marka işareti tek kaynaktan (BrandMark ile aynı çizim).
//   node scripts/favicon-uret.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const svg = readFileSync(path.resolve('public/favicon.svg'), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const [ad, boyut] of [['favicon-192.png', 192], ['favicon.png', 192], ['favicon-48.png', 48], ['favicon-32.png', 32]]) {
  await page.setViewportSize({ width: boyut, height: boyut })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${boyut}px;height:${boyut}px}</style>${svg}`)
  await page.screenshot({ path: path.resolve('public', ad), omitBackground: true, clip: { x: 0, y: 0, width: boyut, height: boyut } })
  console.log('yazıldı', ad)
}
await browser.close()
