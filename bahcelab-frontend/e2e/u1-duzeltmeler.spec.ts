import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes, seedWater } from './yardimcilar'

/** UX denetimi U1: kırık ve yanıltıcı olanlar (docs/design/ux-denetimi.md). Gerçek arka uç; hata durumları yalnız istemcide API yanıtı kesilerek. */

test('U-01/U-21: bahçe listesi sunucu hatasında «bahçe yok» DEĞİL hata gösterir; ağ ve sunucu hatası ayrı mesaj', async ({ page }) => {
  await newUser(page)
  await createGarden(page.request, { ad: 'Hata Bahçesi', lng: 27.71, lat: 38.7, sideM: 150 })
  await page.route('**/api/gardens', (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, json: { error: { code: 'X', message: 'x' } } }) : route.continue()))
  await page.goto('/bahceler')
  await expect(page.getByRole('heading', { name: 'Bahçeleriniz alınamadı' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('alert')).toContainText('sorun sizde değil') // sunucu hatası: internetten söz edilmez
  await expect(page.getByRole('alert')).not.toContainText('internet')
  await expect(page.getByRole('heading', { name: 'İlk bahçenizi ekleyin' })).toHaveCount(0)
  await page.unroute('**/api/gardens')
  await page.route('**/api/gardens', (route) => (route.request().method() === 'GET' ? route.abort('failed') : route.continue()))
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByRole('alert')).toContainText('internet bağlantınızı', { timeout: 30_000 }) // ağ hatası: bağlantı mesajı
})

test('U-22/U-23: yükleniyor «görüntü yok» demez; edinim hatası «yok» olarak çizilmez', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Yükleniyor', lng: 27.72, lat: 38.7, sideM: 150 })
  seedScenes(g.id)
  let serbest = false
  await page.route('**/api/gardens/*/edinimler', async (route) => {
    while (!serbest) await new Promise((r) => setTimeout(r, 100))
    await route.fulfill({ status: 500, json: { error: { code: 'X', message: 'x' } } })
  })
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('tarih-kutusu')).toContainText('yükleniyor…')
  await expect(page.getByTestId('tarih-kutusu')).not.toContainText('görüntü yok')
  serbest = true
  await expect(page.getByTestId('sezon-egrisi').getByRole('heading', { name: 'Grafik alınamadı' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('sezon-bos')).toHaveCount(0)
  await expect(page.getByTestId('tarih-kutusu')).toContainText('alınamadı')
})

test('U-06: varsayılan skala MUTLAK; gerilmiş skala seçilince rozet ya da «gerilme kapalı» gerekçesi görünür', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Skala', lng: 27.73, lat: 38.7, sideM: 200 })
  seedScenes(g.id)
  await page.goto(`/bahceler/${g.id}`)
  const lejant = page.getByTestId('histogram-lejant')
  await expect(lejant).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Mutlak skala' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('skala-rozet')).toHaveCount(0)
  await page.getByRole('button', { name: 'Bahçenin kendi farkları' }).click()
  await expect(page.getByTestId('skala-rozet').or(page.getByTestId('skala-kapali'))).toBeVisible() // eşik katalogdan: aralık eşik üstüyse rozet, altındaysa gerekçe
  await expect(lejant).toContainText('Bahçenin kendi farkları')
})

test('U-02: su dengesi iki panel; U-31: aynı ERA5 hücresindeki bahçeye kısa not', async ({ page }) => {
  await newUser(page)
  const a = await createGarden(page.request, { ad: 'Bir', lng: 27.74, lat: 38.7, sideM: 150 })
  await createGarden(page.request, { ad: 'İki', lng: 27.7415, lat: 38.7015, sideM: 150 })
  seedScenes(a.id)
  seedWater(a.id)
  await page.goto(`/bahceler/${a.id}/su`)
  const denge = page.getByTestId('su-dengesi')
  await expect(denge.locator('svg')).toHaveCount(2, { timeout: 30_000 })
  await expect(denge.getByTestId('birikimli-son')).toContainText('mm')
  await expect(page.getByTestId('ayni-hucre-notu')).toContainText('İki')
})

