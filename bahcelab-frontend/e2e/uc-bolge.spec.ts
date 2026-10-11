import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

test('bahçe → sağ panel → sekmeler → Tam harita → Esc; ana ekran en güncel görüntüyü gösterir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Üç Bölge', lng: 27.4, lat: 38.4, sideM: 220 })
  seedScenes(garden.id)
  await page.goto('/bahcem')

  await page.getByRole('link', { name: 'Üç Bölge bahçesini aç' }).click()
  // Üç bölge: sol liste, harita, sağ panel yan yana
  const list = page.getByTestId('left-panel')
  const detail = page.getByTestId('detail-column')
  await expect(list).toHaveAttribute('data-open', 'true')
  await expect(detail).toHaveAttribute('data-open', 'true')
  const listBox = await list.boundingBox()
  const detailBox = await detail.boundingBox()
  expect(listBox && detailBox && listBox.x + listBox.width < detailBox.x).toBe(true)

  // Durum: 3 özet kart, grafik, kapsül (en güncel görüntü)
  await expect(page.getByTestId('summary-cards').getByRole('region')).toHaveCount(3)
  await expect(page.getByTestId('time-chart')).toBeVisible()
  await expect(page.getByTestId('map-capsule')).toContainText('En güncel')
  await expect(page.getByTestId('latest-change')).toBeVisible()

  for (const tab of ['Analiz', 'Hava', 'Günlük', 'Rapor', 'Durum']) {
    await page.getByRole('tab', { name: tab }).click()
    await expect(page.getByRole('tab', { name: tab, selected: true })).toBeVisible()
  }

  // Sağ panel genişliği klavyeyle ayarlanır
  const handle = page.getByTestId('detail-resize')
  const before = Number(await handle.getAttribute('aria-valuenow'))
  await handle.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(handle).toHaveAttribute('aria-valuenow', String(before + 24))

  await page.getByRole('button', { name: 'Tam harita' }).click()
  await expect(detail).toHaveAttribute('data-open', 'false')
  await page.keyboard.press('Escape')
  await expect(detail).toHaveAttribute('data-open', 'true')

  // Copilot çekmecesi sağ panelin üstünde açılır
  await page.getByRole('button', { name: 'Copilot' }).click()
  await expect(page.getByRole('complementary', { name: 'Copilot' })).toBeVisible()
  await expect(page.getByLabel('Mesajınız')).toBeDisabled()
})

test('homojen bahçe «homojen» mesajı gösterir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Düz Bahçe', lng: 27.45, lat: 38.45, sideM: 200 })
  seedScenes(garden.id, { flat: true })
  await page.goto(`/bahcem/${garden.id}/durum`)
  await expect(page.getByTestId('map-legend')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('legend-hint')).toContainText('Bahçe homojen')
})
