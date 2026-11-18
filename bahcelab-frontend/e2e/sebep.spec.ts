import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, newUser, seedSebep } from './yardimcilar'

/** ADIM 10B Dilim 2: «Olası sebepler (kesin değil)» — Durum'daki bölge düşüşü maddesi, haritada olay kartı, Geçmiş'teki olay. GERÇEK arka uç + gerçek sebep motoru; S2 sahneleri/ERA5 SENTETİK test verisidir (yalnız tohum). */
async function axeTemiz(page: Page, etiket: string): Promise<void> {
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  const agir = sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(agir.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), etiket).toEqual([])
}

async function olayKimligi(page: Page, gardenId: string): Promise<string> {
  const r = await page.request.get(`/api/gardens/${gardenId}/olaylar`)
  expect(r.status()).toBe(200)
  const olay = ((await r.json()) as { olaylar: { id: string; turler: string[] }[] }).olaylar.find((o) => o.turler.includes('s2_dusus'))
  expect(olay).toBeTruthy()
  return olay!.id
}

test('Durum: bölge düşüşü maddesi → Olası sebepler (belirsiz, yüzde yok, kanıt satırı bağımsızlık etiketiyle, sahada kontrol, «sebep buydu»)', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Sebep Bahçesi', lng: 28.31, lat: 38.41, sideM: 200 })
  seedSebep(g.id, 'belirsiz')
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.goto(`/bahceler/${g.id}`)
  const madde = page.getByTestId('today-card').locator('[data-kind="olay"]')
  await expect(madde).toHaveCount(1, { timeout: 30_000 })
  await madde.getByTestId('today-sebep').locator('summary').click()
  const kart = madde.getByTestId('sebep-karti')
  await expect(kart).toBeVisible({ timeout: 20_000 })
  await expect(kart).toHaveAttribute('data-secim', 'belirsiz')
  await expect(kart.getByTestId('sebep-belirsiz')).toContainText('tek bir sebebi ayırt etmeye yetmiyor')
  await expect(kart.getByTestId('sebep-satiri')).toHaveCount(3)
  expect(await kart.innerText()).not.toMatch(/\d\s*%/) // yüzde yok
  // her sebepte lehte/aleyhte kanıt satırları + bağımsızlık etiketi
  const don = kart.locator('[data-testid="sebep-satiri"][data-sebep="don"]')
  await don.locator('summary').click()
  await expect(don.getByTestId('sebep-kanit').first()).toBeVisible()
  await expect(don.getByTestId('sebep-bagimsizlik').first()).toContainText(/bağımsız|bağımlı/)
  await expect(don.getByTestId('sebep-kanit').first()).toContainText('Pencerede hava hep')
  // sahada şunlara bakın: besin/hastalık/mekanik burada
  await kart.getByTestId('sebep-kontrol').locator('summary').click()
  for (const k of ['besin', 'hastalik', 'mekanik']) await expect(kart.locator(`[data-testid="sebep-kontrol-grup"][data-sebep="${k}"]`)).toBeVisible()
  await expect(kart.getByTestId('sebep-kontrol')).toContainText('SEÇİLMEZ')
  await axeTemiz(page, 'durum sebep kartı')
  // sebep buydu
  await kart.getByTestId('sebep-yanit-su').click()
  await expect(kart.getByTestId('sebep-yanit-su')).toHaveAttribute('aria-pressed', 'true')
  await expect(kart.getByRole('status').filter({ hasText: 'Saha Defteri' })).toContainText('yazıldı')
  await page.reload()
  await page.getByTestId('today-card').locator('[data-kind="olay"]').getByTestId('today-sebep').locator('summary').click()
  await expect(page.getByTestId('sebep-yanit-su')).toHaveAttribute('aria-pressed', 'true')
})

test('Geçmiş ve harita: olay ayrıntısında ve olay kartında aynı Olası sebepler kartı', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Sebep Geçmiş', lng: 28.33, lat: 38.43, sideM: 200 })
  seedSebep(g.id, 'belirsiz')
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  const olayId = await olayKimligi(page, g.id)
  await page.goto(`/bahceler/${g.id}/gecmis`)
  await page.locator('[data-testid="olay-satiri"][data-tur="s2_dusus"]').first().getByRole('button').first().click()
  const kart = page.getByTestId('olay-sebep').getByTestId('sebep-karti')
  await expect(kart).toBeVisible({ timeout: 20_000 })
  await expect(kart.getByRole('heading', { name: 'Olası sebepler (kesin değil)' })).toBeVisible()
  await axeTemiz(page, 'geçmiş sebep kartı')
  await page.goto(`/bahceler/${g.id}?olay=${olayId}`)
  await expect(page.getByTestId('olay-karti')).toBeVisible({ timeout: 40_000 })
  await page.getByTestId('olay-karti-sebep').locator('summary').click()
  await expect(page.getByTestId('olay-karti').getByTestId('sebep-karti')).toBeVisible({ timeout: 20_000 })
  await axeTemiz(page, 'harita olay kartı sebep')
})

test('Görüntü kapısı: kapı kapalıysa Durum\'da tek satır + beklenen geçiş, uyarı yok; olay ayrıntısında da tek satır', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Sebep Kapı', lng: 28.35, lat: 38.45, sideM: 200 })
  seedSebep(g.id, 'kapi')
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.goto(`/bahceler/${g.id}`)
  const madde = page.getByTestId('today-card').locator('[data-kind="olay"]')
  await expect(madde).toHaveCount(1, { timeout: 30_000 })
  await expect(madde).toContainText('Görüntü kaynaklı olabilir')
  await expect(madde).toContainText('bir sonraki net görüntüyü bekleyin')
  await expect(madde).toContainText(/Beklenen geçiş: \d{1,2} \S+ \(tahmini\)/)
  await expect(madde.getByTestId('today-sebep')).toHaveCount(0) // kapı devrede: yalnız tek satır
  await expect(madde.getByTestId('today-onem')).toHaveAttribute('data-onem', 'bilgi') // uyarı değil, bilgi
  await page.goto(`/bahceler/${g.id}/gecmis`)
  await page.locator('[data-testid="olay-satiri"][data-tur="s2_dusus"]').first().getByRole('button').first().click()
  const tek = page.getByTestId('olay-sebep').getByTestId('sebep-kapi')
  await expect(tek).toBeVisible({ timeout: 20_000 })
  await expect(tek).toContainText('Görüntü kaynaklı olabilir — bir sonraki net görüntüyü bekleyin')
  await expect(page.getByTestId('olay-sebep').getByTestId('sebep-satiri')).toHaveCount(0)
  await axeTemiz(page, 'görüntü kapısı')
})
