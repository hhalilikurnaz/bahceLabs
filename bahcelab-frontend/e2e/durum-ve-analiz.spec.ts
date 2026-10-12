import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes, seedWeather } from './yardimcilar'

test.describe('Durum sekmesi (kademe, sayı yok)', () => {
  test('kademe şeridi, üç çip ve «Nasıl hesaplandı?» görünür; sayısal skor hiçbir yerde yok', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Kademe Bahçesi', lng: 27.9, lat: 38.9, sideM: 200 })
    seedScenes(garden.id)
    const apiBody = page.waitForResponse((r) => r.url().includes('/durum') && r.request().method() === 'GET')
    await page.goto(`/bahceler/${garden.id}`)
    const body = JSON.stringify(await (await apiBody).json())
    expect(body).not.toMatch(/"skor"|\/100|"puan"/) // API yanıtında iç skor yok

    const card = page.getByTestId('durum-karti')
    await expect(card).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('kademe-ad')).toHaveText(/İyi|İzle|Dikkat|Sorun/)
    await expect(page.getByTestId('kademe-seridi')).toBeVisible()
    await expect(card.getByTestId('durum-cip')).toHaveCount(3)
    await expect(card).toContainText('Ağaç gücü (NDVI)')
    await expect(card).toContainText('Su (NDMI)')
    await expect(card).not.toContainText('/100')

    await card.getByText('Nasıl hesaplandı?').click()
    const nasil = page.getByTestId('nasil-hesaplandi')
    await expect(nasil).toContainText('ön değer · v1')
    await expect(nasil).toContainText('9F')
    await expect(nasil).toContainText(/bandı: \d+ yıl/) // güven, bant diliyle (ör. «Ekim bandı: 9 yıl, 2017–2025»)
    expect((await nasil.locator('li, p').count()) <= 4).toBe(true)
    await expect(page.getByTestId('kademe-nedeni')).not.toBeEmpty()
    await expect(page.getByTestId('sezon-egrisi')).toBeVisible()
  })

  test('orta zararlı riski varken Risk çipi riski adlandırır, kademe en fazla İzle olur ve neden açıklanır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Riskli Bahçe', lng: 27.97, lat: 38.97, sideM: 200 })
    // Arka uç sözleşmesi (pytest: test_medium_pest_risk_on_the_weather_tab_caps_the_tier_and_is_named) ile aynı yanıt biçimi
    await page.route('**/api/gardens/*/durum', (route) =>
      route.fulfill({
        json: {
          durum: 'izle', etiket: 'İzle', ozet: 'Bahçenizde takip edilmesi gereken bir değişim var.', veri_yeterli: true, veri_yetersiz_nedeni: null,
          cipler: [
            { kod: 'agac_gucu', ad: 'Ağaç gücü (NDVI)', seviye: 'normal', aciklama: 'Canlılık, bu dönemin kendi normu ile uyumlu.' },
            { kod: 'su', ad: 'Su (NDMI)', seviye: 'normal', aciklama: 'Yaprak suyu, bu dönemin kendi normu ile uyumlu.' },
            { kod: 'risk', ad: 'Risk', seviye: 'normalin_alti', etiket: 'orta', aciklama: 'Zararlı/hastalık risk tahmini: Meyve sineği · orta (teşhis değil, risk tahmini).' },
          ],
          nasil: {
            veri: ['Canlılık (NDVI) · Sentinel-2 10 m'], son_goruntu_tarihi: '2026-10-09',
            guven: { seviye: 'yuksek', aciklama: 'Geçen yılla karşılaştırıldı.', gecmis_gun: 300, son_goruntu_yasi_gun: 3 },
            cumleler: ['Risk orta düzeyde: Meyve sineği · orta. Bu yüzden kademe en fazla İzle.', 'Ekim bandı: 9 yıl, 2017–2025.', 'Son net görüntü 9 Eki; eşikler ön değer (v1).'],
            dusuren_bilesen: 'risk', kademe_nedeni: 'Risk normalin altı: Zararlı/hastalık risk tahmini: Meyve sineği · orta. Bu yüzden kademe İzle. Aktif risk (Meyve sineği · orta) olduğu için kademe en fazla İzle olabilir.',
            esik_durumu: 'ön değer · v1', formul_notu: 'v1: tam formül 9F’de.',
          },
          hesaplama_tarihi: '2026-10-12',
        },
      }),
    )
    await page.goto(`/bahceler/${garden.id}`)
    const risk = page.locator('[data-testid="durum-cip"][data-kod="risk"]')
    await expect(risk).toContainText('Meyve sineği · orta')
    await expect(risk).toHaveAttribute('data-seviye', 'normalin_alti')
    await expect(risk).toContainText('orta') // çip seviyeyi yazar: «orta» / «yüksek»
    await expect(risk).not.toContainText('normalin altı')
    await expect(page.getByTestId('kademe-ad')).toContainText('İzle')
    await page.getByText('Nasıl hesaplandı?').click()
    await expect(page.getByTestId('kademe-nedeni')).toContainText('Meyve sineği · orta')
    await expect(page.getByTestId('kademe-nedeni')).toContainText('en fazla İzle')
  })

  test('GERÇEK ARKA UÇ (mock yok): kayıtlı hava verisi + örnek uydu serisiyle Risk çipi riski adlandırır, kademe en fazla İzle', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Gerçek Arka Uç', lng: 27.971, lat: 38.971, sideM: 200 })
    seedScenes(garden.id) // gerçek işleme hattından geçen örnek uydu serisi
    seedWeather(garden.id) // gerçek hava servisi + risk motoru, kayıtlı örnek veriyle (ağsız)
    const yanit = page.waitForResponse((r) => r.url().includes('/durum') && r.request().method() === 'GET')
    await page.goto(`/bahceler/${garden.id}`)
    const api = (await (await yanit).json()) as { cipler: { kod: string; etiket: string | null; seviye: string }[]; durum: string }
    const riskCip = api.cipler.find((c) => c.kod === 'risk')
    expect(riskCip?.etiket, 'kayıtlı hava verisinde aktif risk beklenir').toMatch(/orta|yüksek/)
    expect(['izle', 'dikkat', 'sorun']).toContain(api.durum) // aktif risk varken «İyi» olamaz
    if (riskCip?.etiket === 'yüksek') expect(['dikkat', 'sorun']).toContain(api.durum) // yüksek risk: en fazla Dikkat

    const risk = page.locator('[data-testid="durum-cip"][data-kod="risk"]')
    await expect(risk).toContainText(/Meyve sineği|örümcek|Kuruma/)
    await expect(risk).toContainText(riskCip?.etiket ?? '')
    await expect(page.getByTestId('kademe-ad')).not.toContainText('İyi')
    await page.getByText('Nasıl hesaplandı?').click()
    await expect(page.getByTestId('kademe-nedeni')).toContainText(/Bu yüzden kademe|en fazla/)
  })

  test('GERÇEK ARKA UÇ: çip ve çubuk aynı bant kuralıyla aynı etiketi verir; sezon eğrisi bantları, evreleri ve ortanca etiketini çizer', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Tutarlılık', lng: 27.973, lat: 38.973, sideM: 200 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('gosterge-cubuklari')).toBeVisible({ timeout: 30_000 })
    const KONUM_SEVIYE: Record<string, string> = { ust: 'normal', normal: 'normal', alt: 'normalin_alti', en_dusuk: 'belirgin_dusuk' }
    for (const [cip, gosterge] of [['agac_gucu', 'ndvi'], ['su', 'ndmi']] as const) {
      const konum = await page.locator(`[data-testid="gosterge-satiri"][data-gosterge="${gosterge}"]`).getAttribute('data-konum')
      expect(konum, `${gosterge} bandı yeterli olmalı`).not.toBe('yetersiz')
      await expect(page.locator(`[data-testid="durum-cip"][data-kod="${cip}"]`)).toHaveAttribute('data-seviye', KONUM_SEVIYE[konum ?? ''])
    }
    // Sezon eğrisi: iki bant, tüm evreler, tek ay etiketi, soluk ortanca etiketi
    const sezon = page.getByTestId('sezon-egrisi')
    await sezon.scrollIntoViewIfNeeded()
    await expect(sezon.getByTestId('band-p25-p75')).toHaveCount(1)
    await expect(sezon.getByTestId('band-p10-p90')).toHaveCount(1)
    await expect(sezon.getByTestId('band-ortanca-etiket')).toHaveText('geçmiş yılların ortancası')
    expect(await sezon.getByTestId('fenoloji-evre').count()).toBeGreaterThanOrEqual(6)
    expect(await sezon.getByTestId('fenoloji-etiket').count()).toBeGreaterThanOrEqual(5)
    await expect(sezon.locator('svg text', { hasText: /^Oca$/ })).toHaveCount(0) // ay etiketi yalnız «aya git» eksen satırında
    await expect(sezon.getByTestId('ay-1')).toHaveCount(1)
    // Taç ve toprak lejantı notu
    await page.getByTestId('katman-menusu').getByRole('button').first().click()
    await page.getByTestId('katman-tacToprak').click()
    await expect(page.getByTestId('lejant-not')).toContainText('Daire = 10 m piksel, ağaç konumu değil')
  })

  test('GERÇEK ARKA UÇ: görüntüsü olmayan bahçede risk çipinin etiketi ile açıklaması aynı riskten gelir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Yalnız Risk', lng: 27.974, lat: 38.974, sideM: 200 })
    seedWeather(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    const risk = page.locator('[data-testid="durum-cip"][data-kod="risk"]')
    await expect(risk).toContainText(/orta|yüksek/, { timeout: 30_000 })
    await expect(risk).toContainText(/Meyve sineği|örümcek|Kuruma/)
    await expect(risk).not.toContainText('görünmüyor')
  })

  test('görüntüsü olmayan bahçede «Veri yetersiz» ve nedeni gösterilir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Boş Durum', lng: 27.91, lat: 38.91 })
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('kademe-ad')).toHaveText('Veri yetersiz')
    await expect(page.getByTestId('durum-ozet')).toContainText('net uydu görüntüsü')
  })
})

