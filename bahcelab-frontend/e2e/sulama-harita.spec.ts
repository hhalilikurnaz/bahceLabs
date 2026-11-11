import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, hazirla, newUser, seedScenes, seedWater } from './yardimcilar'

/** Sulama simülatörü (9H-S4 dilim 2): harita katmanları, göstergeler, alt çubuk, vana eylemleri, çizim aracı. GERÇEK arka uçla. */
const PROFIL = { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke' }
const EKRAN = process.env.D2_EKRAN ?? ''

async function kurulum(page: Page, ad: string, lng: number, opts: { vanalar?: boolean; ag?: boolean } = {}) {
  await newUser(page)
  const garden = await createGarden(page.request, { ad, lng, lat: 38.7, sideM: 200 })
  seedScenes(garden.id)
  seedWater(garden.id)
  expect((await page.request.patch(`/api/gardens/${garden.id}`, { data: { agac_sayisi: 1800 } })).ok()).toBeTruthy()
  expect((await page.request.put(`/api/gardens/${garden.id}/sulama-profili`, { data: { ...PROFIL, kwh_fiyat_tl: null } })).ok()).toBeTruthy()
  if (opts.vanalar) {
    const g = (await (await page.request.get(`/api/gardens/${garden.id}`)).json()) as { geometry: GeoJSON.Polygon }
    const xs = g.geometry.coordinates[0].map((c) => c[0])
    const ys = g.geometry.coordinates[0].map((c) => c[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const xm = (x0 + x1) / 2
    const kutu = (a: number, b: number) => ({ type: 'Polygon', coordinates: [[[a, y0], [b, y0], [b, y1], [a, y1], [a, y0]]] })
    const ag = opts.ag ? { pompa: { type: 'Point', coordinates: [x0 - 0.0002, y0] }, ana_boru: { type: 'LineString', coordinates: [[x0 - 0.0002, y0], [xm, y0 - 0.00004], [x1, y0 - 0.00004]] }, sira_yonu_derece: 90 } : {}
    const r = await page.request.put(`/api/gardens/${garden.id}/sulama-sektorleri`, { data: { sektorler: [{ ad: 'V1', geometry: kutu(x0, xm), vana_debi_m3h: 30 }, { ad: 'V2', geometry: kutu(xm, x1), vana_debi_m3h: 30 }], ...ag } })
    expect(r.ok(), await r.text()).toBeTruthy()
  }
  return garden
}
const yol = (id: string) => `/bahceler/${id}/su/sulama`
async function ekran(page: Page, ad: string) {
  if (EKRAN) await page.screenshot({ path: `${EKRAN}/${ad}.png` })
}

test('harita simülatörü: vana etiketleri, 3 gösterge, kartlar, alt çubuk', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kurulum(page, 'Harita Sim', 27.81, { vanalar: true, ag: true })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(2, { timeout: 40_000 })
  await expect(page.getByTestId('harita-vana-baslik').first()).toHaveText(/^V1 · %\d+$/)
  await expect(page.getByTestId('harita-vana-alt').first()).toContainText(/((stres|yakın|yeterli|dolu) · (sonraki \d+ \p{L}+|sulama gerekmiyor)|(sulandı|sulanacak|sulanıyor) · %\d+)/u) // bugün sulama günü olabilir
  await expect(page.getByTestId('durum-karti')).toBeVisible()
  await expect(page.getByTestId('alt-cubuk')).toBeVisible()
  await expect(page.getByTestId('olcek-kuzey')).toBeVisible()
  await expect(page.getByTestId('harita-notu')).toContainText('dikim aralığından çizildi · varsayım')
  await page.waitForTimeout(1500)
  await ekran(page, 'bugun-toprak-1440')
  for (const e of ['stres', 'fazla']) {
    await page.getByTestId(`gosterge-${e}`).click()
    await page.waitForTimeout(600)
    await ekran(page, `gosterge-${e}-1440`)
  }
})

test('alt çubuk: sonraki sulama günü, oynat/duraklat, klavye; sulama gününde vana «sulanıyor»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await hazirla(page, 'Harita Oynat', 27.82) // 4 vana
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(4, { timeout: 40_000 })
  const tarih0 = await page.getByTestId('alt-tarih').textContent()
  // sezon şeridinde bugün işareti var (bu yıl kipi)
  await expect(page.getByTestId('sezon-seridi')).toBeVisible()
  await page.getByTestId('alt-sonraki-sulama').click()
  await expect(page.getByTestId('alt-tarih')).not.toHaveText(tarih0 ?? '')
  await expect(page.getByTestId('durum-chip')).toHaveText(/Sulama günü|Bugün|Tahmin/)
  await expect(page.locator('[data-testid="harita-vana-etiketi"][data-sulaniyor="true"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="harita-vana-alt"]').filter({ hasText: /^(sulandı|sulanacak|sulanıyor) · %\d+$/ }).first()).toBeVisible()
  // tutarlılık: durum kartındaki «sulanıyor» vanaları ile haritada halkası olan vana etiketleri AYNI küme (sim sırası ≠ panel sırası olabilir)
  const kartVanalari = ((await page.getByTestId('durum-neden').textContent()) ?? '').split(' sulanıyor')[0]!.split(',').map((x) => x.trim()).sort()
  const etiketVanalari = (await page.locator('[data-testid="harita-vana-etiketi"][data-sulaniyor="true"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.vana ?? ''))).sort()
  expect(etiketVanalari).toEqual(kartVanalari)
  await page.waitForTimeout(800)
  await ekran(page, 'sulama-gunu-1440')
  // klavye: → bir gün ileri, ← geri
  const t1 = await page.getByTestId('alt-tarih').textContent()
  await page.getByTestId('sezon-seridi').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('alt-tarih')).not.toHaveText(t1 ?? '')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('alt-tarih')).toHaveText(t1 ?? '')
  // oynat → imleç ilerler, duraklat
  await page.getByTestId('alt-hiz-8').click()
  await page.getByTestId('alt-oynat').click()
  await expect(page.getByTestId('alt-oynat')).toHaveAttribute('aria-label', 'Duraklat')
  await page.waitForTimeout(1500)
  await page.getByTestId('alt-oynat').click()
  expect(await page.getByTestId('alt-tarih').textContent()).not.toBe(t1)
  await page.getByTestId('alt-bugun').click()
  await expect(page.getByTestId('durum-chip')).toHaveText('Bugün')
})

test('vana tıklayınca panel o vanaya odaklanır; Kc kaynağı (piksel + bulut) ve iki eylem', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kurulum(page, 'Harita Vana', 27.83, { vanalar: true })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(2, { timeout: 40_000 })
  await page.locator('[data-testid="harita-vana-etiketi"][data-vana="V2"]').click()
  await expect(page.getByTestId('vana-odagi')).toBeVisible()
  await expect(page.getByTestId('vana-odagi-baslik')).toHaveText(/^V2 · %\d+$/)
  await expect(page.getByTestId('vana-kc')).toContainText('Kc')
  await expect(page.getByTestId('vana-kc')).toContainText(/Sentinel-2 pikselinin ortalaması|bahçe değeri/)
  expect(await page.getByTestId('vana-odagi').textContent()).not.toMatch(/SoilGrids|toprak vana/i) // toprak notu ekranda yok (ADR 0027)
  await expect(page.getByTestId('vana-kayit-isle')).toBeVisible()
  await expect(page.getByTestId('vana-programa-ekle')).toBeVisible()
  await ekran(page, 'vana-odagi-1440')
  await page.getByTestId('vana-programa-ekle').click()
  await expect(page.getByTestId('vana-odagi')).toBeVisible()
  await page.getByTestId('vana-odagi-kapat').click()
  await expect(page.getByTestId('vana-odagi')).toHaveCount(0)
})

