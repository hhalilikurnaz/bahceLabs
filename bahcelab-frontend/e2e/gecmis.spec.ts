import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedOlayOzet, seedScenes } from './yardimcilar'

/** Geçmiş sayfası (9G-A): sezon bandı, yaz haritaları, olay zaman çizelgesi, yıl özeti; her etkileşim çalışma alanı haritasını ilgili ana açar. */
const yilGrid = (yil: number) => ({ yil, satir: 3, sutun: 3, koordinatlar: [[27.9, 38.91], [27.91, 38.91], [27.91, 38.9], [27.9, 38.9]], degerler: [0.5, 0.6, 0.7, 0.55, 0.65, 0.72, 0.6, 0.68, 0.7], indeks: 'ndvi' })
const yilBilgisi = (yil: number, uyumsuz: boolean) => ({ yil, sahne_sayisi: 8, kismi: false, kapsam: 1, korelasyon: 0.9, uyumsuz, uyumsuz_nedeni: uyumsuz ? 'diğer yıllarla uyuşmuyor' : null, karar_bekliyor: false, varsayilan_dahil: true, karar_zamani: null, karar_notu: null, yetersiz_veri: false, yetersiz_nedeni: null, net_gun_sayisi: 20, donem_kapsami: 1, yil_net_sahne: 20, yil_bulutlu: 2, aday_sayisi: 20, dahil: !uyumsuz, elle: null })

