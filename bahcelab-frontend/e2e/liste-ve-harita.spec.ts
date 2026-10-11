import { expect, test } from '@playwright/test'
import { createGarden, newUser } from './yardimcilar'

test('liste özeti, filtre, sıralama; harita etiketi; Tam harita ve Esc', async ({ page }) => {
  await newUser(page)
  await createGarden(page.request, { ad: 'Büyük Bahçe', lng: 27.8, lat: 38.8, sideM: 300 })
  await createGarden(page.request, { ad: 'Arı Bahçe', lng: 27.801, lat: 38.801, sideM: 120 })
  await page.goto('/bahcem')

  await expect(page.getByTestId('garden-card')).toHaveCount(2)
  await expect(page.getByTestId('list-summary')).toContainText('2 bahçe')

  // Sıralama: ada göre (Türkçe) → "Arı" önce
  await page.getByLabel('Sırala').selectOption('ad')
  await expect(page.getByTestId('garden-card').first()).toContainText('Arı Bahçe')
  await page.getByLabel('Sırala').selectOption('alan')
  await expect(page.getByTestId('garden-card').first()).toContainText('Büyük Bahçe')

  // Filtre ve arama
  await page.getByLabel('Bahçe ara').fill('büyük')
  await expect(page.getByTestId('garden-card')).toHaveCount(1)
  await page.getByLabel('Bahçe ara').fill('yok-boyle-bir-sey')
  await expect(page.getByText('Eşleşen bahçe yok')).toBeVisible()
  await page.getByLabel('Bahçe ara').fill('')

  // Bahçe sayfası geniş panel; Tam harita paneli daraltır, Esc geri açar
  await page.getByRole('link', { name: 'Büyük Bahçe bahçesini aç' }).click()
  await expect(page.getByTestId('left-panel')).toHaveAttribute('data-kind', 'detail')
  await page.getByRole('button', { name: 'Tam harita' }).click()
  await expect(page.getByTestId('left-panel')).toHaveAttribute('data-kind', 'collapsed')
  await expect(page.getByTestId('full-map-bar')).toContainText('Büyük Bahçe')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('left-panel')).toHaveAttribute('data-kind', 'detail')

  // Atıf: Mapbox altlığında logo ve "Improve this map" görünür
  await expect(page.getByTestId('map-attribution')).toContainText('Improve this map')
})

test('liste API hatasında anlaşılır hata ve "Tekrar dene" gösterilir', async ({ page }) => {
  await newUser(page)
  await page.route('**/api/gardens/overview*', (route) => route.abort())
  await page.goto('/bahcem')
  await expect(page.getByRole('heading', { name: 'Bahçeler yüklenemedi' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
})