for (const [ad, w, h] of [['1024', 1024, 768], ['390', 390, 844]] as const) {
  test(`görünüm ${ad}: harita, alt çubuk ve panel taşmaz`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    const g = await kurulum(page, `Harita ${ad}`, 27.84 + (w === 390 ? 0.01 : 0), { vanalar: true, ag: true })
    await page.goto(yol(g.id))
    await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(2, { timeout: 40_000 })
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const bar = await page.getByTestId('alt-cubuk').boundingBox()
    expect(bar).not.toBeNull()
    if (w === 390) {
      expect(bar!.y + bar!.height).toBeGreaterThan(h - 4) // sabit alt çubuk ekranın dibinde
      const sayfa = await page.getByTestId('alt-sayfa-kap').boundingBox()
      expect(sayfa!.y + sayfa!.height).toBeLessThanOrEqual(bar!.y + 2) // alt sayfa çubuğun üstünde biter
    }
    await ekran(page, `bugun-${ad}`)
    await page.getByTestId('alt-sonraki-sulama').click()
    await page.waitForTimeout(800)
    await ekran(page, `sulama-gunu-${ad}`)
  })
}

test('vana çizim aracı: bölme çizgisi → iki vana (ad + debi), pompa + ana boru + sıra yönü, kaydet; sunucu doğrular', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kurulum(page, 'Harita Çizim', 27.86)
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(1, { timeout: 40_000 }) // çizilmedi: tek vana (Bahçe)
  await expect(page.getByTestId('harita-notu')).toContainText('Boru ve pompa çizilmedi')
  await page.getByTestId('vana-ciz-ac').click()
  await expect(page.getByTestId('vana-cizim-araci')).toBeVisible()
  const kutu = (await page.getByTestId('harita-paneli').boundingBox())!
  const cx = kutu.x + kutu.width / 2
  const cy = kutu.y + 330
  // bölme çizgisi: parselin ortasından dikey
  await page.mouse.click(cx, cy - 150)
  await page.mouse.click(cx, cy + 150)
  await expect(page.getByTestId('cizim-vana-ad')).toHaveCount(2)
  await page.getByTestId('cizim-vana-ad').first().fill('Kuzey')
  await page.getByTestId('cizim-vana-debi').first().fill('25')
  await page.getByTestId('cizim-adim-pompa').click()
  await page.mouse.click(cx - 330, cy + 60)
  await page.getByTestId('cizim-adim-boru').click()
  await page.mouse.click(cx - 330, cy + 60)
  await page.mouse.click(cx - 200, cy + 60)
  await page.mouse.click(cx - 120, cy + 170)
  await page.getByTestId('cizim-adim-yon').click()
  await page.getByTestId('cizim-yon-derece').fill('30')
  await ekran(page, 'cizim-araci-1440')
  await page.getByTestId('cizim-kaydet').click()
  await expect(page.getByTestId('vana-cizim-araci')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(2, { timeout: 30_000 })
  const r = (await (await page.request.get(`/api/gardens/${g.id}/sulama-sektorleri`)).json()) as { sektorler: { ad: string; vana_debi_m3h: number | null }[]; pompa: unknown; ana_boru: { coordinates: unknown[] } | null; sira_yonu_derece: number | null }
  expect(r.sektorler).toHaveLength(2)
  expect(r.sektorler.some((s) => s.ad === 'Kuzey' && s.vana_debi_m3h === 25)).toBe(true)
  expect(r.pompa).not.toBeNull()
  expect(r.ana_boru?.coordinates.length).toBe(3)
  expect(r.sira_yonu_derece).toBe(30)
  await expect(page.getByTestId('harita-notu')).toContainText('sizin seçiminiz')
  await ekran(page, 'cizim-sonrasi-1440')
})

