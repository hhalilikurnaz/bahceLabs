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
  await expect(page.getByTestId('left-panel')).toHaveAttribute('data-kind', 'detail')

  await page.getByRole('tab', { name: 'Analiz' }).click()
  await expect(page).toHaveURL(/\/analiz$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/durum$/)

  await page.goto(`/bahcem/${garden.id}/gunluk`)
  await expect(page.getByRole('tab', { name: 'Günlük', selected: true })).toBeVisible()
  await expect(page.getByTestId('coming-soon').first()).toContainText('Yakında – Adım')
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
  for (const [name, step] of [
    ['Pazar & Depo', 'Adım 17'],
    ['Bildirimler', 'Adım 8'],
  ] as const) {
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page.getByText(`Yakında – ${step}`).first()).toBeVisible()
  }
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
