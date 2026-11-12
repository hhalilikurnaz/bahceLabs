import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, newUser, seedScenes, seedSistemKontrol, seedWater } from './yardimcilar'

/** Sulama sistemi kontrol işareti (9I Dilim 1B, ADR 0029): GERÇEK arka uç; NDMI serisi tohumlanır, kova Saha Defteri sulamasıyla dolar. */
const PROFIL = { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke', kwh_fiyat_tl: null }
const gunOnce = (n: number): string => {
  const d = new Date(Date.now() - n * 86_400_000)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(d)
}

async function kur(page: Page, ad: string, lng: number, vanalar: boolean) {
  await newUser(page)
  const g = await createGarden(page.request, { ad, lng, lat: 38.7, sideM: 400 })
  seedScenes(g.id)
  seedWater(g.id)
  expect((await page.request.patch(`/api/gardens/${g.id}`, { data: { agac_sayisi: 1800 } })).ok()).toBeTruthy()
  expect((await page.request.put(`/api/gardens/${g.id}/sulama-profili`, { data: PROFIL })).ok()).toBeTruthy()
  if (vanalar) {
    const b = (await (await page.request.get(`/api/gardens/${g.id}`)).json()) as { geometry: GeoJSON.Polygon }
    const xs = b.geometry.coordinates[0].map((c) => c[0])
    const ys = b.geometry.coordinates[0].map((c) => c[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const xm = (x0 + x1) / 2
    const kutu = (a: number, c: number) => ({ type: 'Polygon', coordinates: [[[a, y0], [c, y0], [c, y1], [a, y1], [a, y0]]] })
    expect((await page.request.put(`/api/gardens/${g.id}/sulama-sektorleri`, { data: { sektorler: [{ ad: 'V1', geometry: kutu(x0, xm), vana_debi_m3h: 30 }, { ad: 'V2', geometry: kutu(xm, x1), vana_debi_m3h: 30 }] } })).ok()).toBeTruthy()
  }
  for (const n of [10, 4]) expect((await page.request.post(`/api/gardens/${g.id}/saha-kayitlari`, { data: { tur: 'sulama', tarih: gunOnce(n), ayrinti: { m3: 40000 } } })).ok()).toBeTruthy() // 160 da · ≈ 250 mm: kova dolar
  return g
}
const yol = (id: string) => `/bahceler/${id}/su/sulama`

test('vana bazında: yalnız V2 düşük → V2 satırında işaret (güven yüksek), V1 temiz; haritada V2 sınırı ve etiketi; yanıt Saha Defteri\'ne düşer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kur(page, 'SK Vana', 28.11, true)
  seedSistemKontrol(g.id, 'vana')
  await page.goto(yol(g.id))
  const v2 = page.locator('[data-testid="vana-satiri"][data-vana="V2"]')
  await expect(v2).toHaveAttribute('data-sistem-kontrol', 'isaret', { timeout: 40_000 })
  await expect(page.locator('[data-testid="vana-satiri"][data-vana="V1"]')).toHaveAttribute('data-sistem-kontrol', '')
  await expect(v2.getByTestId('sistem-kontrol-cumle')).toContainText("V2'de sulama sistemini kontrol edin")
  await expect(v2.getByTestId('sistem-kontrol-cumle')).toContainText('tıkalı damlatıcı, arızalı vana ya da basınç sorunu')
  await expect(v2.getByTestId('sistem-kontrol-guven')).toContainText('Güven: yüksek')
  await v2.getByTestId('sistem-kontrol-nasil').locator('summary').click()
  await expect(v2.getByTestId('sistem-kontrol-nasil')).toContainText('z ≤ -1.5')
  // harita: V2 etiketi ve sınırı işaretli
  await expect(page.locator('[data-testid="harita-vana-etiketi"][data-vana="V2"]')).toHaveAttribute('data-sk', 'true', { timeout: 30_000 })
  await expect(page.locator('[data-testid="harita-vana-etiketi"][data-vana="V1"]')).toHaveAttribute('data-sk', 'false')
  await expect(page.locator('[data-testid="harita-vana-alt"][data-vana="V2"], [data-vana="V2"] [data-testid="harita-vana-alt"]')).toContainText('sistemi kontrol edin')
  await animasyonlarBitsin(page)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  // yanıt: damlatıcı tıkalıydı → Saha Defteri'ne düşer
  await v2.getByTestId('sk-yanit-damlatici_tikali').click()
  await expect(v2.getByTestId('sk-yanit-verildi')).toContainText('damlatıcı tıkalıydı')
  const kayit = (await (await page.request.get(`/api/gardens/${g.id}/saha-kayitlari`)).json()) as { kayitlar: { tur: string; ayrinti: Record<string, string> | null }[] }
  expect(kayit.kayitlar.some((k) => k.tur === 'gozlem' && k.ayrinti?.konu === 'sistem_kontrol' && k.ayrinti?.yanit === 'damlatici_tikali')).toBe(true)
  // bildirim merkezi: tek kayıt
  const bil = (await (await page.request.get('/api/notifications?tur=sulama_sistem_kontrol')).json()) as { toplam: number }
  expect(bil.toplam).toBe(1)
})

test('tek sektör: komşu halka normalken işaret orta-yüksek güvenle gelir; «sorun yoktu» işareti kapatır', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const g = await kur(page, 'SK Tek', 28.12, false)
  seedSistemKontrol(g.id, 'tek')
  await page.goto(yol(g.id))
  const satir = page.getByTestId('vana-satiri').first()
  await expect(satir.getByTestId('sistem-kontrol-guven')).toContainText('Güven: orta-yüksek', { timeout: 40_000 })
  await expect(satir.getByTestId('sistem-kontrol-guven')).toContainText('tek sektör')
  await expect(satir.getByTestId('sistem-kontrol-guven')).toContainText('komşu halka')
  await satir.getByTestId('sistem-kontrol-nasil').locator('summary').click()
  await expect(satir.getByTestId('sistem-kontrol-halka')).toContainText('100–300 m')
  await satir.getByTestId('sk-yanit-sorun_yok').click()
  await expect(page.getByTestId('sistem-kontrol')).toHaveCount(0, { timeout: 30_000 })
})
