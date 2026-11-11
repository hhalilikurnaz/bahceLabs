import { expect, test } from '@playwright/test'
import { copyFileSync } from 'node:fs'
import { hazirla } from './yardimcilar'

/** Sulama günü oynatma videosu (10–15 sn): yalnız D2_EKRAN verilince koşar → <klasör>/tb-oynatma.webm */
const EKRAN = process.env.D2_EKRAN ?? ''
test.skip(!EKRAN, 'D2_EKRAN verilmedi')
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } }, viewport: { width: 1440, height: 900 } })
const yol = (id: string) => `/bahceler/${id}/su/sulama`
test('sulama günü oynatma (10–15 sn)', async ({ page }, testInfo) => {
  const g = await hazirla(page, 'Video', 27.95)
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(4, { timeout: 40_000 })
  await page.getByTestId('alt-sonraki-sulama').click()
  await page.getByTestId('alt-onceki-sulama').click()
  await page.getByTestId('alt-sonraki-sulama').click()
  await page.waitForTimeout(1500)
  await page.getByTestId('alt-hiz-1').click()
  await page.getByTestId('alt-oynat').click()
  await page.waitForTimeout(11_000)
  await page.getByTestId('alt-oynat').click()
  await page.waitForTimeout(500)
  await page.context().close()
  const v = await page.video()?.path()
  if (v) copyFileSync(v, `${EKRAN}/tb-oynatma.webm`)
  void testInfo
})
