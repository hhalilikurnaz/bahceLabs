import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

test.describe('çalışma alanı (harita + sabit panel)', () => {
  test('katman menüsü, tarih kutusu, histogram lejantı ve nokta inceleme', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Çalışma', lng: 27.7, lat: 38.7, sideM: 220 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)

    await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('tarih-kutusu')).toContainText('bulut')
    await expect(page.getByTestId('harita-kosesi')).toBeVisible()

    // Katman menüsü: 4 katman, her satırda kaynak ve çözünürlük
    const menu = page.getByTestId('katman-menusu')
    await menu.getByRole('button', { name: /Canlılık/ }).click()
    for (const id of ['canlilik', 'yaprakSuyu', 'bolgeler', 'degisim']) await expect(page.getByTestId(`katman-${id}`)).toBeVisible()
    await expect(page.getByTestId('katman-yaprakSuyu')).toContainText('Sentinel-2 L2A')
    await page.getByTestId('katman-yaprakSuyu').click()
    await expect(menu).toContainText('Yaprak suyu')
    await expect(page.getByTestId('histogram-lejant')).toContainText('Yaprak suyu')

    // Skala seçimi lejantta
    await page.getByRole('button', { name: 'Genel skala' }).click()
    await expect(page.getByRole('button', { name: 'Genel skala' })).toHaveAttribute('aria-pressed', 'true')

    // Tarih gezintisi: önceki görüntü
    const before = await page.getByTestId('secili-tarih').innerText()
    await page.getByRole('button', { name: 'Önceki görüntü' }).click()
    await expect(page.getByTestId('secili-tarih')).not.toHaveText(before)
    await expect(page.getByRole('button', { name: 'Sonraki görüntü' })).toBeEnabled()

    // Nokta inceleme: haritaya tıklayınca değer, yüzdelik ve kaynak satırı
    const canvas = page.locator('.maplibregl-canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('harita yok')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    const inspect = page.getByRole('dialog', { name: 'Nokta incelemesi' })
    await expect(inspect).toBeVisible()
    await expect(inspect).toContainText(/Bahçenin %\d+/)
    await expect(inspect).toContainText('Sentinel-2 L2A')
    await inspect.getByRole('button', { name: 'Kapat' }).click()
    await expect(inspect).toHaveCount(0)
  })

  test('bölücü sürüklenir, oran saklanır; Geçmiş bağlantısı tam sayfaya gider', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Bölücü', lng: 27.71, lat: 38.71 })
    await page.goto(`/bahceler/${garden.id}`)
    const sep = page.getByRole('separator', { name: 'Harita ve panel genişliği' })
    await expect(sep).toBeVisible()
    const map = page.getByTestId('harita-paneli')
    const w0 = (await map.boundingBox())?.width ?? 0
    await sep.focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect.poll(async () => (await map.boundingBox())?.width ?? 0).toBeLessThan(w0)
    const w1 = (await map.boundingBox())?.width ?? 0
    await page.reload()
    await expect.poll(async () => Math.abs(((await map.boundingBox())?.width ?? 0) - w1)).toBeLessThan(4)

    await page.getByRole('link', { name: 'Geçmiş ↗' }).click()
    await expect(page).toHaveURL(/\/gecmis$/)
  })

  test('⌘K komut paleti: komut ara, bahçe aç, Esc kapatır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Palet Bahçesi', lng: 27.72, lat: 38.72 })
    await page.goto(`/bahceler/${garden.id}`)
    await page.getByTestId('komut-ac').click()
    const palette = page.getByRole('dialog', { name: 'Ara veya sor' })
    await expect(palette).toBeVisible()
    await page.getByLabel('Komut ya da bahçe ara').fill('ilaclama')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}/hava$`))
    await page.keyboard.press('Control+k')
    await expect(palette).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0)
  })

  test('tema değişir ve saklanır', async ({ page }) => {
    await newUser(page)
    await page.goto('/bahceler')
    await page.getByTestId('tema').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test.describe('mobil 390', () => {
    test.use({ viewport: { width: 390, height: 844 } })
    test('harita ve panel alt alta; sekmeler ve bahçe seçici ulaşılabilir', async ({ page }) => {
      await newUser(page)
      const garden = await createGarden(page.request, { ad: 'Mobil Bahçe', lng: 27.73, lat: 38.73 })
      await page.goto(`/bahceler/${garden.id}`)
      await expect(page.getByTestId('harita-paneli')).toBeVisible()
      for (const name of ['Durum', 'Analiz', 'Hava']) await expect(page.getByRole('tab', { name })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
