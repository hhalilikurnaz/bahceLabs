import { expect, test } from '@playwright/test'
import { newUser, PASSWORD } from './yardimcilar'

test('giriş yapınca /bahcem açılır; bahçesi olmayan kullanıcı 3 adımlı yönlendirmeyi görür', async ({ page }) => {
  const email = await newUser(page)
  await page.context().clearCookies()

  await page.goto('/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill(PASSWORD)
  await page.getByRole('button', { name: 'Giriş yap' }).click()

  await expect(page).toHaveURL(/\/bahcem$/)
  await expect(page.getByRole('heading', { name: 'İlk bahçenizi ekleyin' })).toBeVisible()
  await expect(page.getByTestId('onboarding').getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Bahçe ekle' })).toBeVisible()
})

test('oturum yoksa /bahcem girişe yönlendirir', async ({ page }) => {
  await page.goto('/bahcem')
  await expect(page).toHaveURL(/\/login/)
})

test('yanlış şifre anlaşılır hata gösterir', async ({ page }) => {
  const email = await newUser(page)
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('yanlis-sifre-123')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
