import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

test('ağ kesilince uyarı çıkar, bağlantı gelince kapanır', async ({ page, context }) => {
  await newUser(page)
  await createGarden(page.request, { ad: 'Ağ Testi', lng: 27.7, lat: 38.7 })
  await page.goto('/bahceler')
  await expect(page.getByTestId('tum-bahceler')).toBeVisible()

  await context.setOffline(true)
  await expect(page.getByTestId('offline-banner')).toContainText('İnternet bağlantısı yok')
  await context.setOffline(false)
  await expect(page.getByTestId('offline-banner')).toHaveCount(0)
})

test('uydu verisi alınamazsa anlaşılır hata ve «Tekrar dene» gösterilir; düzelince veri gelir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Hata Durumu', lng: 27.71, lat: 38.71, sideM: 200 })
  seedScenes(garden.id)
  let fail = true
  await page.route('**/api/gardens/*/edinimler', async (route) => {
    if (route.request().method() === 'GET' && fail) return route.abort()
    return route.continue()
  })
  await page.goto(`/bahceler/${garden.id}`)
  await expect(page.getByRole('heading', { name: 'Uydu verisi alınamadı' })).toBeVisible({ timeout: 40_000 })
  fail = false
  await page.getByRole('button', { name: 'Tekrar dene' }).first().click()
  await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
})

test('görüntüsü olmayan bahçede harita dürüst boş durum gösterir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Boş Bahçe', lng: 27.72, lat: 38.72 })
  await page.goto(`/bahceler/${garden.id}`)
  await expect(page.getByTestId('harita-paneli')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('histogram-lejant')).toHaveCount(0)
  await expect(page.getByTestId('tarih-kutusu')).toContainText('görüntü yok')
})