test('çizim aracı doğrulama: tekrar eden vana adı kaydı engeller (sunucuya gitmeden)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kurulum(page, 'Harita Çizim 2', 27.87)
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(1, { timeout: 40_000 })
  await page.getByTestId('vana-ciz-ac').click()
  const kutu = (await page.getByTestId('harita-paneli').boundingBox())!
  const cx = kutu.x + kutu.width / 2
  const cy = kutu.y + 330
  await page.mouse.click(cx - 100, cy - 150)
  await page.mouse.click(cx - 100, cy + 150)
  await page.getByTestId('cizim-vana-ad').nth(1).fill(await page.getByTestId('cizim-vana-ad').first().inputValue())
  await expect(page.getByTestId('cizim-uyari')).toContainText('tekrar etmemeli')
  await page.getByTestId('cizim-kaydet').click()
  await expect(page.getByTestId('cizim-uyari')).toContainText('tekrar etmemeli')
  expect(((await (await page.request.get(`/api/gardens/${g.id}/sulama-sektorleri`)).json()) as { tanimli: boolean }).tanimli).toBe(false) // kaydedilmedi
})

test('hareketi azalt: oynatma ve animasyon kapalı, durum metinle; axe temiz', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kurulum(page, 'Harita Azalt', 27.88, { vanalar: true, ag: true })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(2, { timeout: 40_000 })
  await expect(page.getByTestId('alt-oynat')).toBeDisabled()
  await expect(page.getByTestId('yagmur')).toHaveCount(0) // yağmur parçacığı yok
  await page.getByTestId('alt-sonraki-sulama').click()
  await expect(page.getByTestId('durum-neden')).toContainText('sulanıyor') // durum yazıyla
  await expect(page.locator('[data-testid="harita-vana-alt"]').filter({ hasText: /^(sulandı|sulanacak|sulanıyor) · %\d+$/ }).first()).toBeVisible()
  const hareket = await page.evaluate(() => getComputedStyle(document.querySelector('[data-sulaniyor="true"]')!, '::after').animationName)
  expect(hareket).toBe('none') // halka animasyonu kapalı
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
})

