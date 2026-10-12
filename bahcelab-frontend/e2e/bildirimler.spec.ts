import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedNotification } from './yardimcilar'

test('bildirim gelir → rozet → tıkla → bahçe ve sekme açılır → okundu olur', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Bildirim Bahçesi', lng: 27.8, lat: 38.8 })
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.goto('/bahceler')
  await expect(page.getByTestId('unread-badge')).toHaveCount(0)

  seedNotification(garden.id, 'uyari', 'a')
  await page.reload()
  await expect(page.getByTestId('unread-badge')).toContainText('1')

  await page.getByTestId('bildirim-ac').click()
  const item = page.getByTestId('notification-item').first()
  await expect(item).toContainText('Test bildirimi a')
  await expect(item).toHaveAttribute('data-read', 'false')
  await item.click()
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}/hava`))

  await page.getByTestId('bildirim-ac').click()
  await expect(page.getByTestId('notification-item').first()).toHaveAttribute('data-read', 'true')
  await expect(page.getByTestId('unread-badge')).toHaveCount(0)
})

test('yeni kritik bildirim toast gösterir; tümünü okundu işaretle ve tercih kapatma çalışır', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Toast Bahçesi', lng: 27.81, lat: 38.81 })
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.clock.install() // yoklama aralığı (60 sn) gerçek beklemeden ilerletilir
  await page.goto('/bahceler')
  await expect(page.getByTestId('bildirim-ac')).toBeVisible()
  await page.waitForTimeout(500)

  seedNotification(garden.id, 'kritik', 'k1')
  await page.clock.runFor(65_000)
  await expect(page.getByText('Test bildirimi k1').first()).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('bildirim-ac').click()
  await page.getByRole('button', { name: 'Tümünü okundu işaretle' }).click()
  await expect(page.getByTestId('unread-summary')).toHaveText('Hepsi okundu')

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Hesap:/ }).click()
  await page.getByRole('menuitem', { name: 'Ayarlar' }).click()
  const pref = page.getByTestId('notification-preferences').getByRole('switch').first()
  await expect(pref).toBeChecked()
  await page.getByTestId('notification-preferences').locator('label').first().click()
  await expect(pref).not.toBeChecked()
  await page.reload()
  await expect(page.getByTestId('notification-preferences').getByRole('switch').first()).not.toBeChecked()
})
