import { expect, test } from '@playwright/test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createGarden, newUser, seedScenes } from './yardimcilar'

/** Yalnız SHOTS=1 ile koşar (rapor ekran görüntüleri); normal pakete girmez. */
test.skip(!process.env.SHOTS, 'SHOTS=1 ile çalıştırılır')
const KLASOR = join(homedir(), 'Desktop/bahcelab-ekran-goruntuleri/adim-9/9C')

for (const [ad, w, h] of [['1440', 1440, 900], ['390', 390, 844]] as const) {
  test(`9C ekran görüntüleri ${ad}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: w, height: h })
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Dilim Bahçesi', lng: 27.95, lat: 38.95, sideM: 300 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('harita-paneli')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(4000)
    await page.screenshot({ path: join(KLASOR, `durum-sezon-bandi-ve-cubuklar-${ad}.png`), fullPage: false })
    for (const [tid, dosya] of [['sezon-egrisi', 'sezon-egrisi'], ['gosterge-cubuklari', 'gosterge-cubuklari']] as const) {
      const el = page.getByTestId(tid)
      await el.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await el.screenshot({ path: join(KLASOR, `durum-${dosya}-${ad}.png`) })
    }
    const menu = page.getByTestId('katman-menusu')
    for (const [id, dosya] of [['klorofil', 'klorofil'], ['yaprakAlani', 'yaprak-alani'], ['tacToprak', 'tac-ve-toprak'], ['yaprakSuyu', 'yaprak-suyu']] as const) {
      await menu.getByRole('button', { name: /Canlılık|Klorofil|Yaprak alanı|Taç ve toprak|Yaprak suyu|Bölgeler|Değişim/ }).first().click()
      await page.getByTestId(`katman-${id}`).click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: join(KLASOR, `katman-${dosya}-${ad}.png`) })
    }
  })
}

test('9C geçmiş çekiliyor boş durumu', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Yeni Bahçe', lng: 27.96, lat: 38.96, sideM: 300 })
  // Arayüz durumu: çekim sürerken yanıt (ilerleme) taklit edilir; ürün verisi değil, yalnız bu ekran görüntüsü için
  await page.route('**/api/gardens/*/gecmis-doldurma', (r) => r.request().method() === 'GET' ? r.fulfill({ json: { durum: 'isleniyor', toplam_ay: 124, tamamlanan_ay: 50, hata_ay: 0, yuzde: 40, net_sahne: 71, depolanan_sahne: 71, depolama_bayt: 234000 } }) : r.continue())
  await page.goto(`/bahceler/${garden.id}`)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: join(KLASOR, 'gecmis-cekiliyor-bos-durum-1440.png') })
})