test('performans: sulama günü oynatılırken kare hızı ve render sayısı', async ({ page }, testInfo) => {
  test.skip(process.env.CI === 'true' && process.env.E2E_PERF_CI !== '1', 'performans eşikleri yerel donanımda doğrulanır')
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kurulum(page, 'Harita Perf', 27.89, { vanalar: true, ag: true })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('harita-vana-etiketi')).toHaveCount(2, { timeout: 40_000 })
  await page.getByTestId('alt-sonraki-sulama').click() // bir sulama gününde dur
  await page.getByTestId('alt-onceki-sulama').click().catch(() => undefined)
  await page.getByTestId('alt-sonraki-sulama').click()
  await page.waitForTimeout(500)
  await page.getByTestId('alt-hiz-1').click()
  const olcum = page.evaluate(() => new Promise<{ fps: number; kareP95: number; kare: number }>((coz) => {
    const dt: number[] = []
    let son = performance.now()
    const bas = son
    const f = (t: number) => {
      dt.push(t - son)
      son = t
      if (t - bas < 4000) requestAnimationFrame(f)
      else { const s = [...dt].sort((a, b) => a - b); coz({ fps: (dt.length / (t - bas)) * 1000, kareP95: s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!, kare: dt.length }) }
    }
    requestAnimationFrame(f)
  }))
  await page.getByTestId('alt-oynat').click() // sulama gününde: gün içi ilerleme, boru akışı, şerit genişlemesi
  const o = await olcum
  await page.getByTestId('alt-oynat').click()
  testInfo.annotations.push({ type: 'sulama-oynatma-fps', description: `fps ${o.fps.toFixed(1)} · kare p95 ${o.kareP95.toFixed(1)} ms · ${o.kare} kare` })
  console.log(`SULAMA_FPS ${JSON.stringify(o)}`)
  expect(o.fps).toBeGreaterThanOrEqual(Number(process.env.E2E_FPS_MIN ?? 30))
})
