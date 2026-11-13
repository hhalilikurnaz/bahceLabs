import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedEta } from './yardimcilar'

/** İç kalite ekranı (9I Dilim 1A, ADR 0028): GERÇEK arka uç + sentetik Landsat sahneleriyle koşan ETa hattı. Kullanıcıya gösterilmez; kapı mantığı sınanır. */
test('iç kalite: tutarlı seri → kapı AÇIK, geçiş listesi, kalibrasyon, bağlam', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'ETa Tutarlı', lng: 27.91, lat: 38.7, sideM: 400 })
  seedEta(g.id, 'tutarli')
  await page.goto('/ic/kalite?sekme=eta')
  await expect(page.getByTestId('ic-kalite')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('ic-kapi')).toHaveAttribute('data-kapi', 'acik')
  await expect(page.getByTestId('ic-p90')).toContainText('eşik 0,15')
  expect(await page.getByTestId('ic-sahne').count()).toBe(18)
  await expect(page.locator('[data-testid="ic-sahne"][data-durum="hesaplandi"]')).toHaveCount(18)
  await expect(page.getByTestId('ic-sicrama')).toHaveCount(0)
  await expect(page.getByTestId('ic-kalibrasyon')).toContainText('c-faktörü')
  await expect(page.getByTestId('ic-baglam')).toContainText('2,50')
  await expect(page.getByTestId('ic-dogrulama')).toContainText('3,10')
  await expect(page.getByText('Kullanıcıya gösterilmez').first()).toBeVisible()
})

test('iç kalite: tutarsız seri → kapı KAPALI, eşik üstü sıçramalar işaretli; kullanıcı panelinde ETa yok', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'ETa Tutarsız', lng: 27.92, lat: 38.7, sideM: 400 })
  seedEta(g.id, 'tutarsiz')
  await page.goto('/ic/kalite?sekme=eta')
  await expect(page.getByTestId('ic-kapi')).toHaveAttribute('data-kapi', 'kapali', { timeout: 30_000 })
  await expect(page.getByTestId('ic-kapi-neden')).toContainText('> eşik')
  expect(await page.getByTestId('ic-sicrama').count()).toBeGreaterThan(10)
  // kullanıcı ekranları: sulama panelinde uydu ETa/ETf hiçbir yerde yok
  const panel = JSON.stringify(await (await page.request.get(`/api/gardens/${g.id}/sulama-panel`)).json())
  expect(panel).not.toMatch(/etf|eta_mm|ssebop/i)
})

test('iç kalite: ETa hattı koşmamış bahçe yokken boş durum', async ({ page }) => {
  await newUser(page)
  await page.goto('/ic/kalite?sekme=eta')
  await expect(page.getByTestId('ic-bos')).toBeVisible({ timeout: 30_000 })
})