test.describe('Geçmiş sayfası', () => {
  test('açılır: sezon bandı, yıl özeti (hasat «kayıt yok», sayı yok) ve olay çizelgesi görünür', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Geçmiş Bahçesi', lng: 27.9, lat: 38.9, sideM: 300 })
    seedScenes(garden.id)
    seedOlayOzet(garden.id)
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    await expect(page.getByTestId('gecmis-baslik')).toContainText('Geçmiş')
    await expect(page.getByTestId('sezon-egrisi').getByRole('heading')).toContainText('önceki', { timeout: 30_000 })
    await expect(page.getByTestId('yil-tablosu')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('yil-hasat').first()).toHaveText('kayıt yok')
    await expect(page.getByTestId('yil-canlilik').first()).not.toHaveText(/\d[.,]\d/) // kademe dili: sayı yok
    // Yeşerme başlangıcı yalnız eğri güvenilirse ve «ön değer» etiketiyle gösterilir; değilse hiç gösterilmez (uydurma yok)
    await expect(page.getByTestId('yesillenme-yok').or(page.getByTestId('yesillenme-listesi'))).toBeVisible()
    if (await page.getByTestId('yesillenme-listesi').count()) await expect(page.getByTestId('yesillenme-listesi')).toContainText('ön değer')
    await expect(page.getByTestId('olay-satiri')).toHaveCount(2)
  })

  test('olay süzgeçleri tür ve güvene göre çalışır; satır ayrıntı açar ve «Haritada göster» çalışma alanını olayın tarihine açar', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Olay Çizelgesi', lng: 27.91, lat: 38.91, sideM: 300 })
    seedScenes(garden.id)
    seedOlayOzet(garden.id)
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    await expect(page.getByTestId('olay-satiri')).toHaveCount(2, { timeout: 30_000 })
    await page.getByTestId('tur-don').click()
    await expect(page.getByTestId('olay-satiri')).toHaveCount(1)
    await expect(page.getByTestId('olay-satiri').first()).toHaveAttribute('data-tur', 'don')
    await page.getByTestId('tur-don').click()
    await page.getByTestId('guven-yuksek').click()
    await expect(page.getByTestId('olay-bos')).toBeVisible() // yüksek güvenli olay yok
    await page.getByTestId('guven-yuksek').click()
    await page.getByTestId('olay-satiri').first().getByRole('button').click()
    await expect(page.getByTestId('olay-ayrinti')).toBeVisible()
    await page.getByTestId('olay-haritada').click()
    await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))
    await expect(page.getByTestId('olay-karti')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Olay kartını kapat' }).click()
    await expect(page.getByTestId('olay-karti')).toHaveCount(0)
  })

  test('sezon bandında aya dokunmak çalışma alanı haritasını o aya açar', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Ay Dokunuşu', lng: 27.92, lat: 38.92, sideM: 300 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    await expect(page.getByTestId('sezon-son-deger')).toBeVisible({ timeout: 30_000 }) // edinimler yüklendi: ay → tarih eşlemesi hazır
    await page.getByTestId('ay-3').click()
    await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))
    await expect(page.getByTestId('tarih-kutusu')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('secili-tarih')).toContainText('Mar')
  })

  test('yaz haritaları: uyumsuz yıl kesikli çerçevelidir; dokununca harita o yazı gösterir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Yaz Kareleri', lng: 27.9, lat: 38.9, sideM: 300 })
    seedScenes(garden.id)
    await page.route('**/bolgeler/cok-yillik/sonuc*', (route) =>
      route.fulfill({ json: { durum: 'hazir', mesaj: null, bolge_sayisi: 3, versiyon: 1, hesaplama: null, yil_araligi: '2021–2022', yillar: [yilBilgisi(2021, true), yilBilgisi(2022, false)], bolgeler: null, ozet: [], homojen: false, yayilim_yuzde: null, yorumlar: [], not_: '' } }),
    )
    await page.route('**/bolgeler/cok-yillik/yillar/*/degerler', (route) => route.fulfill({ json: yilGrid(Number(route.request().url().split('/yillar/')[1].split('/')[0])) }))
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    const kareler = page.getByTestId('yaz-kare')
    await expect(kareler).toHaveCount(2, { timeout: 30_000 })
    await expect(page.locator('[data-testid="yaz-kare"][data-yil="2021"]')).toHaveAttribute('data-uyumsuz', 'true')
    await expect(page.locator('[data-testid="yaz-kare"][data-yil="2022"]')).toHaveAttribute('data-uyumsuz', 'false')
    await page.locator('[data-testid="yaz-kare"][data-yil="2021"]').click()
    await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}$`))
    await expect(page.getByTestId('tarih-kutusu')).toHaveAttribute('data-yil', '2021', { timeout: 30_000 })
    await expect(page.getByTestId('secili-tarih')).toHaveText('2021 yazı')
    await page.getByTestId('yil-gorunumunden-cik').click()
    await expect(page.getByTestId('tarih-kutusu')).not.toHaveAttribute('data-yil', /.+/)
  })

  test('çok yıllı analiz yoksa yaz haritaları boş durum gösterir (uydurma kare yok)', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Analiz Yok', lng: 27.93, lat: 38.93, sideM: 300 })
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    await expect(page.getByTestId('yaz-haritalari-bos')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('yaz-kare')).toHaveCount(0)
  })

  test('390 px: gösterge sekmeleri («Taç ve toprak» dahil beşi) tek satırda kalır, taşmaz; tam ad erişilebilir adda durur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Sekme Satırı', lng: 27.94, lat: 38.94, sideM: 300 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    const sekmeler = page.getByTestId('sezon-sekmeleri')
    await sekmeler.scrollIntoViewIfNeeded()
    await expect(page.getByTestId('sezon-ndvi')).toBeVisible({ timeout: 30_000 })
    const kutular = await Promise.all(['ndvi', 'ndre', 'lai', 'ndmi', 'msavi'].map(async (g) => page.getByTestId(`sezon-${g}`).boundingBox()))
    const kap = await sekmeler.boundingBox()
    expect(kutular.every((k) => k !== null)).toBe(true)
    expect(new Set(kutular.map((k) => Math.round(k!.y))).size).toBe(1) // beşi aynı satırda
    expect(Math.max(...kutular.map((k) => k!.x + k!.width))).toBeLessThanOrEqual(kap!.x + kap!.width + 1) // kaydırmaya gerek kalmadan sığar
    await expect(page.getByRole('tab', { name: 'Taç ve toprak' })).toBeVisible() // kısa etiket «Taç», erişilebilir ad tam
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true) // sayfa yatay taşmaz
  })
})
