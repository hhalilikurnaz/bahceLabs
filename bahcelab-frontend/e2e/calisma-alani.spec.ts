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

test.describe('harita görünümü (9B düzeltmeleri)', () => {
  test('tarih yılı gösterir; histogram lejantı ortanca, tipik bant ve katmana özel uç kelimeleri taşır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Lejant', lng: 27.74, lat: 38.74, sideM: 220 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('secili-tarih')).toHaveText(/\d{1,2} \S+ \d{4}/)

    const lejant = page.getByTestId('histogram-lejant')
    await expect(lejant).toContainText('zayıf → güçlü')
    await expect(page.getByTestId('lejant-ortanca')).toBeVisible()
    await page.getByRole('button', { name: 'Genel skala' }).click()
    await expect(page.getByTestId('lejant-tipik-bant')).toBeVisible()
    await expect(page.getByTestId('lejant-ozet')).toContainText('tipik bant (ön değer)')
    // başlık tek satır: skala seçimi başlığın altında küçük bir seçim
    const title = await lejant.locator('div').first().boundingBox()
    expect(title?.height ?? 99).toBeLessThan(24)

    await page.getByTestId('katman-menusu').getByRole('button', { name: /Canlılık/ }).click()
    await page.getByTestId('katman-yaprakSuyu').click()
    await expect(lejant).toContainText('kuru → nemli')
    await expect(page.getByTestId('lejant-tipik-bant')).toHaveCount(0) // NDMI için tipik bant tanımlı değil
  })

  test('komşu bahçenin adı haritada görünür ve tıklayınca o bahçeye geçilir', async ({ page }) => {
    await newUser(page)
    const a = await createGarden(page.request, { ad: 'Birinci Bahçe', lng: 27.75, lat: 38.75, sideM: 120 })
    await createGarden(page.request, { ad: 'Soğuk Hava Deposu', lng: 27.7512, lat: 38.75, sideM: 100 })
    await page.goto(`/bahceler/${a.id}`)
    const etiket = page.getByTestId('komsu-etiketi')
    await expect(etiket).toHaveText('Soğuk Hava Deposu', { timeout: 30_000 })
    await etiket.click()
    await expect(page.getByTestId('bahce-secici')).toContainText('Soğuk Hava Deposu')
  })

  test('harita köşesi telif yazısının altına girmez', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Hale', lng: 27.76, lat: 38.76 })
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('harita-kosesi')).toBeVisible({ timeout: 30_000 })
    const corner = await page.getByTestId('harita-kosesi').boundingBox()
    const attrib = await page.locator('.maplibregl-ctrl-attrib').boundingBox()
    if (corner && attrib) expect(corner.y + corner.height).toBeLessThanOrEqual(attrib.y + 1) // köşe kutusu telifin altına girmez
  })
})

test.describe('Bahçeler sayfası', () => {
  test('haritada tüm bahçeler + liste (ad · ürün · dekar · kademe) + «+ Bahçe ekle»; seçici listesi ve en altta «+ Bahçe ekle»', async ({ page }) => {
    await newUser(page)
    const a = await createGarden(page.request, { ad: 'Kuzey Bahçe', lng: 27.8, lat: 38.8, sideM: 150 })
    await createGarden(page.request, { ad: 'Güney Bahçe', lng: 27.802, lat: 38.798, sideM: 120 })
    await page.goto('/bahceler')
    await expect(page.getByTestId('tum-bahceler-harita')).toBeVisible()
    const rows = page.getByTestId('bahce-satiri')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('Limon')
    await expect(rows.first()).toContainText('da') // dekar
    await expect(rows.first().getByTestId('bahce-kademe')).toHaveText(/İyi|İzle|Dikkat|Sorun|Veri yok/)
    await expect(page.getByTestId('komsu-etiketi').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('bahce-ekle')).toHaveText('+ Bahçe ekle')

    await page.getByTestId('bahce-ekle').click()
    await expect(page).toHaveURL(/\/bahceler\/yeni$/)

    await page.goto(`/bahceler/${a.id}`)
    await page.getByTestId('bahce-secici').click()
    const list = page.getByRole('listbox', { name: 'Bahçeler' })
    await expect(list.getByRole('option')).toHaveCount(2)
    const last = list.locator('> *').last()
    await expect(last).toHaveText(/Bahçe ekle/) // en altta
  })

  test('bahçe yokken mevcut boş durum gösterilir', async ({ page }) => {
    await newUser(page)
    await page.goto('/bahceler')
    await expect(page.getByTestId('bahce-yok')).toContainText('İlk bahçenizi ekleyin')
  })
})

