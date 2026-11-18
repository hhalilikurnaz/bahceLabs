import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedSebep } from './yardimcilar'

/**
 * ADIM 10B Dilim 2 teslim ekranları (Durum maddesi ve görüntü kapısı; SENTETİK test bahçesi — taze gerçek düşüş olayı yok): yalnız D2_EKRAN=<klasör> verilince koşar.
 * jlnnlk (gerçek veri) ekranları ayrı betikle (geliştirme sunucusu): Geçmiş ve harita olay kartı.
 */
const EKRAN = process.env.D2_EKRAN ?? ''
test.skip(!EKRAN, 'D2_EKRAN verilmedi')
test.setTimeout(240_000)

for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]] as const) {
  test(`10B Durum ekranları ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await newUser(page)
    await page.route('**/api/gardens/*/weather', (route) => route.abort())
    const a = await createGarden(page.request, { ad: `Sebep ${w}`, lng: 28.51 + w / 100000, lat: 38.51, sideM: 200 })
    seedSebep(a.id, 'belirsiz')
    await page.goto(`/bahceler/${a.id}`)
    const madde = page.getByTestId('today-card').locator('[data-kind="olay"]')
    await expect(madde).toHaveCount(1, { timeout: 30_000 })
    await madde.getByTestId('today-sebep').locator('summary').click()
    await expect(madde.getByTestId('sebep-karti')).toBeVisible({ timeout: 20_000 })
    await madde.getByTestId('sebep-karti').locator('[data-testid="sebep-satiri"][data-sebep="don"] summary').click()
    await madde.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${EKRAN}/tb-durum-sebep-${w}.png` })
    const b = await createGarden(page.request, { ad: `Kapı ${w}`, lng: 28.61 + w / 100000, lat: 38.61, sideM: 200 })
    seedSebep(b.id, 'kapi')
    await page.goto(`/bahceler/${b.id}`)
    const kapi = page.getByTestId('today-card').locator('[data-kind="olay"]')
    await expect(kapi).toContainText('Görüntü kaynaklı olabilir', { timeout: 30_000 })
    await kapi.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${EKRAN}/tb-durum-kapi-${w}.png` })
  })
}
