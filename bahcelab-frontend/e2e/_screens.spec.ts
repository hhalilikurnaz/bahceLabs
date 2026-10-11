import { test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

const OUT = '/Users/halilibrahimkurnaz/Desktop/bahcelab-ekran-goruntuleri/adim-7/7B-2'
test.setTimeout(240_000)

test('ekran görüntüleri', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Dere Kenarı Limonluğu', lng: 27.45, lat: 38.45, sideM: 220 })
  await createGarden(page.request, { ad: 'Yeni Bahçe (veri yok)', lng: 27.47, lat: 38.46, sideM: 140 })
  seedScenes(g.id)
  const shot = async (name: string) => { await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/sonra-${name}.png` }) }

  await page.goto('/bahcem')
  await shot('liste')
  await page.goto(`/bahcem/${g.id}/durum`)
  await page.waitForTimeout(4000)
  await shot('uc-bolge-durum')
  for (const [tab, slug] of [['Analiz','analiz'],['Hava','hava'],['Günlük','gunluk'],['Rapor','rapor']] as const) {
    await page.getByRole('tab', { name: tab }).click()
    await shot(slug)
  }
  await page.getByRole('tab', { name: 'Durum' }).click()
  await page.getByRole('button', { name: 'Tam harita' }).click()
  await shot('tam-harita')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Copilot' }).click()
  await shot('copilot')
  await page.keyboard.press('Escape')

  // Arşiv: 4 mod
  await page.goto(`/bahcem/${g.id}/arsiv?parametre=ndvi`)
  await page.waitForTimeout(5000)
  await shot('arsiv-tek')
  await page.getByRole('radio', { name: 'İki tarihi karşılaştır' }).click()
  await page.waitForTimeout(3000)
  await shot('arsiv-karsilastir')
  await page.getByRole('radio', { name: 'Değişim haritası' }).click()
  await page.waitForTimeout(3000)
  await shot('arsiv-degisim')
  await page.getByRole('radio', { name: 'Zaman atlaması' }).click()
  await page.waitForTimeout(3000)
  await shot('arsiv-zaman')

  // Boş durumlar
  const empty = await createGarden(page.request, { ad: 'Boş', lng: 27.6, lat: 38.6, sideM: 100 })
  await page.goto(`/bahcem/${empty.id}/arsiv`)
  await shot('arsiv-bos')

  // Mobil 375
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/bahcem')
  await shot('mobil-liste')
  await page.goto(`/bahcem/${g.id}/durum`)
  await shot('mobil-durum')
  await page.goto(`/bahcem/${g.id}/arsiv?parametre=ndvi`)
  await page.waitForTimeout(4000)
  await shot('mobil-arsiv')
  await page.getByRole('button', { name: 'Tarihler' }).click()
  await shot('mobil-arsiv-tarihler')
})
