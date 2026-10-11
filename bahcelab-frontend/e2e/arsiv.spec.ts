import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

test('kapsül → Tüm görüntüler → parametre değiştir → tarih seç → iki tarihi karşılaştır → geri dön', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Arşiv Bahçesi', lng: 27.5, lat: 38.5, sideM: 220 })
  seedScenes(garden.id)
  await page.goto(`/bahcem/${garden.id}/durum`)

  const dateLabel = page.getByTestId('map-date-label')
  await expect(dateLabel).toContainText('Canlılık')
  const latestText = (await dateLabel.innerText()).trim()

  await page.getByRole('link', { name: 'Tüm görüntüler' }).click()
  await expect(page).toHaveURL(/\/arsiv\?parametre=ndvi/)
  await expect(page.getByTestId('archive-viewer')).toBeVisible()

  // Parametre değiştir → adres güncellenir
  await page.getByTestId('param-ndmi').click()
  await expect(page).toHaveURL(/parametre=ndmi/)

  // Tarih seç
  const thumbs = page.getByTestId('archive-thumb')
  await expect(thumbs.first()).toBeVisible({ timeout: 30_000 })
  const count = await thumbs.count()
  expect(count).toBeGreaterThan(3)
  await thumbs.nth(2).click()
  const picked = await thumbs.nth(2).getAttribute('data-date')
  await expect(page).toHaveURL(new RegExp(`tarih=${picked}`))

  // İki tarihi karşılaştır (kaydırıcı), sonra yan yana
  await page.getByRole('radio', { name: 'İki tarihi karşılaştır' }).click()
  await expect(page).toHaveURL(/mod=karsilastir/)
  await page.getByRole('button', { name: /ikinci görüntü \(B\) yap/ }).nth(4).click()
  await expect(page).toHaveURL(/b=\d{4}-\d{2}-\d{2}/)
  await expect(page.getByTestId('compare-slider')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('radio', { name: 'Yan yana' }).click()
  await expect(page.getByTestId('compare-side')).toBeVisible()

  // Net filtresi varsayılan açık; kapatınca daha çok görüntü listelenir
  await page.getByText('Yalnız net görüntüler').click()
  await expect(page).toHaveURL(/net=0/)
  expect(await thumbs.count()).toBeGreaterThanOrEqual(count)

  // Geri dön: ana ekran hâlâ en güncel görüntüyü gösterir
  await page.getByRole('button', { name: 'Bahçeye dön' }).click()
  await expect(page).toHaveURL(new RegExp(`/bahcem/${garden.id}/durum$`))
  await expect(page.getByTestId('map-date-label')).toHaveText(latestText)
})

test('bulutlu dönemde boş durum ve «bulutlu tarihleri göster»', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Bulutlu Dönem', lng: 27.55, lat: 38.55, sideM: 200 })
  seedScenes(garden.id)
  // Geçmiş bir sezonda net görüntü yok: filtre açıkken boş durum görünür
  await page.route('**/api/gardens/*/indeks/arsiv*', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({
      response,
      json: { ...body, sahneler: body.sahneler.map((s: Record<string, unknown>) => ({ ...s, net: false, en_net: false })) },
    })
  })
  await page.goto(`/bahcem/${garden.id}/arsiv?parametre=ndvi`)
  await expect(page.getByText('Bu dönemde net görüntü yok')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Bulutlu tarihleri göster' }).click()
  await expect(page.getByTestId('archive-thumb').first()).toBeVisible()
})
