import { expect, test } from '@playwright/test'
import { createGarden, newUser } from './yardimcilar'

test.beforeEach(async ({ page }) => {
  await newUser(page)
})

test('bahçe açılınca URL, sekmeler, geri tuşu ve derin bağlantı çalışır', async ({ page }) => {
  const garden = await createGarden(page.request, { ad: 'Rota Bahçesi', lng: 27.5, lat: 38.5 })
  await page.goto('/bahcem')
  await page.getByRole('link', { name: 'Rota Bahçesi bahçesini aç' }).click()
  await expect(page).toHaveURL(new RegExp(`/bahcem/${garden.id}/durum$`))
  await expect(page.getByTestId('detail-column')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('left-panel')).toHaveAttribute('data-open', 'false') // liste ikon şeridine daralır

  await page.getByRole('tab', { name: 'Analiz' }).click()
  await expect(page).toHaveURL(/\/analiz$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/durum$/)

  await page.goto(`/bahcem/${garden.id}/gunluk`)
  await expect(page.getByRole('tab', { name: 'Günlük', selected: true })).toBeVisible()
  await expect(page.getByTestId('coming-soon').first()).toContainText('Adım')
})

test('geçersiz sekme durum sekmesine, bilinmeyen bahçe listeye yönlenir', async ({ page }) => {
  const garden = await createGarden(page.request, { ad: 'Yönlenen', lng: 27.6, lat: 38.6 })
  await page.goto(`/bahcem/${garden.id}/yok`)
  await expect(page).toHaveURL(/\/durum$/)

  await page.goto('/bahcem/00000000-0000-0000-0000-000000000000/durum')
  await expect(page).toHaveURL(/\/bahcem$/)
  await expect(page.getByText('Bu bahçe bulunamadı')).toBeVisible()
})

test('sol menü bölümleri "Yakında" gösterir; planlama rotası kapalı; Copilot çekmecesi açılır', async ({ page }) => {
  await page.goto('/bahcem')
  await expect(page.getByRole('link', { name: 'Ayarlar' })).toBeVisible()
  const rail = await page.getByRole('navigation', { name: 'Ana gezinme' }).getByRole('link').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
  expect(rail).toEqual(['Bahçelerim', 'İşlerim', 'Hizmetler', 'Pazar', 'Bildirimler', 'Ayarlar'])
  for (const [name, soon, sample] of [
    ['İşlerim', 'Yakında – Faz 1.5', 'Hibe ve destek'],
    ['Hizmetler', 'Yakında – Faz 1.5', 'Saha ekipleri'],
    ['Pazar', 'Yakında – Adım 17', 'Girdi ve finansman'],
  ] as const) {
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page.getByText(soon).first()).toBeVisible()
    await expect(page.getByTestId('coming-soon').filter({ hasText: sample })).toBeVisible()
  }
  await page.getByRole('link', { name: 'Bildirimler', exact: true }).click()
  await expect(page.getByTestId('notifications-panel')).toBeVisible()
  await expect(page.getByText('Henüz bildirim yok')).toBeVisible()
  await page.getByRole('link', { name: 'Ayarlar' }).click()
  await expect(page.getByRole('button', { name: 'Çıkış yap' })).toBeVisible()
  await expect(page.getByText('Planlama')).toHaveCount(0)

  await page.goto('/planning')
  await expect(page).toHaveURL(/\/bahcem$/)

  await page.getByRole('button', { name: /Copilot/ }).click()
  await expect(page.getByRole('complementary', { name: 'Copilot' })).toBeVisible()
  await expect(page.getByLabel('Mesajınız')).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: 'Copilot' })).toBeHidden()
})
