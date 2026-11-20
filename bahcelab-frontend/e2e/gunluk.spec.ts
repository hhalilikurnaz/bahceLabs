import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, kayitAc, mapPoint, newUser, seedOlayOzet, seedSebep } from './yardimcilar'

/**
 * ADIM 11 · Dilim 1: etiketli gözlem (GPS, kamera/galeri, istemcide küçültme, taslak), Günlük sekmesi, sabit «+ Kayıt» eylemi (harita ve form aynı görünümde),
 * ≥ 44 px dokunma hedefleri, saha turunda 10B «belirsiz» olay ve kontrol listesi. GERÇEK arka uç; S2/ERA5 tohumları SENTETİK test verisidir.
 */
const MERKEZ = { lng: 27.93, lat: 38.93 }

async function axeTemiz(page: Page, etiket: string): Promise<void> {
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  const agir = sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(agir.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), etiket).toEqual([])
}

/** Tarayıcıda 4000×3000 ayrıntılı JPEG üretir (sıkıştırması zor, > 1,5 MB) ve Node'a taşır. */
async function buyukFoto(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 4000
    c.height = 3000
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 0, 4000, 3000)
    g.addColorStop(0, '#406040')
    g.addColorStop(1, '#a0c060')
    x.fillStyle = g
    x.fillRect(0, 0, 4000, 3000)
    let s = 12345
    const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 6000; i++) {
      x.fillStyle = `rgb(${(r() * 255) | 0},${(r() * 255) | 0},${(r() * 255) | 0})`
      x.beginPath()
      x.arc(r() * 4000, r() * 3000, 3 + r() * 40, 0, 7)
      x.fill()
    }
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.95))
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(bin)
  })
  return Buffer.from(b64, 'base64')
}