test('U-04: Hava sekmesi kartları panel iç boşluğunu korur; U-03: Defter haritasındaki kutu üst gezinmeye binmez (390)', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Düzen', lng: 27.75, lat: 38.7, sideM: 150 })
  await page.goto(`/bahceler/${g.id}/hava`)
  const panel = page.getByTestId('panel-hava')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('weather-layer').or(page.getByRole('alert')).first()).toBeVisible({ timeout: 30_000 })
  const kutu = (await panel.boundingBox())!
  const kart = (await panel.locator('[data-testid="spray-strip"], [data-testid="weather-layer"], [role="alert"]').first().boundingBox())!
  expect(kart.x - kutu.x).toBeGreaterThanOrEqual(12)
  expect(kutu.x + kutu.width - (kart.x + kart.width)).toBeGreaterThanOrEqual(12)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/bahceler/${g.id}/defter`)
  const onay = page.getByTestId('kayit-katmani')
  await expect(onay).toBeVisible({ timeout: 30_000 })
  const kutuY = (await onay.boundingBox())!
  const harita = (await page.getByTestId('defter-haritasi').boundingBox())!
  expect(kutuY.y).toBeGreaterThanOrEqual(harita.y - 1) // haritanın içinde, üst gezinmenin üstünde değil
})

test('U-05: ürün uyarıları ile sistem/veri akışı uyarıları ayrı; ham istisna adı yok', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Bildirim', lng: 27.76, lat: 38.7, sideM: 150 })
  await page.route(/\/api\/notifications\?/, async (route) => {
    const yanit = await route.fetch()
    const gov = await yanit.json()
    const sistem = { id: '00000000-0000-0000-0000-0000000000a1', bahce_id: g.id, tur: 'besleme', tur_adi: 'Veri akışı', oncelik: 'onemli', baglanti: `/bahceler/${g.id}`, olusturma: new Date().toISOString(), ertelendi_bitis: null, sistem: true, okundu: false, durum: 'olustu', baslik: 'Bildirim: ERA5 hava çekimi başarısız', metin: 'Deneme 1/4; 15 dk sonra yeniden denenecek. Neden: ERA5 arşivine şu an ulaşılamıyor.', ogeler: [] }
    await route.fulfill({ json: { ...gov, ogeler: [...(gov.ogeler ?? []), sistem], okunmamis_sayisi: 1, okunmamis_urun_sayisi: 0, okunmamis_sistem_sayisi: 1 } })
  })
  await page.goto('/bahceler')
  await expect(page.getByTestId('unread-badge')).toHaveCount(0) // rozet yalnız ürün uyarısını sayar
  await page.getByTestId('bildirim-ac').click()
  await expect(page.getByTestId('sistem-bildirimleri')).toBeVisible()
  await expect(page.getByTestId('unread-summary')).toContainText('1 sistem uyarısı')
  await expect(page.getByTestId('notifications-panel')).not.toContainText('WeatherSourceError')
})

test('mobil: bahçe çokgeni alt sayfanın her durağında (kapalı / yarım / tam) görünür alanda kalır', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Durak', lng: 27.77, lat: 38.7, sideM: 220 })
  seedScenes(g.id)
  await page.goto(`/bahceler/${g.id}`)
  const tutamak = page.getByTestId('alt-sayfa-tutamak')
  await expect(tutamak).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(() => Boolean((window as unknown as { __bahcelabHarita?: unknown }).__bahcelabHarita))
  const garden = (await (await page.request.get(`/api/gardens/${g.id}`)).json()) as { geometry: { coordinates: number[][][] } }
  const halka = garden.geometry.coordinates[0]
  const gorunur = async () => {
    await page.waitForTimeout(700) // yeniden odak (250 ms) oturur
    return page.evaluate(({ halka }) => {
      const map = (window as unknown as { __bahcelabHarita: { project: (p: [number, number]) => { x: number; y: number }; getContainer: () => HTMLElement } }).__bahcelabHarita
      const kap = map.getContainer().getBoundingClientRect()
      const sayfa = document.querySelector('[data-testid="alt-sayfa"]')!.getBoundingClientRect()
      return halka.every(([lng, lat]) => { const p = map.project([lng, lat]); const y = kap.top + p.y; return p.x >= 0 && p.x <= kap.width && y >= kap.top + 60 && y <= sayfa.top + 2 })
    }, { halka })
  }
  for (const tus of ['', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
    if (tus) { await tutamak.focus(); await page.keyboard.press(tus) }
    expect(await gorunur(), `durak ${await tutamak.getAttribute('aria-valuetext')}`).toBe(true)
  }
})
