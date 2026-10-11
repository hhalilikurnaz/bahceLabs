import { expect, test } from '@playwright/test'
import { createGarden, newUser } from './yardimcilar'

test('ağ kesilince uyarı çıkar, bağlantı gelince kapanır', async ({ page, context }) => {
  await newUser(page)
  await createGarden(page.request, { ad: 'Ağ Testi', lng: 27.7, lat: 38.7 })
  await page.goto('/bahcem')
  await expect(page.getByTestId('garden-card')).toHaveCount(1)

  await context.setOffline(true)
  await expect(page.getByTestId('offline-banner')).toContainText('İnternet bağlantısı yok')
  await context.setOffline(false)
  await expect(page.getByTestId('offline-banner')).toHaveCount(0)
})

test('uydu verisi alınamazsa anlaşılır hata ve «Tekrar dene» gösterilir; düzelince veri gelir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Hata Durumu', lng: 27.71, lat: 38.71 })
  let fail = true
  await page.route('**/api/gardens/*/indeks', async (route) => {
    if (route.request().method() === 'GET' && fail) return route.abort()
    return route.continue()
  })
  await page.goto(`/bahcem/${garden.id}/durum`)
  await expect(page.getByRole('heading', { name: 'Uydu verisi alınamadı' })).toBeVisible({ timeout: 40_000 })
  fail = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByTestId('summary-cards')).toBeVisible()
})

test('yüklenirken iskelet, bahçe yokken yönlendirme ve arşivde boş durum tutarlı görünür', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Boş Arşiv', lng: 27.72, lat: 38.72 })
  await page.goto(`/bahcem/${garden.id}/arsiv`)
  await expect(page.getByText('Bu parametre için görüntü yok')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Bahçeye dön' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/bahcem/${garden.id}/durum$`))
})
