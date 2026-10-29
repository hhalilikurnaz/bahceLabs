import { test } from '@playwright/test'
import { join } from 'node:path'
import { createGarden, newUser, seedOlayOzet, seedSaha, seedScenes } from './yardimcilar'

/**
 * EKRAN GÖRÜNTÜSÜ aracı (test değil): dolu saha turu, doğrulama yanıtı, kayıtlar ve bildirim özet maddeleri test tohumlu bahçeden alınır.
 * Yalnız `EKRAN_CIKTI=<klasör>` verilince koşar: EKRAN_CIKTI=… npx playwright test e2e/ekran-9g.spec.ts
 */
test.skip(!process.env.EKRAN_CIKTI, 'ekran görüntüsü aracı: EKRAN_CIKTI verilince çalışır')

test('9G: dolu saha turu, doğrulama, kayıtlar, Geçmiş çizelgesi ve bildirim özeti (test tohumlu, açık tema)', async ({ page }) => {
  test.setTimeout(240_000)
  const cikti = process.env.EKRAN_CIKTI as string
  await page.emulateMedia({ colorScheme: 'light' })
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Tohumlu Bahçe', lng: 27.97, lat: 38.97, sideM: 300 })
  seedScenes(garden.id)
  seedOlayOzet(garden.id)
  seedSaha(garden.id)
  const bugun = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const c = [27.97, 38.97]
  const kayit = async (data: Record<string, unknown>) => (await page.request.post(`/api/gardens/${garden.id}/saha-kayitlari`, { data: { tarih: bugun, ...data } })).ok()
  await kayit({ tur: 'gozlem', konum: { type: 'Point', coordinates: [c[0] + 0.0004, c[1] + 0.0003] }, aciklama: 'Güney köşede yaprak ucu kuruması' })
  await kayit({ tur: 'ilaclama', konum: { type: 'Polygon', coordinates: [[[c[0] - 0.0008, c[1] - 0.0004], [c[0] - 0.0003, c[1] - 0.0004], [c[0] - 0.0003, c[1] + 0.0001], [c[0] - 0.0008, c[1] - 0.0004]]] }, aciklama: 'Bait püskürtme, 3. blok' })
  await kayit({ tur: 'hasat', tarih: '2025-11-12', konum: null, aciklama: 'İlk hasat: 42 kasa' })
  const olaylar = await (await page.request.get(`/api/gardens/${garden.id}/olaylar`)).json()
  const don = olaylar.olaylar.find((o: { tur: string }) => o.tur === 'don')
  await page.request.put(`/api/gardens/${garden.id}/dogrulama`, { data: { hedef_tur: 'olay', hedef_anahtar: (await (await page.request.get(`/api/gardens/${garden.id}/dogrulama`)).json()).kartlar.find((k: { olay_id: string }) => k.olay_id === don?.id)?.hedef_anahtar, sonuc: 'gerceklesti', aciklama: 'Sabah çiğ donmuştu' } })
  for (const [ad, width, height] of [['1440', 1440, 900], ['1024', 1024, 768], ['390', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    const kutu = async (id: string, dosya: string) => {
      await page.setViewportSize({ width, height: 2400 })
      await page.waitForTimeout(700)
      const el = page.getByTestId(id)
      await el.scrollIntoViewIfNeeded()
      await el.screenshot({ path: join(cikti, `${dosya}-${ad}.png`) })
      await page.setViewportSize({ width, height })
    }
    await page.goto(`/bahceler/${garden.id}/defter`)
    await page.getByTestId('tur-noktasi').first().waitFor({ timeout: 30_000 })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: join(cikti, `defter-dolu-ust-${ad}.png`) })
    await page.getByTestId('tur-noktasi').first().getByRole('button').first().click()
    await kutu('tur-bolumu', 'defter-dolu-saha-turu')
    await kutu('dogrulama-bolumu', 'defter-dolu-dogrulama-kartlari')
    await page.getByTestId('kartlar-hepsi').click()
    await kutu('dogrulama-bolumu', 'defter-dolu-dogrulama-yanitlanmis')
    await kutu('kayit-listesi', 'defter-dolu-kayitlar')
    await kutu('dogruluk-bolumu', 'defter-dolu-dogruluk-ozeti')
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    await page.getByTestId('olay-cizelgesi').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(3000)
    await kutu('olay-cizelgesi', 'gecmis-dolu-olay-cizelgesi-yanit-ve-kayitlar')
    await kutu('yil-tablosu', 'gecmis-dolu-yil-ozeti-hasat-kaydi')
    await page.goto('/bahceler')
    await page.getByTestId('bildirim-ac').click()
    await page.getByTestId('notifications-panel').waitFor({ timeout: 15_000 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: join(cikti, `bildirim-paneli-ozet-maddeleri-${ad}.png`) })
    await page.keyboard.press('Escape')
  }
})
