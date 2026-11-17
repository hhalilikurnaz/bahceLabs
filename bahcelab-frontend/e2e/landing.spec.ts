import { expect, test, type Page } from '@playwright/test'
import { axeAgirIhlalYok } from './yardimcilar'

/** Landing (L1): erişilebilirlik (0 ciddi/kritik), CTA ve gezinme, mobil yerleşim, azaltılmış hareket, LCP görseli. */

async function bolumlerdeTara(page: Page, etiket: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await axeAgirIhlalYok(page, `${etiket} üst`)
  const vh = page.viewportSize()!.height
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), vh * 1.5)
  await axeAgirIhlalYok(page, `${etiket} hero durağı`)
  const idler = await page.evaluate(() => [...document.querySelectorAll('main section')].map((s) => s.id || ''))
  for (let i = 0; i < idler.length; i++) {
    await page.locator('main section').nth(i).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }))
    await page.waitForTimeout(900) // Reveal geçişleri
    await axeAgirIhlalYok(page, `${etiket} bölüm ${i} ${idler[i]}`)
  }
}

for (const [ad, viewport] of [['masaüstü', { width: 1440, height: 900 }], ['mobil', { width: 390, height: 844 }]] as const) {
  test.describe(`landing · ${ad}`, () => {
    test.use({ viewport })

    test('axe: hero ve tüm bölümler', async ({ page }) => {
      test.setTimeout(180_000)
      await page.goto('/')
      await bolumlerdeTara(page, `landing ${ad}`)
    })

    test('«Kayıtlar çok yakında» yok; birincil CTA «Erken erişime katıl» → /register', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('body')).not.toContainText('Kayıtlar çok yakında')
      const cta = page.getByRole('link', { name: 'Erken erişime katıl' }).first()
      await expect(cta).toHaveAttribute('href', '/register')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('bitkiyi anlamaktan geçer')
    })

    test('yatay kaydırma yok; üst çubuk CTA tek satır', async ({ page }) => {
      await page.goto('/')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const kutu = await page.locator('header').getByRole('link', { name: 'Erken erişime katıl' }).boundingBox()
      expect(kutu, 'CTA görünür').not.toBeNull()
      expect(kutu!.height).toBeLessThanOrEqual(48) // tek satır: 44 px düğme
    })
  })
}

test.describe('landing · gezinme', () => {
  test('masaüstü: Nasıl çalışır · Blog · Giriş yap; sosyal ikonlar üst çubukta değil', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const ust = page.locator('header')
    for (const ad of ['Nasıl çalışır', 'Blog', 'Giriş yap']) await expect(ust.getByRole('link', { name: ad })).toBeVisible()
    await expect(ust.getByRole('link', { name: /LinkedIn|Instagram/ })).toHaveCount(0)
    await expect(page.locator('footer').getByRole('link', { name: /LinkedIn/ })).toHaveCount(1)
    await ust.getByRole('link', { name: 'Nasıl çalışır' }).click()
    await expect(page.locator('#nasil-calisir')).toBeInViewport({ timeout: 10_000 })
  })

  test('mobil: menü düğmesi bağlantıları açar, Escape kapatır', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const dugme = page.locator('button[aria-controls="mobil-menu"]')
    await expect(dugme).toHaveAccessibleName('Menüyü aç')
    await dugme.click()
    await expect(page.getByRole('navigation', { name: 'Mobil menü' }).getByRole('link', { name: 'Giriş yap' })).toBeVisible()
    await expect(dugme).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('navigation', { name: 'Mobil menü' })).toHaveCount(0)
  })

  test('blog sayfasından «Nasıl çalışır» ana sayfadaki bölüme gider', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/blog')
    await page.locator('header').getByRole('link', { name: 'Nasıl çalışır' }).click()
    await expect(page).toHaveURL(/\/#nasil-calisir$/)
    await expect(page.locator('#nasil-calisir')).toBeInViewport({ timeout: 10_000 })
  })
})

test.describe('landing · hero', () => {
  test('LCP öğesi animasyonsuz ilk kare: <img fetchpriority=high>, yüklenir', async ({ page }) => {
    await page.goto('/')
    const img = page.locator('section.journey img').first()
    await expect(img).toHaveAttribute('fetchpriority', 'high')
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  })

  test('prefers-reduced-motion: kaydırmalı sahne yok, statik tek görsel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('.journey-static')).toBeVisible()
    await expect(page.locator('.journey-sticky')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await axeAgirIhlalYok(page, 'landing azaltılmış hareket')
  })

  test('hero, sayfa içeriğinden ÖNCE bitiyor: toplam sayfa 10 ekranın altında', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(h).toBeLessThan(900 * 10 + 1200)
    const ilkBolum = await page.locator('main section').first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    expect(ilkBolum / 900).toBeLessThan(5.6) // eski: ≈9
  })
})

test.describe('tanıtım ve giriş sayfaları · axe', () => {
  for (const yol of ['/blog', '/kvkk', '/login', '/register']) {
    test(`${yol}`, async ({ page }) => {
      await page.goto(yol)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await axeAgirIhlalYok(page, yol)
    })
  }
})

test('KVKK sayfası: taslak bayrağı açıkken «hukuki onay bekliyor» uyarısı görünür', async ({ page }) => {
  await page.goto('/kvkk')
  await expect(page.getByTestId('kvkk-taslak')).toContainText('hukuki onay bekliyor')
})
