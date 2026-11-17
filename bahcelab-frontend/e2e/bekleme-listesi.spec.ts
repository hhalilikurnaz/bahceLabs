import { expect, test } from '@playwright/test'
import { E2E } from './ortam'
import { axeAgirIhlalYok, beklemeSatirSayisi } from './yardimcilar'

/** Kayıtlar kapalı derleme (VITE_REGISTRATION_ENABLED=false, ayrı port): /register erken erişim formunu gösterir. */
test.use({ baseURL: E2E.beklemeWebUrl })

const eposta = () => `bekleme-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

test('form: rıza işaretsiz gelir; rıza olmadan istek gitmez; rıza ile kaydı alır', async ({ page }) => {
  const email = eposta()
  const istekler: string[] = []
  page.on('request', (r) => r.method() === 'POST' && r.url().includes('/bekleme-listesi') && istekler.push(r.url()))

  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1, name: 'Erken erişime katılın' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Kayıtlar çok yakında')
  const riza = page.getByRole('checkbox')
  await expect(riza).not.toBeChecked()
  await expect(page.getByRole('link', { name: 'Aydınlatma metnini' })).toHaveAttribute('href', '/kvkk')

  await page.getByLabel('E-posta', { exact: true }).fill(email)
  await page.getByLabel('İl', { exact: true }).fill('Mersin')
  await page.getByText('Limon', { exact: true }).click()
  await page.getByRole('button', { name: 'Erken erişime katıl' }).click()
  await expect(page.getByRole('alert')).toContainText('Açık rıza vermeden kayıt alınamaz')
  expect(istekler).toHaveLength(0)
  expect(beklemeSatirSayisi(email)).toBe(0)

  await riza.check()
  await page.getByRole('button', { name: 'Erken erişime katıl' }).click()
  await expect(page.getByRole('status')).toContainText('Kaydınız alındı')
  await expect(page.getByRole('status')).toContainText(email)
  expect(istekler).toHaveLength(1)
  expect(beklemeSatirSayisi(email)).toBe(1)
})

test('aynı e-posta tekrar gönderilince aynı yanıt, tek satır (liste yoklanamaz)', async ({ page }) => {
  const email = eposta()
  const govde = { email, il: 'Adana', urun: 'portakal', riza: true }
  const ilk = await page.request.post('/api/bekleme-listesi', { data: govde })
  const ikinci = await page.request.post('/api/bekleme-listesi', { data: { ...govde, email: email.toUpperCase() } })
  expect([ilk.status(), ikinci.status()]).toEqual([201, 201])
  expect(await ikinci.json()).toEqual(await ilk.json())
  expect(beklemeSatirSayisi(email)).toBe(1)
})

test('rıza yoksa sunucu 422 verir', async ({ page }) => {
  const r = await page.request.post('/api/bekleme-listesi', { data: { email: eposta(), il: 'Mersin', urun: 'limon', riza: false } })
  expect(r.status()).toBe(422)
})

test('hız sınırı: art arda başvurularda 429 ve anlaşılır ileti', async ({ page }) => {
  let ilk429 = -1
  for (let i = 0; i < 10; i++) {
    const r = await page.request.post('/api/bekleme-listesi', { data: { email: eposta(), il: 'Mersin', urun: 'mandalina', riza: true } })
    if (r.status() === 429) {
      expect((await r.json()).error.code).toBe('RATE_LIMITED')
      ilk429 = i
      break
    }
    expect(r.status()).toBe(201)
  }
  expect(ilk429, '10 denemede 429 gelmeli').toBeGreaterThan(-1)

  // arayüz: sınır aşılmışken form anlaşılır mesaj gösterir
  await page.goto('/register')
  await page.getByLabel('E-posta', { exact: true }).fill(eposta())
  await page.getByLabel('İl', { exact: true }).fill('Mersin')
  await page.getByText('Diğer', { exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Erken erişime katıl' }).click()
  await expect(page.getByRole('alert')).toContainText('Çok fazla deneme')
})

test('axe: erken erişim formu', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await axeAgirIhlalYok(page, 'erken erişim formu')
})

test('taslak bayrağı kapalı derlemede KVKK sayfasında taslak uyarısı yok', async ({ page }) => {
  await page.goto('/kvkk')
  await expect(page.getByRole('heading', { level: 1, name: 'Aydınlatma metni' })).toBeVisible()
  await expect(page.getByTestId('kvkk-taslak')).toHaveCount(0)
})
