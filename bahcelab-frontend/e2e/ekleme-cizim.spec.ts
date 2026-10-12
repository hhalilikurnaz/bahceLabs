import { expect, test } from '@playwright/test'
import { mapPoint, newUser, startAt } from './yardimcilar'

const LNG = 27.4
const LAT = 38.4

async function openDraw(page: import('@playwright/test').Page) {
  await page.goto('/bahceler/yeni')
  await page.getByRole('button', { name: 'Bahçe ekle' }).click()
  await page.getByRole('menuitem', { name: /Haritada çiz/ }).click()
  await expect(page.getByRole('region', { name: 'Bahçeyi çiz' })).toBeVisible()
}

test('çokgen çiz → kenar uzunlukları ve canlı alan → doğrulama hatası → düzelt → kaydet → işleniyor → hazır', async ({ page }) => {
  await newUser(page)
  await startAt(page, LNG, LAT)
  // Kayıttan sonra uydu verisi durumunu denetlemek için sunucu yanıtı sırayla taklit edilir
  let polls = 0
  await page.route('**/api/gardens/*/indeks', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    polls += 1
    const job = polls < 3 ? { id: 'j1', tur: 'ilk', durum: 'isleniyor', toplam: 10, islenen: 4, hata_mesaji: null } : { id: 'j1', tur: 'ilk', durum: 'tamam', toplam: 10, islenen: 10, hata_mesaji: null }
    await route.fulfill({ json: { gozlemler: [], isleme: job, son_kontrol: null, uyarilar: [], eksik_cikti: false } })
  })
  await openDraw(page)
  await page.getByRole('button', { name: 'Çizime başla' }).click()

  for (const [dx, dy] of [[-70, -60], [70, -60], [70, 60], [-70, 60]] as const) {
    const p = await mapPoint(page, dx, dy)
    await page.mouse.click(p.x, p.y)
  }
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Sınır tamam' })).toBeVisible()
  await expect(page.getByTestId('live-area')).toContainText('dekar')
  expect(await page.getByTestId('edge-label').count()).toBeGreaterThanOrEqual(4)
  await expect(page.getByTestId('edge-label').first()).toContainText(/\d+ m/)

  await page.getByRole('button', { name: 'Sınır tamam' }).click()
  await expect(page.getByTestId('form-area')).toContainText('dekar')

  // Doğrulama: boş ad ve geçersiz yıl alanın başında anlaşılır dille bildirilir
  await page.getByLabel('Dikim yılı (isteğe bağlı)').fill('1850')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText('Bahçe adı boş olamaz')).toBeVisible()
  await expect(page.getByText(/Dikim yılı 1900 ile/)).toBeVisible()

  await page.getByLabel('Bahçe adı').fill('Çizilen Bahçe')
  await page.getByLabel('Dikim yılı (isteğe bağlı)').fill('2014')
  await page.getByLabel('Ağaç sayısı (isteğe bağlı)').fill('480')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  await expect(page).toHaveURL(/\/bahceler\/[0-9a-f-]{36}$/)
  await expect(page.getByText('“Çizilen Bahçe” için uydu görüntüleri hazır.')).toBeVisible({ timeout: 30_000 })
})

test('daire çiz: yarıçap görünür, çokgene çevrilir ve alan hesaplanır', async ({ page }) => {
  await newUser(page)
  await startAt(page, LNG, LAT)
  await openDraw(page)
  await page.getByRole('radio', { name: 'Daire' }).click()
  await page.getByRole('button', { name: 'Çizime başla' }).click()
  const center = await mapPoint(page, 0, 0)
  await page.mouse.click(center.x, center.y)
  await page.mouse.move(center.x + 60, center.y)
  await page.mouse.move(center.x + 90, center.y)
  await page.mouse.click(center.x + 90, center.y)
  await expect(page.getByRole('button', { name: 'Sınır tamam' })).toBeVisible()
  await expect(page.getByTestId('live-area')).toContainText('dekar')
  await page.getByRole('button', { name: 'Sınır tamam' }).click()
  await expect(page.getByTestId('form-area')).toContainText('dekar')
})

test('çok küçük alan "0,5 dekardan küçük olamaz" uyarısı verir; geri al / yinele çalışır', async ({ page }) => {
  await newUser(page)
  await startAt(page, LNG, LAT, 19)
  await openDraw(page)
  await page.getByRole('button', { name: 'Çizime başla' }).click()
  for (const [dx, dy] of [[-40, -40], [40, -40], [40, 40], [-40, 40]] as const) {
    const p = await mapPoint(page, dx, dy)
    await page.mouse.click(p.x, p.y)
  }
  // Çizim sürerken son köşe geri alınır ve yinelenir
  await page.getByRole('button', { name: 'Geri al' }).click()
  await expect(page.getByRole('button', { name: 'Yinele' })).toBeEnabled()
  await page.getByRole('button', { name: 'Yinele' }).click()
  await page.getByRole('button', { name: 'Çizimi bitir' }).click()
  await page.getByRole('button', { name: 'Sınır tamam' }).click()
  await expect(page.getByTestId('area-error')).toContainText('0,5 dekar')
})
