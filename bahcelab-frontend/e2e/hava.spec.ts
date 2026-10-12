import { expect, test } from '@playwright/test'
import { createGarden, newUser } from './yardimcilar'

/** Open-Meteo'ya çıkılmaz: sunucu yanıtı sahte (yalnızca testte) ve sabit tarihli saatlik tahmin. */
function fakeWeather(today: string) {
  const hours = Array.from({ length: 24 }, (_, h) => ({
    zaman: `${today}T${String(h).padStart(2, '0')}:00`,
    sicaklik: 20,
    nem: 50,
    yagis: 0,
    yagis_olasiligi: 0,
    ruzgar: h === 10 ? 30 : 5,
    hamle: 10,
    et0: 0.1,
    kod: 0,
    ilaclama: h === 10 ? 'uygun_degil' : h === 12 ? 'sinirda' : 'uygun',
    gunduz: h >= 7 && h < 19,
    ilaclama_nedenleri: h === 10 ? ['Rüzgâr çok kuvvetli (30 km/s); ilaç sürüklenir.'] : ['Rüzgâr, yağış ve sıcaklık koşulları uygun.'],
  }))
  return {
    konum: { enlem: 38.9, boylam: 27.9 },
    guncelleme: new Date().toISOString(),
    onbellekten: false,
    kaynak: 'open-meteo',
    atif: 'Hava verisi: Open-Meteo.com (CC BY 4.0)',
    simdi: { zaman: `${today}T12:00`, sicaklik: 20, hissedilen: 19, nem: 50, yagis: 0, ruzgar: 5, hamle: 10, yon: 270, kod: 0, aciklama: 'Açık', ikon: 'gunes' },
    gunler: [
      {
        tarih: today,
        min: 12,
        max: 24,
        yagis_mm: 0,
        yagis_olasiligi: 0,
        ruzgar_max: 30,
        hamle_max: 40,
        et0_mm: 4,
        kod: 0,
        aciklama: 'Açık',
        ikon: 'gunes',
        gun_dogumu: '07:00',
        gun_batimi: '19:00',
        ilaclama: { uygun_saat: 23, sinirda_saat: 0, uygun_degil_saat: 1, en_iyi_aralik: ['13:00', '19:00'] },
      },
    ],
    saatlik: hours,
    uyarilar: [],
    su_dengesi: [{ gun: 7, yagis_mm: 0, et0_mm: 28, denge_mm: -28, eksik_gun: 0, aciklama: 'Son 7 günde su açığı 28 mm (yağış 0 mm, ET₀ 28 mm).' }],
    yagis_toplamlari: [{ etiket: 'Son 7 gün', gun: 7, mm: 0, gecen_yil_mm: 11 }],
  }
}

test('Hava sekmesi: etiketli yağış olasılığı, klavyeyle saat gezinme, su durumu ve atıf', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Hava Bahçesi', lng: 27.9, lat: 38.9 })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.route('**/api/gardens/*/weather', (route) => route.fulfill({ json: fakeWeather(today) }))

  await page.goto(`/bahceler/${garden.id}/hava`)
  await expect(page.getByTestId('best-spray')).toContainText('Bu hafta ilaçlama için en iyi zaman')
  await expect(page.getByTestId('best-spray-time')).toContainText('13:00–19:00')
  await expect(page.getByTestId('current-temp')).toContainText('20')
  await expect(page.getByTestId('daily-forecast')).toContainText('Olasılık %')
  await expect(page.getByTestId('daily-forecast')).toContainText('13:00–19:00')

  // Saatlik şerit: satıra odaklanıp ok tuşuyla saat seç
  const row = page.getByTestId('spray-row').first().getByRole('group')
  await row.focus()
  for (let i = 0; i < 11; i++) await row.press('ArrowRight')
  await expect(page.getByTestId('spray-info')).toContainText('Rüzgâr çok kuvvetli')

  // Gece saatleri soluk ve «gece» etiketli; üç durum desenle de ayrışır (renk körü dostu palet)
  const strip = page.getByTestId('spray-strip')
  await expect(strip.getByTestId('night-label').first()).toHaveText('gece')
  await expect(strip.locator('[data-night="true"]').first()).toHaveClass(/opacity-35/)
  await expect(strip.locator('[data-status="uygun"].spray-ok').first()).toBeVisible()
  await expect(strip.locator('[data-status="sinirda"].spray-edge').first()).toBeVisible()
  await expect(strip.locator('[data-status="uygun_degil"].spray-no').first()).toBeVisible()
  await expect(strip.getByRole('list').getByText('✓')).toBeVisible()

  await expect(page.getByTestId('water-balance')).toContainText('−28 mm')
  await expect(page.getByTestId('weather-attribution').getByRole('link', { name: 'Open-Meteo.com' })).toHaveAttribute('href', 'https://open-meteo.com/')
})

test('hava servisi hata verirse anlaşılır hata ve "Tekrar dene" gösterilir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Hata Bahçesi', lng: 27.95, lat: 38.95 })
  await page.route('**/api/gardens/*/weather', (route) => route.fulfill({ status: 503, json: { error: { code: 'INTERNAL_ERROR', message: 'Hava durumu şu an alınamıyor.' } } }))
  await page.goto(`/bahceler/${garden.id}/hava`)
  await expect(page.getByRole('heading', { name: 'Hava durumu alınamadı' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
})

test('Hava sekmesi: sulama ve zararlı riski kartları ön değer uyarısı ile gelir', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Risk Bahçesi', lng: 27.85, lat: 38.85 })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.route('**/api/gardens/*/weather', (route) => route.fulfill({ json: fakeWeather(today) }))

  await page.goto(`/bahceler/${garden.id}/hava`)
  const irrigation = page.getByTestId('irrigation-card')
  await expect(irrigation).toBeVisible()
  await expect(irrigation).toContainText('reçetesi değildir')
  await expect(irrigation.getByTestId('rule-badge').first()).toContainText(/ön değer/i)

  const risks = page.getByTestId('risks-card')
  await expect(risks).toBeVisible()
  await expect(risks.getByTestId('risk-row').first()).toHaveAttribute('data-level', /dusuk|orta|yuksek|yetersiz/)
  await expect(risks.getByTestId('rule-badge').first()).toContainText(/ön değer/i)
})
