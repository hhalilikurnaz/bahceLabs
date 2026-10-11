import { expect, test } from '@playwright/test'
import { newUser, square } from './yardimcilar'

test.beforeEach(async ({ page }) => {
  await newUser(page)
})

test('GeoJSON dosyasından bahçe eklenir, kart görünür, ad değiştirilir ve silinir', async ({ page }) => {
  const file = {
    name: 'bahce.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { name: 'İçe aktarılan' }, geometry: square(27.7, 38.7, 150) }],
      }),
    ),
  }
  await page.goto('/bahcem')
  await page.getByRole('button', { name: 'Bahçe ekle' }).first().click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: /Dosya yükle/ }).click()
  await (await chooser).setFiles(file)

  await expect(page.getByRole('heading', { name: 'Yeni bahçe' })).toBeVisible()
  await expect(page.getByLabel('Bahçe adı')).toHaveValue('İçe aktarılan')
  await expect(page.getByText(/dekar/).first()).toBeVisible() // alan sunucuda hesaplandı
  await page.getByRole('button', { name: 'Kaydet' }).click()

  await expect(page).toHaveURL(/\/bahcem\/[0-9a-f-]{36}\/durum$/)
  await expect(page.getByRole('heading', { name: 'İçe aktarılan' })).toBeVisible()

  // Liste: kart, durum etiketi (henüz görüntü yok → dürüst "Veri yok")
  await page.getByRole('button', { name: 'Bahçe listesine dön' }).click()
  const card = page.getByTestId('garden-card')
  await expect(card).toHaveCount(1)
  await expect(card).toHaveAttribute('data-status', 'veri_yok')
  await expect(page.getByTestId('list-summary')).toContainText('1')

  // Ad değiştir
  await page.getByRole('button', { name: 'İçe aktarılan işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Adını düzenle' }).click()
  await page.getByLabel('Bahçe adı').fill('Yeni Ad')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Yeni Ad' })).toBeVisible()

  // Sil (onaylı)
  await page.getByRole('button', { name: 'Yeni Ad işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Sil' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()
  await expect(page.getByTestId('garden-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'İlk bahçenizi ekleyin' })).toBeVisible()
})

test('bozuk dosya anlaşılır hata verir ve akış bozulmaz', async ({ page }) => {
  await page.goto('/bahcem')
  await page.getByRole('button', { name: 'Bahçe ekle' }).first().click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: /Dosya yükle/ }).click()
  await (await chooser).setFiles({ name: 'bozuk.geojson', mimeType: 'application/geo+json', buffer: Buffer.from('{ bu json degil') })
  await expect(page.getByText(/okunamadı|geçersiz|bulunamadı/i).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Yeni bahçe' })).toHaveCount(0)
})
