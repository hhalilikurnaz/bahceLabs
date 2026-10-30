import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createGarden, newUser, seedScenes, seedWater } from './yardimcilar'

/**
 * EKRAN GÖRÜNTÜSÜ aracı (test değil): Sulama paneli (9H-S4) ekranları 1440/1024/390. Veri: test tohumlu bahçe (ERA5/toprak/uydu serisi `tests/support`;
 * ürün kodunda sahte veri yok). Yalnız `EKRAN_CIKTI=<klasör>` verilince koşar.
 */
test.skip(!process.env.EKRAN_CIKTI, 'ekran görüntüsü aracı: EKRAN_CIKTI verilince çalışır')

test('9H-S4: Sulama paneli (Bugün, Simülasyon, vanalar, boş durum) — test tohumlu, açık tema', async ({ page }) => {
  test.setTimeout(420_000)
  const cikti = process.env.EKRAN_CIKTI as string
  mkdirSync(cikti, { recursive: true })
  await page.emulateMedia({ colorScheme: 'light' })
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Tohumlu Narenciye', lng: 27.81, lat: 38.71, sideM: 300 })
  seedScenes(g.id)
  seedWater(g.id)
  await page.request.patch(`/api/gardens/${g.id}`, { data: { agac_sayisi: 4200 } })
  await page.request.put(`/api/gardens/${g.id}/sulama-profili`, { data: { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke', kwh_fiyat_tl: 3.2 } })
  const geo = ((await (await page.request.get(`/api/gardens/${g.id}`)).json()) as { geometry: GeoJSON.Polygon }).geometry.coordinates[0]
  const xs = geo.map((c) => c[0])
  const ys = geo.map((c) => c[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const kutu = (a: number, b: number) => ({ type: 'Polygon', coordinates: [[[a, y0], [b, y0], [b, y1], [a, y1], [a, y0]]] })
  const d = (x1 - x0) / 3
  await page.request.put(`/api/gardens/${g.id}/sulama-sektorleri`, { data: { sektorler: [{ ad: 'V1', geometry: kutu(x0, x0 + d), vana_debi_m3h: 30 }, { ad: 'V2', geometry: kutu(x0 + d, x0 + 2 * d), vana_debi_m3h: 30 }, { ad: 'V3', geometry: kutu(x0 + 2 * d, x1), vana_debi_m3h: 30 }] } })
  const gun = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
  await page.request.post(`/api/gardens/${g.id}/saha-kayitlari`, { data: { tur: 'sulama', tarih: gun, ayrinti: { m3: 90, sektor: 'V1' } } })
  for (const [ad, width, height] of [['1440', 1440, 900], ['1024', 1024, 768], ['390', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    const panel = async (dosya: string) => {
      await page.waitForTimeout(1200)
      const el = page.getByTestId('sulama-paneli')
      await el.evaluate((n) => { n.scrollTop = 0 })
      await page.screenshot({ path: join(cikti, `${dosya}-${ad}.png`) })
      const tam = await el.evaluate((n) => n.scrollHeight)
      await el.evaluate((n) => { n.style.height = `${n.scrollHeight}px`; n.style.overflow = 'visible' })
      await page.setViewportSize({ width, height: Math.min(6000, tam + 200) })
      await page.waitForTimeout(500)
      await el.screenshot({ path: join(cikti, `${dosya}-tam-${ad}.png`) })
      await page.setViewportSize({ width, height })
    }
    await page.goto(`/bahceler/${g.id}/su/sulama`)
    await page.getByTestId('sulama-kpi').waitFor({ timeout: 45_000 })
    await panel('u9h4-bugun')
    await page.goto(`/bahceler/${g.id}/su/sulama`)
    await page.getByTestId('sulama-sekme-simulasyon').click()
    await page.getByTestId('sim-sayaclar').waitFor({ timeout: 45_000 })
    await panel('u9h4-simulasyon')
    await page.goto(`/bahceler/${g.id}/su`)
    await page.getByTestId('sulama-karti').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: join(cikti, `u9h4-su-karti-${ad}.png`) })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  const bos = await createGarden(page.request, { ad: 'Profilsiz Bahçe', lng: 27.83, lat: 38.73, sideM: 200 })
  await page.goto(`/bahceler/${bos.id}/su/sulama`)
  await page.getByTestId('sulama-baslat').waitFor({ timeout: 30_000 })
  await page.screenshot({ path: join(cikti, 'u9h4-profil-yok-1440.png') })
})
