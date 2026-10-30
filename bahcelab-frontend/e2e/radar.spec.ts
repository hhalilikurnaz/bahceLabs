import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedRadar, seedScenes } from './yardimcilar'

/** Radar (Sentinel-1) dilimi, GERÇEK arka uçla: sahte radar sağlayıcısı + gerçek doldurma hattı. «Radar nemi» hiçbir yerde geçmez. */
async function kurulum(page: Page, ad: string, lng: number, options: { eskiOptik?: boolean; bulutlu?: boolean } = {}) {
  await newUser(page)
  const garden = await createGarden(page.request, { ad, lng, lat: 38.8, sideM: 200 })
  seedScenes(garden.id)
  seedRadar(garden.id, options)
  return garden
}

async function katmanSec(page: Page, id: string) {
  await page.getByTestId('katman-menusu').getByRole('button').first().click()
  await page.getByTestId(`katman-${id}`).click()
}

test('katman menüsünde «Radar · bulut geçirmez» grubu; Radar (VH) lejantı, yörünge bilgisi ve yalnız radar tarihlerinde gezinme', async ({ page }) => {
  const g = await kurulum(page, 'Radar Katman', 27.51)
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('katman-menusu').getByRole('button').first().click()
  await expect(page.getByRole('listbox', { name: 'Katmanlar' })).toContainText('Radar · bulut geçirmez')
  await expect(page.getByTestId('katman-radarVh')).toContainText('Radar (VH)')
  await expect(page.getByTestId('katman-radarDegisim')).toContainText('Radar değişimi')
  await page.getByTestId('katman-radarVh').click()
  const lejant = page.getByTestId('histogram-lejant')
  await expect(lejant).toContainText('Radar (VH) · dB', { timeout: 30_000 })
  await expect(lejant).toContainText('zayıf yansıma → güçlü yansıma')
  const kutu = page.getByTestId('tarih-kutusu')
  await expect(page.getByTestId('radar-yorunge')).toContainText(/yörünge 167 · iniş/)
  const ilk = await page.getByTestId('secili-tarih').textContent()
  await page.getByRole('button', { name: 'Önceki görüntü' }).click()
  await expect(page.getByTestId('secili-tarih')).not.toHaveText(ilk ?? '')
  await expect(kutu).toContainText('yörünge 167')
  await expect(page.locator('body')).not.toContainText(/radar nemi/i)
})

test('Radar değişimi: iki yönlü skala, lejant «azalma → artış» ve nokta incelemede VH dB + mini seri', async ({ page }) => {
  const g = await kurulum(page, 'Radar Değişim', 27.52)
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
  await katmanSec(page, 'radarDegisim')
  await expect(page.getByTestId('histogram-lejant')).toContainText('Radar değişimi · dB', { timeout: 30_000 })
  await expect(page.getByTestId('histogram-lejant')).toContainText('azalma → artış')
  await katmanSec(page, 'radarVh')
  await expect(page.getByTestId('histogram-lejant')).toContainText('Radar (VH) · dB', { timeout: 30_000 })
  const kutu = await page.getByTestId('harita-paneli').boundingBox()
  if (!kutu) throw new Error('harita yok')
  await page.mouse.click(kutu.x + kutu.width * 0.45, kutu.y + kutu.height * 0.55)
  const nokta = page.getByRole('dialog', { name: 'Nokta incelemesi' })
  await expect(nokta).toBeVisible()
  await expect(nokta).toContainText('dB')
  await expect(nokta.getByTestId('radar-mini-seri')).toBeVisible({ timeout: 15_000 })
  await expect(nokta).toContainText('yörünge 167 · iniş')
})

test('Su sekmesi: «Bulut altında görüş» şeridi bulgu cümlesi, optik/radar satırları, bulutlu bant ve RVI çizgisi', async ({ page }) => {
  const g = await kurulum(page, 'Radar Şerit', 27.53, { bulutlu: true })
  await page.goto(`/bahceler/${g.id}/su`)
  await page.locator('summary', { hasText: 'Bulut altında görüş' }).click()
  const bolum = page.getByTestId('bulut-altinda-gorus')
  await expect(bolum).toBeVisible({ timeout: 30_000 })
  await expect(bolum.getByTestId('radar-bulgu')).toContainText(/Son 90 günde optik uydu 4 kez göremedi; radar bu sürede \d+ kez gördü/)
  await expect(bolum.getByTestId('radar-bulgu')).toContainText('olay adayı') // son iki ardışık düşüş
  expect(await bolum.getByTestId('optik-bulutlu').count()).toBe(4)
  expect(await bolum.getByTestId('optik-net').count()).toBeGreaterThan(5)
  expect(await bolum.getByTestId('radar-gecis').count()).toBeGreaterThan(20)
  await expect(bolum.locator('[data-testid="radar-gecis"][data-aday="evet"]')).toHaveCount(2) // son iki ardışık geçiş
  expect(await bolum.getByTestId('bulutlu-bant').count()).toBeGreaterThanOrEqual(2)
  await expect(bolum.getByTestId('rvi-cizgi')).toBeVisible()
  await expect(page.getByTestId('bos-su')).toContainText('Sulama planı yakında')
  await expect(page.locator('body')).not.toContainText(/radar nemi/i)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('Durum: son optik görüntü 10 günden eskiyse tek satır radarın son geçişini ve değişim durumunu söyler; kademe değişmez', async ({ page }) => {
  const g = await kurulum(page, 'Radar Eski Optik', 27.54, { eskiOptik: true })
  await page.goto(`/bahceler/${g.id}`)
  const satir = page.getByTestId('eski-optik-satiri')
  await expect(satir).toBeVisible({ timeout: 30_000 })
  await expect(satir).toContainText(/Son optik görüntü \d+ gün önce · radar \d+ \p{L}+: /u)
  await expect(satir).toContainText(/olay adayı|anlamlı değişim yok/)
  await expect(page.getByTestId('kademe-ad')).toHaveText(/İyi|İzle|Dikkat|Sorun|Veri yetersiz/)
})

test('taze optik görüntü varken Durum üstünde eski optik satırı yoktur', async ({ page }) => {
  const g = await kurulum(page, 'Radar Taze Optik', 27.55)
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('durum-karti')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('eski-optik-satiri')).toHaveCount(0)
})
