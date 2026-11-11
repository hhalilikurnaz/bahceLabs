import { expect, test, type Page } from '@playwright/test'
import { hazirla } from './yardimcilar'

/**
 * 9H-S4 Dilim 2 teslim ekranları (test bahçesi, çok vanalı örnek): yalnız D2_EKRAN=<klasör> verilince koşar.
 * Çıktı: tb-<ekran>-<genişlik>.png ve oynatma videosu (tb-oynatma.webm). jlnnlk ekranları ayrı betikle (geliştirme sunucusu).
 */
const EKRAN = process.env.D2_EKRAN ?? ''
test.skip(!EKRAN, 'D2_EKRAN verilmedi')
test.setTimeout(300_000)
const yol = (id: string) => `/bahceler/${id}/su/sulama`
const foto = (page: Page, ad: string, w: number) => page.screenshot({ path: `${EKRAN}/tb-${ad}-${w}.png` })

for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]] as const) {
  test(`teslim ekranları ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    const g = await hazirla(page, `Teslim ${w}`, 27.9 + w / 100000)
    await page.goto(yol(g.id))
    await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(4, { timeout: 40_000 })
    await page.waitForTimeout(1500)
    await foto(page, 'bugun', w)
    if (w !== 390) {
      for (const e of ['stres', 'fazla', 'toprak']) {
        await page.getByTestId(`gosterge-${e}`).click()
        await page.waitForTimeout(500)
        await foto(page, `gosterge-${e}`, w)
      }
    } else {
      for (const e of ['stres', 'fazla']) {
        await page.getByTestId(`gosterge-${e}`).click()
        await page.waitForTimeout(500)
        await foto(page, `gosterge-${e}`, w)
      }
      await page.getByTestId('gosterge-toprak').click()
    }
    // sulama günü kareleri (en az 4): ardışık «sonraki sulama»
    for (let i = 1; i <= 4; i++) {
      await page.getByTestId('alt-sonraki-sulama').click()
      await page.getByTestId('alt-sonraki-sulama').click({ timeout: 1500 }).catch(() => undefined)
      await page.waitForTimeout(700)
      await foto(page, `sulama-gunu-${i}`, w)
    }
    // oynatma ortasında (gün içi ilerleme)
    await page.getByTestId(w === 390 ? 'alt-hiz-dongu' : 'alt-hiz-1').click({ timeout: 1500 }).catch(() => undefined)
    await page.getByTestId('alt-oynat').click()
    await page.waitForTimeout(1200)
    await foto(page, 'oynatiliyor', w)
    await page.getByTestId('alt-oynat').click()
    // vana odağı
    await page.getByTestId('alt-bugun').click()
    await page.locator('[data-testid="harita-vana-etiketi"][data-vana="V3"]').click()
    await expect(page.getByTestId('vana-odagi')).toBeVisible()
    await page.waitForTimeout(500)
    await foto(page, 'vana-odagi', w)
    await page.getByTestId('vana-odagi-kapat').click()
    // Simülasyon sekmesi
    await page.getByTestId('sulama-sekme-simulasyon').click()
    await expect(page.getByTestId('sulama-simulasyon')).toBeVisible({ timeout: 45_000 })
    await page.waitForTimeout(1500)
    await foto(page, 'simulasyon', w)
    await page.getByTestId('sulama-sekme-bugun').click()
    // çizim aracı
    await page.getByTestId('vana-ciz-ac').click()
    await expect(page.getByTestId('vana-cizim-araci')).toBeVisible()
    await page.waitForTimeout(800)
    await foto(page, 'cizim-araci', w)
  })
}

