import { expect, test } from '@playwright/test'
import { createGarden, newUser, square } from './yardimcilar'

test.beforeEach(async ({ page }) => {
  await newUser(page)
})

test('GeoJSON dosyasından bahçe eklenir, çubukta görünür, adı değiştirilir ve silinir', async ({ page }) => {
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
  await page.goto('/bahceler/yeni')
  await page.getByRole('button', { name: 'Bahçe ekle' }).first().click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: /Dosya yükle/ }).click()
  await (await chooser).setFiles(file)

  await expect(page.getByRole('heading', { name: 'Yeni bahçe' })).toBeVisible()
  await expect(page.getByLabel('Bahçe adı')).toHaveValue('İçe aktarılan')
  await expect(page.getByText(/dekar/).first()).toBeVisible() // alan sunucuda hesaplandı
  await page.getByRole('button', { name: 'Kaydet' }).click()

  await expect(page).toHaveURL(/\/bahceler\/[0-9a-f-]{36}$/)

  // Bahçe çubuğu: ad, yeni bahçe için henüz görüntü yok (dürüst boş durum)
  await expect(page.getByTestId('bahce-secici')).toContainText('İçe aktarılan')
  await expect(page.getByTestId('tarih-kutusu')).toContainText('görüntü yok')

  // Ad değiştir
  await page.getByRole('button', { name: 'İçe aktarılan işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Adını düzenle' }).click()
  await page.getByLabel('Bahçe adı').fill('Yeni Ad')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('bahce-secici')).toContainText('Yeni Ad')

  // Sil (onaylı)
  await page.getByRole('button', { name: 'Yeni Ad işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Sil' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sil' }).click()
  await expect(page.getByRole('heading', { name: 'İlk bahçenizi ekleyin' })).toBeVisible()
})

test('bozuk dosya anlaşılır hata verir ve akış bozulmaz', async ({ page }) => {
  await page.goto('/bahceler/yeni')
  await page.getByRole('button', { name: 'Bahçe ekle' }).first().click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: /Dosya yükle/ }).click()
  await (await chooser).setFiles({ name: 'bozuk.geojson', mimeType: 'application/geo+json', buffer: Buffer.from('{ bu json degil') })
  await expect(page.getByText(/okunamadı|geçersiz|bulunamadı/i).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Yeni bahçe' })).toHaveCount(0)
})

test('başka bir bahçeyle örtüşen sınır uyarı verir (engellemez); komşu parsel uyarmaz', async ({ page }) => {
  await createGarden(page.request, { ad: 'Mevcut', lng: 27.7, lat: 38.7, sideM: 150 })
  const upload = async (geometry: GeoJSON.Polygon) => {
    await page.goto('/bahceler/yeni')
    await page.getByRole('button', { name: 'Bahçe ekle' }).first().click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('menuitem', { name: /Dosya yükle/ }).click()
    await (await chooser).setFiles({ name: 'b.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Yeni' }, geometry }] })) })
    await expect(page.getByRole('heading', { name: 'Yeni bahçe' })).toBeVisible()
  }
  await upload(square(27.7005, 38.7, 150)) // büyük ölçüde örtüşür
  await expect(page.getByTestId('ortusme-uyarisi')).toContainText('“Mevcut”')
  await expect(page.getByRole('button', { name: 'Kaydet' })).toBeEnabled() // engellemez

  await upload(square(27.7035, 38.7, 150)) // yan yana, örtüşmez
  await expect(page.getByTestId('form-area')).toContainText('dekar')
  await expect(page.getByTestId('ortusme-uyarisi')).toHaveCount(0)
})
