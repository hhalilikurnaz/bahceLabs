import { expect, test } from '@playwright/test'
import { createGarden, newUser } from './yardimcilar'

test.beforeEach(async ({ page }) => {
  await newUser(page)
})

test('bahçe seçilince URL, sekmeler, geri tuşu ve derin bağlantı çalışır', async ({ page }) => {
  const garden = await createGarden(page.request, { ad: 'Rota Bahçesi', lng: 27.5, lat: 38.5 })
  await page.goto('/bahceler')
  await expect(page.getByTestId('tum-bahceler')).toBeVisible() // tüm bahçeler: harita + liste
  await page.getByTestId('bahce-satiri').filter({ hasText: 'Rota Bahçesi' }).click()
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))
  await expect(page.getByTestId('bahce-secici')).toContainText('Rota Bahçesi')

  await page.getByRole('tab', { name: 'Analiz' }).click()
  await expect(page).toHaveURL(/\/analiz$/)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))

  await page.goto(`/bahceler/${garden.id}/gunluk`)
  await expect(page.getByRole('tab', { name: 'Günlük', selected: true })).toBeVisible()
  await expect(page.getByTestId('panel-gunluk').getByRole('heading', { name: 'Günlük' })).toBeVisible()
  await expect(page.getByText('Adım 11')).toBeVisible()

  await page.goto(`/bahceler/${garden.id}/su`)
  await expect(page.getByTestId('bos-su')).toContainText('9E')
})

test('tam sayfalar: Geçmiş ve Saha Defteri iskelet olarak açılır', async ({ page }) => {
  const garden = await createGarden(page.request, { ad: 'Sayfa Bahçesi', lng: 27.51, lat: 38.51 })
  await page.goto(`/bahceler/${garden.id}`)
  await page.getByRole('link', { name: 'Geçmiş ↗' }).click()
  await expect(page).toHaveURL(/\/gecmis$/)
  await expect(page.getByTestId('bos-gecmis')).toContainText('9G')
  await page.getByRole('link', { name: 'Saha Defteri ↗' }).click()
  await expect(page).toHaveURL(/\/defter$/)
  await expect(page.getByTestId('bos-defter')).toContainText('9G')
})

test('geçersiz sekme durum sekmesine, bilinmeyen bahçe listeye yönlenir', async ({ page }) => {
  const garden = await createGarden(page.request, { ad: 'Yönlenen', lng: 27.6, lat: 38.6 })
  await page.goto(`/bahceler/${garden.id}/yok`)
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))

  await page.goto('/bahceler/00000000-0000-0000-0000-000000000000')
  await expect(page.getByText('Bu bahçe bulunamadı')).toBeVisible()
})

test('eski /bahcem adresleri yeni rotalara yönlenir', async ({ page }) => {
  const garden = await createGarden(page.request, { ad: 'Eski Adres', lng: 27.61, lat: 38.61 })
  await page.goto(`/bahcem/${garden.id}/durum`)
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))
  await page.goto(`/bahcem/${garden.id}/hava`)
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}/hava$`))
  await page.goto('/bahcem')
  await expect(page).toHaveURL(/\/bahceler$/)
})

test('üst gezinme: «Faz 1.5 / Adım 17» bölümleri; planlama rotası kapalı; Copilot düğmesi yok; ayarlar', async ({ page }) => {
  await page.goto('/bahceler')
  await expect(page.getByRole('navigation', { name: 'Ana gezinme' }).getByRole('link').first()).toBeVisible()
  const nav = await page.getByRole('navigation', { name: 'Ana gezinme' }).getByRole('link').allInnerTexts()
  expect(nav.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(['Bahçeler', 'Asistan', 'İşlerim Faz 1.5', 'Hizmetler Faz 1.5', 'Pazar Adım 17'])
  for (const [name, soon] of [
    ['İşlerim', 'Faz 1.5'],
    ['Hizmetler', 'Faz 1.5'],
    ['Pazar', 'Adım 17'],
  ] as const) {
    await page.getByRole('navigation', { name: 'Ana gezinme' }).getByRole('link', { name: new RegExp(`^${name}`) }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.locator('section').getByText(soon, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /Copilot/ })).toHaveCount(0)

  await page.getByRole('button', { name: /^Hesap:/ }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  await expect(page).toHaveURL(/\/ayarlar$/)
  await expect(page.getByTestId('notification-preferences')).toBeVisible()

  await page.goto('/planning')
  await expect(page).toHaveURL(/\/bahceler/)
})

test.describe('1024 px', () => {
  test.use({ viewport: { width: 1024, height: 768 } })
  test('üst gezinmede bütün bölümler (Pazar dahil) tam görünür; arama simgeye iner', async ({ page }) => {
    await page.goto('/bahceler')
    const nav = page.getByRole('navigation', { name: 'Ana gezinme' })
    await expect(nav.getByRole('link', { name: /^Pazar/ })).toBeVisible()
    const kapsayici = await nav.boundingBox()
    for (const ad of ['Bahçeler', 'Asistan', 'İşlerim', 'Hizmetler', 'Pazar']) {
      const kutu = await nav.getByRole('link', { name: new RegExp(`^${ad}`) }).boundingBox()
      expect(kutu, ad).not.toBeNull()
      expect((kutu?.x ?? 0) + (kutu?.width ?? 0), `${ad} kırpılmamalı`).toBeLessThanOrEqual((kapsayici?.x ?? 0) + (kapsayici?.width ?? 0) + 1)
    }
    const kaydirma = await nav.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(kaydirma, 'gezinme yatay kaymamalı').toBeLessThanOrEqual(1)
  })
})
