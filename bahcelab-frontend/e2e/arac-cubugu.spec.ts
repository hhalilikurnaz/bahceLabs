import { expect, test } from '@playwright/test'
import { TOOLBAR } from '../src/features/bahcem/lib/config'
import { createGarden, newUser, seedScenes } from './yardimcilar'

const MAX_ROW_PX = TOOLBAR.maxRowHeightPx

test('araç çubuğu her genişlikte tek satır; dar haritada simge moduna geçer (etiketler ipucunda)', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Çubuk', lng: 27.8, lat: 38.8, sideM: 200 })
  seedScenes(garden.id)
  const toolbar = page.getByTestId('map-toolbar')

  const check = async (label: string, expectedMode?: 'full' | 'icons') => {
    await expect(toolbar, label).toBeVisible({ timeout: 30_000 })
    const box = await toolbar.boundingBox()
    expect(box?.height, `${label}: tek satır`).toBeLessThanOrEqual(MAX_ROW_PX)
    if (expectedMode) await expect(toolbar, label).toHaveAttribute('data-mode', expectedMode)
    // her modda erişilebilir adlar var
    await expect(page.getByRole('link', { name: 'Tüm görüntüler' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Görünüm ayarları' })).toBeVisible()
  }

  // Geniş masaüstü, liste daralmış → geniş harita → tam etiketli
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(`/bahcem/${garden.id}/durum`)
  await check('1600 px, liste kapalı', 'full')

  // Liste açılınca harita daralır → simge modu
  await page.getByRole('link', { name: 'Bahçelerim' }).click()
  await check('1600 px, liste açık', 'icons')
  await expect(page.getByRole('button', { name: /^Parametre:/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Görünüm:/ })).toBeVisible()

  // Simge modunda parametre menüsü ve görünüm değişimi çalışır
  await page.getByRole('button', { name: /^Görünüm:/ }).click()
  await expect(page.getByRole('button', { name: /Görünüm: Genel skala/ })).toBeVisible()
  await page.getByRole('button', { name: /^Parametre:/ }).click()
  await page.getByRole('menuitemradio', { name: 'Yaprak suyu' }).click()
  await expect(page.getByRole('button', { name: 'Parametre: Yaprak suyu' })).toBeVisible()

  for (const [w, h] of [[1280, 800], [1180, 800]] as const) {
    await page.setViewportSize({ width: w, height: h })
    await check(`${w} px`)
  }

  // Tablet ve telefon: alt sayfa kapalı (peek) iken araç çubuğu görünür ve tek satır
  for (const [w, h, mode] of [[1024, 768, undefined], [768, 1024, undefined], [375, 812, 'icons']] as const) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`/bahcem/${garden.id}/durum`)
    const handle = page.getByTestId('sheet-handle')
    await handle.focus()
    await page.keyboard.press('ArrowDown')
    await check(`${w} px`, mode)
  }
})
