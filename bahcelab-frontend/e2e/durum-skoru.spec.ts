import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Sezon serisi sahte yanıtı (yalnızca testte): ağa çıkılmaz, günlük basit artan değerler. */
function fakeSeries(sezon: number) {
  const start = new Date(Date.UTC(sezon, 9, 1))
  const end = new Date(Math.min(Date.UTC(sezon + 1, 8, 30), Date.now() - 86_400_000))
  const days = []
  let rain = 0
  let gdd = 0
  for (let t = start.getTime(), i = 0; t <= end.getTime(); t += 86_400_000, i++) {
    rain += i % 7 === 0 ? 4 : 0.2
    gdd += 3
    days.push({
      tarih: iso(new Date(t)), tmin: 10, tmax: 22, yagis_mm: 0.2, yagis_birikimli_mm: Math.round(rain * 10) / 10, onceki_yagis_birikimli_mm: Math.round(rain * 0.8 * 10) / 10,
      gdd: 3, gdd_birikimli: gdd, onceki_gdd_birikimli: gdd * 0.9,
    })
  }
  const last = days[days.length - 1]
  return {
    sezon, sezon_baslangici: `${sezon}-10-01`, sezon_bitisi: `${sezon + 1}-09-30`, gdd_taban_c: 12.5,
    gdd_kural: { durum: 'dogrulanmadi', kaynak: 'Test kaynağı', onaylayan: null, onay_tarihi: null },
    gunler: days,
    ozet: { son_gun: last.tarih, yagis_birikimli_mm: last.yagis_birikimli_mm, onceki_ayni_gun_yagis_mm: last.onceki_yagis_birikimli_mm, gdd_birikimli: last.gdd_birikimli, onceki_ayni_gun_gdd: last.onceki_gdd_birikimli },
    eksik_gun: 0, onceki_sezon_var: true, notlar: [],
  }
}

async function mockSeries(page: Page) {
  await page.route('**/api/gardens/*/agro/seriler*', async (route) => {
    const sezon = Number(new URL(route.request().url()).searchParams.get('sezon'))
    await route.fulfill({ json: fakeSeries(sezon) })
  })
}

test('skor kartı: sayı, etiket, tek cümle, güven ve «Neden bu skor?» dökümü; Bugün kartı bağlantılı', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Skor Bahçesi', lng: 27.9, lat: 38.9, sideM: 200 })
  seedScenes(garden.id)
  await mockSeries(page)
  await page.goto(`/bahcem/${garden.id}/durum`)

  const card = page.getByTestId('score-card')
  await expect(card).toBeVisible({ timeout: 30_000 })
  const value = Number(await page.getByTestId('score-value').innerText())
  expect(value).toBeGreaterThanOrEqual(0)
  expect(value).toBeLessThanOrEqual(100)
  await expect(page.getByTestId('score-summary')).not.toBeEmpty()
  await expect(page.getByTestId('score-trust')).toContainText(/görüntü/)

  await expect(page.getByTestId('score-breakdown')).toHaveCount(0)
  await page.getByRole('button', { name: 'Neden bu skor?' }).click()
  await expect(page.getByTestId('score-component')).toHaveCount(4)
  await expect(page.getByTestId('score-component').first()).toContainText('Canlılık')
  await page.getByRole('button', { name: 'Neden bu skor?' }).click()
  await expect(page.getByTestId('score-breakdown')).toHaveCount(0)

  const today = page.getByTestId('today-card')
  await expect(today).toBeVisible()
  expect(await today.getByTestId('today-item').count()).toBeLessThanOrEqual(3)
  await expect(today.getByTestId('today-item').first()).toBeVisible()
  // Liste kartındaki etiket ve skor aynı kaynaktan
  await page.getByRole('link', { name: 'Bahçelerim' }).click()
  await expect(page.getByTestId('garden-card').getByTestId('badge-score')).toBeVisible()
})

test('görüntü yoksa skor yerine «Veri yetersiz» ve nedeni gösterilir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Boş Skor', lng: 27.91, lat: 38.91 })
  await page.goto(`/bahcem/${garden.id}/durum`)
  await expect(page.getByTestId('score-insufficient')).toHaveText('Veri yetersiz')
  await expect(page.getByTestId('score-reason')).toContainText('net uydu görüntüsü')
  await expect(page.getByTestId('score-value')).toHaveCount(0)
})

test('üç grafik aynı zaman ekseninde, imleç senkron; dönem seçici ve fenoloji bantları', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Grafik Bahçesi', lng: 27.92, lat: 38.92, sideM: 200 })
  seedScenes(garden.id)
  await mockSeries(page)
  await page.goto(`/bahcem/${garden.id}/durum`)

  for (const id of ['time-chart', 'rain-chart', 'gdd-chart']) await expect(page.getByTestId(id)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('chart-title')).toContainText('zaman grafiği')
  await expect(page.getByTestId('rain-chart-summary')).toContainText('mm')
  await expect(page.getByTestId('gdd-chart-summary')).toContainText('geçen sezon aynı gün')

  // Fenoloji bantları ve doğrulanmamış rozeti
  expect(await page.getByTestId('phenology-band').count()).toBeGreaterThan(5)
  await expect(page.getByTestId('rule-badge').first()).toContainText('ziraat mühendisi onayı bekleniyor')

  // Senkron imleç: GDD grafiği üzerinde gezinirken yağış grafiğinde de ipucu görünür
  const gdd = page.getByTestId('gdd-chart').locator('svg').first()
  await gdd.scrollIntoViewIfNeeded()
  const box = await gdd.boundingBox()
  if (!box) throw new Error('GDD grafiği yok')
  // Sezonun ilk günleri (veri olan kısım): eksen 1 Ekim'de başlar, bugün 11 Ekim civarındadır
  await page.mouse.move(box.x + 48 + 0.014 * (box.width - 48 - 52), box.y + 60)
  await expect(page.getByTestId('rain-chart').getByTestId('chart-tooltip')).toBeVisible()
  await expect(page.getByTestId('gdd-chart').getByTestId('chart-tooltip')).toBeVisible()

  // Dönem: geçen sezon ve özel aralık
  const before = await page.getByTestId('period-label').innerText()
  await page.getByRole('radio', { name: 'Geçen sezon' }).click()
  await expect(page.getByTestId('period-label')).not.toHaveText(before)
  await page.getByRole('radio', { name: 'Özel aralık' }).click()
  await expect(page.getByLabel('Başlangıç', { exact: true }).first()).toBeVisible()
})

test('evre tarihi bahçe için düzeltilir ve katalog değerine döndürülür', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Evre Bahçesi', lng: 27.93, lat: 38.93, sideM: 200 })
  seedScenes(garden.id)
  await mockSeries(page)
  await page.goto(`/bahcem/${garden.id}/durum`)
  await page.getByRole('button', { name: 'Evre tarihlerini düzenle' }).click({ timeout: 30_000 })
  const row = page.getByTestId('stage-row').filter({ hasText: 'Çiçeklenme' })
  await row.getByLabel('Bitiş').fill('2027-05-10')
  await row.getByRole('button', { name: 'Kaydet' }).click()
  await expect(row.getByText('bahçe düzeltmesi')).toBeVisible()
  await row.getByRole('button', { name: 'Katalog değerine dön' }).click()
  await expect(page.getByTestId('stage-row').filter({ hasText: 'Çiçeklenme' }).getByText('bahçe düzeltmesi')).toHaveCount(0)
})
