import { expect, test, type Page } from '@playwright/test'
import { createGarden, mapPoint, newUser, seedScenes, startAt } from './yardimcilar'

async function tabUntil(page: Page, matcher: (label: string) => boolean, max = 60): Promise<void> {
  const seen: string[] = []
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return el ? `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`.trim() : ''
    })
    seen.push(label.slice(0, 30))
    if (matcher(label)) return
  }
  throw new Error(`Klavyeyle hedefe ulaşılamadı; son duraklar: ${seen.slice(-12).join(' | ')}`)
}

test('bahçe bilgilerini tamamla: doğrulama, kaydet, kart güncellenir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Eksik Bilgi', lng: 27.41, lat: 38.41 })
  await page.goto(`/bahcem/${garden.id}/durum`)
  await expect(page.getByTestId('product-card')).toContainText('Bilgileri tamamla')

  await page.getByRole('button', { name: 'Bilgileri tamamla' }).click()
  await page.getByLabel('Dikim yılı').fill('1800')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByText(/Dikim yılı 1900 ile/)).toBeVisible()

  await page.getByLabel('Çeşit', { exact: true }).selectOption({ label: 'Enterdonat' })
  await page.getByLabel('Dikim yılı').fill('2012')
  await page.getByLabel('Ağaç sayısı').fill('480')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByTestId('product-facts')).toContainText('Enterdonat')
  await expect(page.getByTestId('product-facts')).toContainText('480 ağaç')
  await expect(page.getByRole('button', { name: 'Bilgileri tamamla' })).toHaveCount(0)
})

test('sınırı düzenle: sürükle, yeniden işleme uyarısı, kaydet', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Sınır Düzenle', lng: 27.42, lat: 38.42, sideM: 160 })
  await startAt(page, 27.42, 38.42, 17)
  await page.goto(`/bahcem/${garden.id}/durum`)
  await page.getByTestId('garden-page').getByRole('button', { name: 'Sınır Düzenle işlemleri' }).click()
  await page.getByRole('menuitem', { name: 'Sınırı düzenle' }).click()
  await expect(page.getByRole('region', { name: 'Sınırı düzenle' })).toBeVisible()
  await expect(page.getByTestId('edge-label').first()).toBeVisible({ timeout: 15_000 })
  const edges = await page.getByTestId('edge-label').allInnerTexts()

  // Bahçeyi sürükleyerek kaydır (sınır değişir)
  await page.waitForTimeout(1500)
  const box = await page.locator('.maplibregl-canvas').first().boundingBox()
  const c = await mapPoint(page, 0, 0)
  const y = box ? (230 + box.height - 70) / 2 : c.y
  await page.mouse.move(c.x, y)
  await page.mouse.down()
  await page.mouse.move(c.x + 30, y + 20, { steps: 6 })
  await page.mouse.up()

  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect(page.getByTestId('reprocess-warning')).toContainText('yeniden işlenir')
  await page.getByRole('button', { name: 'Kaydet ve yeniden işle' }).click()
  await expect(page.getByText('sınırı güncellendi')).toBeVisible()
  expect(edges.length).toBeGreaterThanOrEqual(4)
})

test.describe('mobil', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('bahçe alt sayfada açılır; sürüklenir (kapalı/yarım/tam) ve klavyeyle ayarlanır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Mobil Bahçe', lng: 27.43, lat: 38.43 })
    await page.goto(`/bahcem/${garden.id}/durum`)
    const sheet = page.getByTestId('detail-column')
    await expect(sheet).toHaveAttribute('data-sheet', 'half')

    const handle = page.getByTestId('sheet-handle')
    const box = await handle.boundingBox()
    expect(box && box.height).toBeGreaterThanOrEqual(44)
    if (!box) return
    await page.mouse.move(box.x + box.width / 2, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y - 280, { steps: 8 })
    await page.mouse.up()
    await expect(sheet).toHaveAttribute('data-sheet', 'full')

    await handle.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(sheet).toHaveAttribute('data-sheet', 'peek')
    await page.keyboard.press('ArrowUp')
    await expect(sheet).toHaveAttribute('data-sheet', 'half')

    // Dokunma hedefleri ≥ 44 px
    for (const name of ['Durum', 'Analiz']) {
      const tab = await page.getByRole('tab', { name }).boundingBox()
      expect(tab && tab.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test('yalnız klavyeyle: bahçe aç, sekmelere geç, arşive git', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Klavye Bahçesi', lng: 27.44, lat: 38.44, sideM: 200 })
  seedScenes(garden.id)
  await page.goto('/bahcem')
  await expect(page.getByTestId('garden-card')).toHaveCount(1)

  await tabUntil(page, (l) => l.includes('Klavye Bahçesi bahçesini aç'))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/bahcem/${garden.id}/durum$`))
  await expect(page.getByTestId('detail-column')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('garden-page')).toBeVisible()

  // Sekme çubuğu tek durak (Tab); sekmeler arasında ok tuşlarıyla gezilir
  await tabUntil(page, (l) => l.startsWith('Durum'))
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/analiz$/)
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/durum$/)

  await expect(page.getByRole('link', { name: 'Tüm görüntüler' })).toBeVisible({ timeout: 30_000 })
  await tabUntil(page, (l) => l.includes('Tüm görüntüler'), 120)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/arsiv\?parametre=/)
  await expect(page.getByTestId('archive-viewer')).toBeVisible()

  // Arşivde ok tuşları görüntüler arasında gezinir; Esc/geri tuşu çıkışı bozulmaz
  const before = await page.getByTestId('archive-selected').innerText()
  await page.getByLabel(/Görüntü alanı/).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('archive-selected')).not.toHaveText(before)
})