test.describe('1024 ve 390 yerleşim düzeltmeleri', () => {
  test.describe('1024', () => {
    test.use({ viewport: { width: 1024, height: 768 } })
    test('tarih kutusu görünür; lejant köşe kutusuyla çakışmaz; Analiz tabloları taşmaz', async ({ page }) => {
      await newUser(page)
      const garden = await createGarden(page.request, { ad: 'Dar 1024', lng: 27.77, lat: 38.77, sideM: 220 })
      seedScenes(garden.id)
      await page.goto(`/bahceler/${garden.id}`)
      await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('tarih-kutusu')).toBeVisible()
      const kutu = async (id: string) => (await page.getByTestId(id).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
      const [tarih, menu, lejant, kose] = [await kutu('tarih-kutusu'), await kutu('katman-menusu'), await kutu('histogram-lejant'), await kutu('harita-kosesi')]
      const kesisir = (a: typeof tarih, b: typeof tarih) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
      expect(kesisir(tarih, menu), 'tarih kutusu katman menüsüyle çakışmamalı').toBe(false)
      expect(kesisir(lejant, kose), 'lejant ölçek kutusuyla çakışmamalı').toBe(false)
      const harita = await kutu('harita-paneli')
      expect(tarih.x + tarih.width).toBeLessThanOrEqual(harita.x + harita.width)

      await page.route('**/bolgeler/cok-yillik/sonuc*', (route) =>
        route.fulfill({
          json: {
            durum: 'hazir', mesaj: null, bolge_sayisi: 3, versiyon: 1, hesaplama: '2026-10-12T10:00:00Z', yil_araligi: '2017–2026', yillar: [],
            bolgeler: { type: 'FeatureCollection', features: [] },
            ozet: [1, 2, 3].map((k) => ({ sinif: k, ad: ['Zayıf', 'Orta', 'Güçlü'][k - 1], alan_m2: 3000 * k, alan_dekar: 3 * k, pay: k / 6, fark_yuzde: (k - 2) * 10, istikrar: 0.8, istikrar_sinifi: 'yuksek', kontrol_onerisi: k === 1 })),
            homojen: false, yayilim_yuzde: 20, yorumlar: ['Bulgu cümlesi.'], not_: 'Not.',
          },
        }),
      )
      await page.goto(`/bahceler/${garden.id}/analiz`)
      await expect(page.getByTestId('bolge-tablosu')).toBeVisible()
      const tasma = await page.getByTestId('bolge-tablosu').evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(tasma, 'bölge tablosu yatay taşmamalı').toBeLessThanOrEqual(1)
    })
  })

  test.describe('390', () => {
    test.use({ viewport: { width: 390, height: 844 } })
    test('lejant küçük bir çip; açılınca histogram dolu görünür', async ({ page }) => {
      await newUser(page)
      const garden = await createGarden(page.request, { ad: 'Mobil Lejant', lng: 27.78, lat: 38.78, sideM: 220 })
      seedScenes(garden.id)
      await page.goto(`/bahceler/${garden.id}`)
      const cip = page.getByTestId('lejant-cip')
      await expect(cip).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('histogram-lejant')).toHaveCount(0)
      const kutu = await cip.boundingBox()
      expect(kutu?.height ?? 0).toBeGreaterThanOrEqual(44)
      expect(kutu?.width ?? 999).toBeLessThan(260)
      await cip.click()
      const lejant = page.getByTestId('histogram-lejant')
      await expect(lejant).toBeVisible()
      await expect(lejant.getByRole('img', { name: 'Piksel dağılımı' }).locator('rect[fill^="rgb"]')).not.toHaveCount(0)
      await lejant.getByRole('button', { name: 'Lejantı küçült' }).click()
      await expect(page.getByTestId('lejant-cip')).toBeVisible()
    })
  })

  test('Bahçeler sayfasında bahçeler dolgusuz; etiketlerde kademe işareti var', async ({ page }) => {
    await newUser(page)
    const a = await createGarden(page.request, { ad: 'Etiketli Bahçe', lng: 27.79, lat: 38.79, sideM: 150 })
    seedScenes(a.id)
    await page.goto('/bahceler')
    await expect(page.getByTestId('komsu-etiketi').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('etiket-kademe').first()).toBeVisible()
    await expect(page.getByTestId('komsu-etiketi').first()).toContainText('Etiketli Bahçe')
  })
})
