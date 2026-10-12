import { expect, test } from '@playwright/test'
import { newUser, PASSWORD } from './yardimcilar'

test('giriş yapınca /bahceler açılır; bahçesi olmayan kullanıcı ekleme davetiyesini görür', async ({ page }) => {
  const email = await newUser(page)
  await page.context().clearCookies()

  await page.goto('/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Giriş yap' }).click()

  await expect(page).toHaveURL(/\/bahceler$/)
  await expect(page.getByRole('heading', { name: 'İlk bahçenizi ekleyin' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Bahçe ekle' })).toBeVisible()
})

test('oturum yoksa /bahceler girişe yönlendirir', async ({ page }) => {
  await page.goto('/bahceler')
  await expect(page).toHaveURL(/\/login/)
})
test('yanlış şifre anlaşılır hata gösterir', async ({ page }) => {
  const email = await newUser(page)
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre-123')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('şifre göster/gizle çalışır; ağ kesilince anlaşılır uyarı verilir', async ({ page }) => {
  await page.goto('/login')
  const password = page.getByLabel('Şifre', { exact: true })
  await password.fill('gizli-sifre')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Şifreyi göster' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Şifreyi gizle' }).click()
  await expect(password).toHaveAttribute('type', 'password')

  await page.route('**/api/auth/login', (route) => route.abort())
  await page.getByLabel('E-posta').fill('ag@example.test')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('alert')).toContainText('Bağlantınızı kontrol edin')
})