test.describe('Günlük · gözlem v2', () => {
  test.use({ geolocation: { latitude: MERKEZ.lat, longitude: MERKEZ.lng, accuracy: 12 }, permissions: ['geolocation'] })

  test('etiketli gözlem: kategori + etiket + şiddet + yaygınlık + GPS + büyük fotoğraf istemcide küçülür; listede etiketle görünür, kategoriyle süzülür; Günlük sekmesi aynı kaydı gösterir', async ({ page }) => {
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Günlük Bahçesi', lng: MERKEZ.lng, lat: MERKEZ.lat, sideM: 300 })
    await page.goto(`/bahceler/${g.id}/defter`)
    await kayitAc(page)
    await expect(page.getByTestId('kayit-kaydet')).toBeDisabled() // etiket seçilmeden kaydedilmez
    await page.getByTestId('gozlem-kategori-zararli').click()
    await page.getByTestId('gozlem-etiket').selectOption('kirmizi_orumcek')
    await expect(page.getByTestId('kayit-kaydet')).toBeDisabled() // zararlıda şiddet + yaygınlık zorunlu
    await expect(page.getByTestId('gozlem-eksik')).toContainText('Şiddet ve yaygınlık')
    await page.getByTestId('gozlem-siddet-orta').click()
    await page.getByTestId('gozlem-yayginlik-bolge').click()
    await page.getByTestId('konum-gps').click()
    await expect(page.getByTestId('konum-ipucu')).toContainText('±12', { timeout: 15_000 })
    await page.getByTestId('kayit-notu').fill('Yaprak altında ağ, kuzey sıra')
    const foto = await buyukFoto(page)
    expect(foto.length).toBeGreaterThan(1_500_000) // test geçerli: orijinal gerçekten büyük
    let govdeBayt = -1
    await page.route('**/api/gardens/*/saha-kayitlari/*/foto', async (route) => {
      govdeBayt = route.request().postDataBuffer()?.length ?? -1
      await route.continue()
    })
    await page.getByTestId('kayit-kamera').setInputFiles({ name: 'buyuk.jpg', mimeType: 'image/jpeg', buffer: foto })
    await expect(page.getByTestId('foto-sayisi')).toContainText('1 fotoğraf hazır', { timeout: 30_000 })
    await page.getByTestId('kayit-kaydet').click()
    await expect(page.getByTestId('kayit-cekmecesi')).toHaveCount(0, { timeout: 30_000 }) // kayıt eklenince çekmece kapanır
    expect(govdeBayt).toBeGreaterThan(0)
    expect(govdeBayt).toBeLessThan(1_300_000) // ~1 MB hedefi (+ multipart zarfı); orijinal > 1,5 MB
    expect(govdeBayt).toBeLessThan(foto.length / 1.5)
    const satir = page.getByTestId('kayit-satiri').first()
    await expect(satir.getByTestId('kayit-etiket')).toContainText('Zararlı · Kırmızı örümcek · orta · bölge', { timeout: 30_000 })
    await expect(satir.getByTestId('kayit-etiket')).toContainText('konum ±12 m')
    await expect(satir).toContainText('Yaprak altında ağ')
    const img = satir.getByTestId('foto-serit').locator('img').first()
    await expect(img).toBeVisible()
    expect(await img.evaluate((i: HTMLImageElement) => Math.max(i.naturalWidth, i.naturalHeight))).toBeLessThanOrEqual(2048)
    // kategoriyle süz
    await page.getByTestId('kayit-kategori-hastalik').click()
    await expect(page.getByTestId('kayit-bos')).toContainText('süzgeçle eşleşen kayıt yok')
    await page.getByTestId('kayit-kategori-zararli').click()
    await expect(page.getByTestId('kayit-satiri')).toHaveCount(1)
    // Günlük sekmesi
    await page.goto(`/bahceler/${g.id}/gunluk`)
    const gs = page.getByTestId('gunluk-satiri').first()
    await expect(gs.getByTestId('gunluk-etiket')).toContainText('Zararlı · Kırmızı örümcek · orta · bölge', { timeout: 30_000 })
    await page.getByTestId('gunluk-kategori-hastalik').click()
    await expect(page.getByTestId('gunluk-bos')).toContainText('kayıt yok')
    await page.getByTestId('gunluk-kayit-ekle').click()
    await expect(page).toHaveURL(new RegExp(`/bahceler/${g.id}/defter\\?kayit=yeni`))
    await expect(page.getByTestId('kayit-formu')).toBeVisible({ timeout: 30_000 })
  })

  test('taslak: yarım kalan kayıt sayfa yenilenince geri gelir; fenolojide şiddet isteğe bağlı', async ({ page }) => {
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Taslak Bahçesi', lng: MERKEZ.lng, lat: MERKEZ.lat, sideM: 300 })
    await page.goto(`/bahceler/${g.id}/defter`)
    await kayitAc(page)
    await page.getByTestId('gozlem-kategori-fenoloji').click()
    await page.getByTestId('gozlem-etiket').selectOption('cicek')
    await expect(page.getByTestId('kayit-kaydet')).toBeEnabled() // fenolojide şiddet/yaygınlık isteğe bağlı
    await page.getByTestId('kayit-notu').fill('İlk çiçekler açtı')
    await page.getByTestId('konum-gps').click()
    await expect(page.getByTestId('konum-ipucu')).toContainText('±12', { timeout: 15_000 })
    await page.reload()
    await kayitAc(page)
    await expect(page.getByTestId('kayit-notu')).toHaveValue('İlk çiçekler açtı')
    await expect(page.getByTestId('gozlem-etiket')).toHaveValue('cicek')
    await expect(page.getByTestId('konum-ipucu')).toContainText('±12')
    await page.getByTestId('kayit-kaydet').click()
    await expect(page.getByTestId('kayit-satiri').first().getByTestId('kayit-etiket')).toContainText('Fenoloji · Çiçek', { timeout: 30_000 })
    await kayitAc(page)
    await expect(page.getByTestId('kayit-notu')).toHaveValue('') // başarılı kayıtta taslak temizlenir
  })

  test('GPS izni yoksa anlaşılır ileti; haritadan nokta seçilebilir', async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: [] })
    const page = await ctx.newPage()
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Izinsiz', lng: MERKEZ.lng + 0.02, lat: MERKEZ.lat, sideM: 300 })
    await page.goto(`/bahceler/${g.id}/defter`)
    await kayitAc(page)
    await page.context().clearPermissions()
    await page.getByTestId('konum-gps').click()
    await expect(page.getByTestId('konum-gps-hata')).toContainText('Haritadan nokta seçebilirsiniz', { timeout: 20_000 })
    await ctx.close()
  })
})