const yil = (y: number, o: Record<string, unknown> = {}) => ({
  yil: y, sahne_sayisi: 12, kismi: false, kapsam: 1, korelasyon: 0.8, uyumsuz: false, uyumsuz_nedeni: null, dahil: true, elle: null,
  karar_bekliyor: false, varsayilan_dahil: true, karar_zamani: null, karar_notu: null, yetersiz_veri: false, yetersiz_nedeni: null, net_gun_sayisi: 12, yil_net_sahne: 22, yil_bulutlu: 6, donem_kapsami: 0.92, aday_sayisi: 20, ...o,
})
const bolge = (sinif: number, ad: string, extra: Record<string, unknown> = {}) => ({ sinif, ad, alan_m2: 3000 * sinif, alan_dekar: 3 * sinif, pay: sinif / 6, fark_yuzde: (sinif - 2) * 10, istikrar: 0.8, istikrar_sinifi: 'yuksek', kontrol_onerisi: false, ...extra })

test.describe('Analiz sekmesi', () => {
  test('bulgu cümlesi, bölge tablosu, uyumsuz yıl sorusu (karar ve geri al), yetersiz yıl sorulmaz', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Analiz Bahçesi', lng: 27.92, lat: 38.92 })
    const state = { karar: null as boolean | null, not: null as string | null }
    const result = () => ({
      durum: 'hazir', mesaj: null, bolge_sayisi: 3, versiyon: 1, hesaplama: '2026-10-12T10:00:00Z', yil_araligi: '2017–2026',
      yillar: [
        yil(2015, { sahne_sayisi: 4, kismi: true, yetersiz_veri: true, yetersiz_nedeni: 'Yetersiz veri: 4 net sahne', dahil: false, donem_kapsami: 0.31 }),
        yil(2017), yil(2018),
        yil(2021, { uyumsuz: true, uyumsuz_nedeni: 'uyumsuz', korelasyon: 0.4, karar_bekliyor: state.karar === null, elle: state.karar, dahil: state.karar ?? false, varsayilan_dahil: false, karar_zamani: state.karar === null ? null : '2026-10-12T10:05:00Z', karar_notu: state.not }),
      ],
      bolgeler: { type: 'FeatureCollection', features: [] },
      ozet: [bolge(1, 'Zayıf', { kontrol_onerisi: true }), bolge(2, 'Orta'), bolge(3, 'Güçlü')],
      homojen: false, yayilim_yuzde: 20, yorumlar: ['Güneybatı kesim yıllardır zayıf kalıyor; yerinde kontrol edin.', 'Kuzey kesim yıllardır bahçenin en güçlü kısmı.'], not_: 'Bölgeler ağaç gücünü gösterir.',
    })
    await page.route('**/bolgeler/cok-yillik/sonuc*', (route) => route.fulfill({ json: result() }))
    await page.route('**/bolgeler/cok-yillik/yillar', async (route) => {
      const secim = (route.request().postDataJSON() as { yillar: { dahil: boolean | null; olay_notu?: string }[] }).yillar[0]
      state.karar = secim.dahil
      if (secim.olay_notu !== undefined) state.not = secim.olay_notu || null
      if (secim.dahil === null) state.not = null
      await route.fulfill({ json: result() })
    })
    await page.goto(`/bahceler/${garden.id}/analiz`)

    await expect(page.getByTestId('analiz-bulgu')).toHaveText('Güneybatı kesim yıllardır zayıf kalıyor; yerinde kontrol edin.')
    const rows = page.getByTestId('bolge-satiri')
    await expect(rows).toHaveCount(3)
    await expect(rows.first()).toContainText('Güçlü') // güçlüden zayıfa
    await expect(page.getByTestId('bolge-tablosu')).toContainText('yerinde kontrol edin')

    // yalnız uyumsuz yıl için soru; yetersiz yıl (2015) sorulmaz ama tabloda «yetersiz veri · kısmi yıl» olarak görünür
    const sorular = page.getByTestId('yil-sorusu')
    await expect(sorular).toHaveCount(1)
    await expect(sorular).toContainText('2021')
    await page.getByTestId('yil-tablosu').getByText(/Yıl yıl veri/).click()
    const y2015 = page.locator('[data-testid="yil-satiri"][data-yil="2015"]')
    await expect(y2015).toContainText('kısmi yıl')
    await expect(y2015).toContainText('yetersiz veri')

    // Yıl zaten analiz dışında: «Hariç tut» yok; mevcut durum yazılı + tek değiştirme eylemi
    await expect(sorular.getByTestId('yil-durumu')).toHaveText('analiz dışında')
    await expect(sorular.getByRole('button', { name: 'Hariç tut' })).toHaveCount(0)
    await sorular.getByTestId('yil-degistir').click()
    await expect(sorular.getByTestId('yil-durumu')).toHaveText('analizde')
    await expect(sorular.getByTestId('yil-degistir')).toHaveText('Analizden çıkar')

    // isteğe bağlı olay notu
    await sorular.getByRole('button', { name: 'Olay notu ekle' }).click()
    await sorular.getByLabel('2021 olay notu').fill('Mart’ta sel')
    await sorular.getByRole('button', { name: 'Kaydet' }).click()
    await expect(sorular.getByTestId('yil-notu')).toContainText('Mart’ta sel')

    await sorular.getByRole('button', { name: 'Geri al' }).click()
    await expect(sorular.getByTestId('yil-durumu')).toHaveText('analiz dışında')

    await expect(page.getByTestId('tum-yillar')).toContainText('4 yılın tamamı')
    await page.getByTestId('tum-yillar').click()
    await expect(page).toHaveURL(/\/gecmis$/)
  })

  test('analiz yoksa başlatma daveti gösterilir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Analiz Yok', lng: 27.93, lat: 38.93 })
    await page.goto(`/bahceler/${garden.id}/analiz`)
    await expect(page.getByTestId('analiz-yok')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analizi başlat' })).toBeVisible()
  })
})
