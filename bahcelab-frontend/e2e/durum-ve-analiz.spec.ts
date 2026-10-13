import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes, seedWeather } from './yardimcilar'

test.describe('Durum sekmesi (v2: kademe, 5 bileşen, sayı yok)', () => {
  test('kademe şeridi, beş bileşen çipi, risk satırı ve «Nasıl hesaplandı?» görünür; sayısal skor hiçbir yerde yok', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Kademe Bahçesi', lng: 27.9, lat: 38.9, sideM: 200 })
    seedScenes(garden.id)
    const apiBody = page.waitForResponse((r) => r.url().includes('/durum') && r.request().method() === 'GET')
    await page.goto(`/bahceler/${garden.id}`)
    const body = JSON.stringify(await (await apiBody).json())
    expect(body).not.toMatch(/"skor"|\/100|"puan"|"ic_puan"/) // API yanıtında iç puan yok

    const card = page.getByTestId('durum-karti')
    await expect(card).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('kademe-ad')).toHaveText(/İyi|İzle|Dikkat|Sorun/)
    await expect(page.getByTestId('kademe-seridi')).toBeVisible()
    await expect(card.getByTestId('durum-cip')).toHaveCount(5)
    for (const ad of ['Ağaç gücü', 'Su', 'Beslenme', 'Ani değişim', 'Isı']) await expect(card.locator('[data-testid="durum-cip"] b', { hasText: new RegExp(`^${ad}$`) })).toBeVisible()
    await expect(card.getByTestId('durum-risk-satiri')).toBeVisible()
    await expect(card).not.toContainText('/100')

    await card.getByText('Nasıl hesaplandı?').click()
    const nasil = page.getByTestId('nasil-hesaplandi')
    await expect(nasil).toContainText('ön değer · v2')
    expect(await nasil.getByTestId('nasil-cumleler').locator('li').count()).toBeLessThanOrEqual(3) // en çok 3 cümle
    await expect(page.getByTestId('kademe-nedeni')).not.toBeEmpty()
    await expect(page.getByTestId('sezon-egrisi')).toBeVisible()
  })

  test('çipe dokununca ilgili katman haritada, Su çipine dokununca Su sekmesi açılır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Çip Eylem', lng: 27.905, lat: 38.905, sideM: 200 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('durum-karti')).toBeVisible({ timeout: 30_000 })
    await page.locator('[data-testid="durum-cip"][data-kod="beslenme"]').click()
    await expect(page.getByTestId('katman-menusu')).toContainText('Klorofil')
    await page.locator('[data-testid="durum-cip"][data-kod="isi"]').click()
    await expect(page.getByTestId('katman-menusu')).toContainText('Yüzey sıcaklığı')
    await page.locator('[data-testid="durum-cip"][data-kod="agac_gucu"]').click()
    await expect(page.getByTestId('katman-menusu')).toContainText('Canlılık')
    await page.locator('[data-testid="durum-cip"][data-kod="su"]').click()
    await expect(page).toHaveURL(/\/su$/)
  })

  test('orta zararlı riski varken risk satırı riski adlandırır, kademe en fazla İzle olur ve neden açıklanır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Riskli Bahçe', lng: 27.97, lat: 38.97, sideM: 200 })
    // Arka uç sözleşmesi (pytest: test_medium_risk_caps_the_tier_at_izle_and_high_risk_at_dikkat) ile aynı yanıt biçimi
    await page.route('**/api/gardens/*/durum', (route) =>
      route.fulfill({
        json: {
          durum: 'izle', etiket: 'İzle', ozet: 'Bahçenizde takip edilmesi gereken bir değişim var.',
          bilesenler: [
            { kod: 'agac_gucu', ad: 'Ağaç gücü', seviye: 'normal', kullanilabilir: true, bayat: false, neden: 'Ağaç gücü, Ekim normali ile uyumlu.', veri_tarihi: '2026-10-09' },
            { kod: 'su', ad: 'Su', seviye: 'normal', kullanilabilir: true, bayat: false, neden: 'Su, Ekim normali ile uyumlu.', veri_tarihi: '2026-10-13' },
            { kod: 'beslenme', ad: 'Beslenme', seviye: 'normalin_ustu', kullanilabilir: true, bayat: false, neden: 'Beslenme, Ekim normalinin üstünde.', veri_tarihi: '2026-10-09' },
            { kod: 'ani_degisim', ad: 'Ani değişim', seviye: 'normal', kullanilabilir: true, bayat: false, neden: 'Son 30 günde ani değişim görülmedi.', veri_tarihi: '2026-10-09' },
            { kod: 'isi', ad: 'Isı', seviye: null, kullanilabilir: false, bayat: false, neden: 'Isı: Landsat geçişi yok.', veri_tarihi: null },
          ],
          riskler: ['Meyve sineği · orta'], guven: 'orta', guven_nedeni: 'Isı: Landsat geçişi yok.',
          nasil: ['Beş bileşen de kendi dönem normuna uygun. Aktif risk kademeyi ayrıca sınırlıyor.', 'Veri: son net görüntü 9 Ekim, toprak nemi 13 Ekim.', 'Güven orta; eşikler ön değer (v2).'],
          dusuren: [], risk_sinirladi: true, esik_durumu: 'ön değer · v2', hesaplama_tarihi: '2026-10-13',
        },
      }),
    )
    await page.goto(`/bahceler/${garden.id}`)
    const risk = page.getByTestId('durum-risk-satiri')
    await expect(risk).toContainText('Meyve sineği · orta')
    await expect(risk).toContainText('kademeyi sınırlıyor')
    await expect(risk).toHaveAttribute('data-risk', 'var')
    await expect(page.getByTestId('kademe-ad')).toContainText('İzle')
    await expect(page.locator('[data-testid="durum-cip"][data-kod="beslenme"]')).toHaveAttribute('data-seviye', 'normalin_ustu')
    await expect(page.locator('[data-testid="durum-cip"][data-kod="isi"]')).toContainText('veri yok')
    await page.getByText('Nasıl hesaplandı?').click()
    await expect(page.getByTestId('kademe-nedeni')).toContainText('kademeyi ayrıca sınırlıyor')
  })

  test('GERÇEK ARKA UÇ (mock yok): kayıtlı hava verisi + örnek uydu serisiyle risk satırı riski adlandırır, kademe İyi olmaz', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Gerçek Arka Uç', lng: 27.971, lat: 38.971, sideM: 200 })
    seedScenes(garden.id) // gerçek işleme hattından geçen örnek uydu serisi
    seedWeather(garden.id) // gerçek hava servisi + risk motoru, kayıtlı örnek veriyle (ağsız)
    const yanit = page.waitForResponse((r) => r.url().includes('/durum') && r.request().method() === 'GET')
    await page.goto(`/bahceler/${garden.id}`)
    const api = (await (await yanit).json()) as { riskler: string[]; durum: string; bilesenler: { kod: string }[] }
    expect(api.riskler.length, 'kayıtlı hava verisinde aktif risk beklenir').toBeGreaterThan(0)
    expect(['izle', 'dikkat', 'sorun']).toContain(api.durum) // aktif risk varken «İyi» olamaz
    if (api.riskler.some((r) => r.includes('yüksek'))) expect(['dikkat', 'sorun']).toContain(api.durum)
    const risk = page.getByTestId('durum-risk-satiri')
    await expect(risk).toContainText(/meyve sineği|örümcek|kuruma/i, { timeout: 30_000 })
    await expect(risk).toContainText(/orta|yüksek/)
    await expect(page.getByTestId('kademe-ad')).not.toContainText('İyi')
  })

  test('GERÇEK ARKA UÇ: ağaç gücü ve beslenme çipi, gösterge çubuğuyla AYNI bant kuralından etiket alır; sezon eğrisi bantları ve evreleri çizer', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Tutarlılık', lng: 27.973, lat: 38.973, sideM: 200 })
    seedScenes(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('gosterge-cubuklari')).toBeVisible({ timeout: 30_000 })
    const KONUM_SEVIYE: Record<string, string[]> = { ust: ['normalin_ustu', 'belirgin_yuksek', 'normal'], normal: ['normal'], alt: ['normalin_alti'], en_dusuk: ['belirgin_dusuk'] }
    for (const [cip, gosterge] of [['agac_gucu', 'ndvi'], ['beslenme', 'ndre']] as const) {
      const konum = await page.locator(`[data-testid="gosterge-satiri"][data-gosterge="${gosterge}"]`).getAttribute('data-konum')
      expect(konum, `${gosterge} bandı yeterli olmalı`).not.toBe('yetersiz')
      const seviye = await page.locator(`[data-testid="durum-cip"][data-kod="${cip}"]`).getAttribute('data-seviye')
      expect(KONUM_SEVIYE[konum ?? ''], `${cip}: çubuk konumu ${konum}, çip ${seviye}`).toContain(seviye)
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

  test('GERÇEK ARKA UÇ: görüntüsü olmayan bahçede risk satırı yalnız riskten gelir (kademe riskten, bileşenler «veri yok»)', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Yalnız Risk', lng: 27.974, lat: 38.974, sideM: 200 })
    seedWeather(garden.id)
    await page.goto(`/bahceler/${garden.id}`)
    const risk = page.getByTestId('durum-risk-satiri')
    await expect(risk).toContainText(/orta|yüksek/, { timeout: 30_000 })
    await expect(risk).toContainText(/meyve sineği|örümcek|kuruma/i)
    await expect(risk).not.toContainText('görünmüyor')
    await expect(page.locator('[data-testid="durum-cip"][data-kod="agac_gucu"]')).toContainText('veri yok')
  })

  test('görüntüsü olmayan bahçede bileşenler «veri yok» der; kademe yoksa «Veri yetersiz», yalnız canlı hava riski varsa riskten gelir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Boş Durum', lng: 27.91, lat: 38.91 })
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('durum-karti')).toBeVisible({ timeout: 30_000 })
    for (const kod of ['agac_gucu', 'beslenme', 'isi']) await expect(page.locator(`[data-testid="durum-cip"][data-kod="${kod}"]`)).toContainText('veri yok')
    const risk = await page.getByTestId('durum-risk-satiri').getAttribute('data-risk')
    if (risk === 'yok') {
      await expect(page.getByTestId('kademe-ad')).toHaveText('Veri yetersiz')
      await expect(page.getByTestId('durum-ozet')).toContainText('yeterli veri yok')
    } else {
      await expect(page.getByTestId('kademe-ad')).toHaveText(/İzle|Dikkat/) // uydu verisi yok ama canlı hava riski var: kademe riskten
    }
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
