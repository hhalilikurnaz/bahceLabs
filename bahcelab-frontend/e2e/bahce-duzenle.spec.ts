import { expect, test } from '@playwright/test'
import { createGarden, mapPoint, newUser, startAt } from './yardimcilar'

test('bahçe bilgilerini düzenle: doğrulama, kaydet, sunucuda saklanır', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Eksik Bilgi', lng: 27.41, lat: 38.41 })
  await page.goto(`/bahceler/${garden.id}`)

  await page.getByRole('button', { name: 'Eksik Bilgi işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Bilgileri düzenle' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Dikim yılı').fill('1800')
  await dialog.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText(/Dikim yılı 1900 ile/)).toBeVisible()

  await dialog.getByLabel('Çeşit', { exact: true }).selectOption({ label: 'Enterdonat' })
  await dialog.getByLabel('Dikim yılı').fill('2012')
  await dialog.getByLabel('Ağaç sayısı').fill('480')
  await dialog.getByRole('button', { name: 'Kaydet' }).click()
  await expect(dialog).toHaveCount(0)

  const saved = (await (await page.request.get('/api/gardens')).json()) as { id: string; cesit: string | null; dikimYili?: number; dikim_yili?: number; agacSayisi?: number; agac_sayisi?: number }[]
  const g = saved.find((x) => x.id === garden.id)
  expect(g?.cesit).toBe('Enterdonat')
  expect(g?.dikimYili ?? g?.dikim_yili).toBe(2012)
  expect(g?.agacSayisi ?? g?.agac_sayisi).toBe(480)
})

test('sınırı düzenle: sürükle, yeniden işleme uyarısı, kaydet', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Sınır Düzenle', lng: 27.42, lat: 38.42, sideM: 160 })
  await startAt(page, 27.42, 38.42, 17)
  await page.goto(`/bahceler/${garden.id}`)
  await page.getByRole('button', { name: 'Sınır Düzenle işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Sınırı düzenle' }).click()
  await expect(page.getByRole('region', { name: 'Sınırı düzenle' })).toBeVisible()
  await expect(page.getByTestId('edge-label').first()).toBeVisible({ timeout: 15_000 })
  const edges = await page.getByTestId('edge-label').allInnerTexts()

  // Bahçeyi sürükleyerek kaydır (sınır değişir)
  await page.waitForTimeout(1500)
  const c = await mapPoint(page, 0, 0)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x + 30, c.y + 20, { steps: 6 })
  await page.mouse.up()

  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect(page.getByTestId('reprocess-warning')).toContainText('yeniden işlenir')
  await page.getByRole('button', { name: 'Kaydet ve yeniden işle' }).click()
  await expect(page.getByText('sınırı güncellendi')).toBeVisible()
  expect(edges.length).toBeGreaterThanOrEqual(4)
})