test.describe('Günlük · 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('«+ Kayıt» kaydırmadan görünür; açılınca harita ve form AYNI görünümde, nokta seçmek için kaydırma yok', async ({ page }) => {
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Mobil Defter', lng: MERKEZ.lng + 0.03, lat: MERKEZ.lat, sideM: 300 })
    seedOlayOzet(g.id) // doğrulama kartları sayfayı uzatır (jlnnlk'te form 5.000 px aşağıdaydı)
    await page.goto(`/bahceler/${g.id}/defter`)
    const ekle = page.getByTestId('kayit-ekle')
    await expect(ekle).toBeVisible({ timeout: 30_000 })
    const vp = page.viewportSize()!
    const b0 = (await ekle.boundingBox())!
    expect(b0.y >= 0 && b0.y + b0.height <= vp.height && b0.x + b0.width <= vp.width).toBe(true) // kaydırma olmadan görünür ve dokunulabilir
    expect(b0.height).toBeGreaterThanOrEqual(44)
    await ekle.click()
    const form = page.getByTestId('kayit-cekmecesi')
    await expect(form).toBeVisible()
    await expect(form).toHaveAttribute('data-yerlesti', 'true') // yerleşim (harita üste, çekmece altta kalan alana) tamamlandı
    const harita = page.getByTestId('saha-haritasi')
    const hb = (await harita.boundingBox())!
    const fb = (await form.boundingBox())!
    expect(hb.y).toBeGreaterThanOrEqual(0)
    expect(hb.y + hb.height).toBeLessThanOrEqual(fb.y + 2) // harita üstte, form altta: üst üste binmez
    expect(fb.y + fb.height).toBeLessThanOrEqual(vp.height + 1) // ikisi de görünümde
    expect(hb.height).toBeGreaterThanOrEqual(200)
    // nokta seç: kaydırma YOK
    await page.getByTestId('gozlem-kategori-genel').click()
    await page.getByTestId('konum-nokta').click()
    const kaydirmaOnce = await page.evaluate(() => document.querySelector('[data-testid="defter-sayfasi"]')!.scrollTop)
    const p = await mapPoint(page, 0, 0)
    await page.mouse.click(p.x, p.y)
    await expect(page.getByTestId('konum-ipucu')).toContainText('Nokta seçildi')
    expect(await page.evaluate(() => document.querySelector('[data-testid="defter-sayfasi"]')!.scrollTop)).toBe(kaydirmaOnce)
    await page.getByTestId('kayit-notu').fill('Mobil kayıt')
    await page.getByTestId('kayit-kaydet').click()
    await expect(page.getByTestId('kayit-cekmecesi')).toHaveCount(0)
    await expect(page.getByTestId('kayit-satiri').first()).toContainText('Mobil kayıt', { timeout: 30_000 })
  })

  for (const [w, h] of [[390, 844], [1024, 768]] as const) {
    test(`Saha Defteri'nde 44 px altı dokunma hedefi yok (${w} px)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await newUser(page)
      const g = await createGarden(page.request, { ad: `Hedef ${w}`, lng: MERKEZ.lng + 0.04 + w / 1e6, lat: MERKEZ.lat, sideM: 300 })
      seedOlayOzet(g.id)
      await page.goto(`/bahceler/${g.id}/defter`)
      await expect(page.getByTestId('dogrulama-karti').first()).toBeVisible({ timeout: 30_000 })
      for (const adim of ['kapali', 'acik'] as const) {
        if (adim === 'acik') await kayitAc(page)
        const kucuk = await page.evaluate(() => {
          const out: string[] = []
          const kok = [document.querySelector('[data-testid="defter-sayfasi"]')!, ...document.querySelectorAll('[data-testid="kayit-cekmecesi"]')]
          for (const k of kok) {
            k.querySelectorAll('button, a[href], summary, select, textarea, input, label').forEach((e) => {
              if (e.closest('.maplibregl-map') || e.closest('.sr-only')) return
              const el = e as HTMLElement
              if (el.tagName === 'LABEL' && !el.querySelector('input')) return // yalnız bir alana bağlı etiket: alanın kendisi ölçülür
              const girdi = el.tagName === 'INPUT' ? (el as HTMLInputElement) : null
              if (girdi && (girdi.type === 'hidden' || girdi.classList.contains('sr-only'))) return
              if (girdi && (girdi.type === 'checkbox' || girdi.type === 'file' || girdi.type === 'radio')) return // etiketi ölçülür
              const r = el.getBoundingClientRect()
              if (r.width === 0 || r.height === 0) return
              const metin = (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)
              const dar = el.tagName === 'A' ? false : r.width < 44 // bağlantıda yalnız yükseklik (metin genişliği değişken)
              if (r.height < 44 || dar) out.push(`${metin} ${Math.round(r.width)}×${Math.round(r.height)}`)
            })
          }
          return out
        })
        expect(kucuk, `${w} px, çekmece ${adim}`).toEqual([])
      }
    })
  }
})

test('axe: Saha Defteri (çekmece açık, etiket seçili) ve Günlük sekmesi', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Axe Günlük', lng: MERKEZ.lng + 0.06, lat: MERKEZ.lat, sideM: 300 })
  seedOlayOzet(g.id)
  await page.goto(`/bahceler/${g.id}/defter`)
  await expect(page.getByTestId('dogrulama-karti').first()).toBeVisible({ timeout: 30_000 })
  await axeTemiz(page, 'defter (kapalı)')
  await kayitAc(page)
  await page.getByTestId('gozlem-kategori-cevre').click()
  await page.getByTestId('gozlem-etiket').selectOption('don')
  await axeTemiz(page, 'defter (çekmece açık)')
  await page.goto(`/bahceler/${g.id}/gunluk`)
  await expect(page.getByTestId('gunluk-icerik')).toBeVisible({ timeout: 30_000 })
  await axeTemiz(page, 'günlük sekmesi')
})

test.describe('Günlük · saha turu', () => {
  test('10B «belirsiz» düşüş kontrol noktası olur: «Sahada şunlara bakın» + «Sebep buydu» → ziyaret edilir, gözlem etiketle yazılır', async ({ page }) => {
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Tur Sebep', lng: MERKEZ.lng + 0.05, lat: MERKEZ.lat, sideM: 300 })
    seedSebep(g.id, 'belirsiz')
    await page.route('**/api/gardens/*/weather', (route) => route.abort())
    await page.goto(`/bahceler/${g.id}/defter`)
    const nokta = page.getByTestId('tur-noktasi').first()
    await expect(nokta).toBeVisible({ timeout: 40_000 })
    await expect(nokta).toContainText('Sebep belirsiz')
    await nokta.getByRole('button').first().click()
    const kontrol = page.getByTestId('tur-kontrol')
    await expect(kontrol).toBeVisible()
    for (const s of ['don', 'su', 'besin', 'hastalik', 'mekanik']) await expect(kontrol.locator(`[data-testid="tur-kontrol-grup"][data-sebep="${s}"]`)).toBeVisible()
    await kontrol.locator('[data-testid="tur-kontrol-grup"][data-sebep="don"] summary').click()
    await expect(kontrol.locator('[data-sebep="don"]').locator('a[href^="https://ask.ifas.ufl.edu"]').first()).toBeVisible() // kaynaklı madde bağlantıyla
    await kontrol.locator('[data-sebep="su"] summary').click()
    await expect(kontrol.locator('[data-sebep="su"]')).toContainText('(kaynak yok)') // kaynaksız madde açıkça işaretli
    await page.getByTestId('tur-sebep-su').click()
    await expect(page.getByTestId('tur-ilerleme')).toContainText('1/1 tamam', { timeout: 30_000 })
    const etiket = page.getByTestId('kayit-etiket').filter({ hasText: 'Su stresi (solgunluk)' })
    await expect(etiket).toHaveCount(1, { timeout: 30_000 })
    await expect(etiket).toHaveAttribute('data-kaynak', 'sistem')
    await expect(etiket).toContainText('Çevre / fizyolojik')
  })
})
