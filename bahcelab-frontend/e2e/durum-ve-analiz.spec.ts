import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

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
    await expect(nasil).toContainText('Sentinel-2')
    await expect(page.getByTestId('kademe-nedeni')).not.toBeEmpty()
    await expect(page.getByTestId('sezon-bandi-bos')).toContainText('9C')
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
  karar_bekliyor: false, varsayilan_dahil: true, karar_zamani: null, yetersiz_veri: false, yetersiz_nedeni: null, net_gun_sayisi: 12, donem_kapsami: 0.92, aday_sayisi: 20, ...o,
})
const bolge = (sinif: number, ad: string, extra: Record<string, unknown> = {}) => ({ sinif, ad, alan_m2: 3000 * sinif, alan_dekar: 3 * sinif, pay: sinif / 6, fark_yuzde: (sinif - 2) * 10, istikrar: 0.8, istikrar_sinifi: 'yuksek', kontrol_onerisi: false, ...extra })

test.describe('Analiz sekmesi', () => {
  test('bulgu cümlesi, bölge tablosu, uyumsuz yıl sorusu (karar ve geri al), yetersiz yıl sorulmaz', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Analiz Bahçesi', lng: 27.92, lat: 38.92 })
    const state = { karar: null as boolean | null }
    const result = () => ({
      durum: 'hazir', mesaj: null, bolge_sayisi: 3, versiyon: 1, hesaplama: '2026-10-12T10:00:00Z', yil_araligi: '2017–2026',
      yillar: [
        yil(2015, { sahne_sayisi: 4, kismi: true, yetersiz_veri: true, yetersiz_nedeni: 'Yetersiz veri: 4 net sahne', dahil: false, donem_kapsami: 0.31 }),
        yil(2017), yil(2018),
        yil(2021, { uyumsuz: true, uyumsuz_nedeni: 'uyumsuz', korelasyon: 0.4, karar_bekliyor: state.karar === null, elle: state.karar, dahil: state.karar ?? false, varsayilan_dahil: false, karar_zamani: state.karar === null ? null : '2026-10-12T10:05:00Z' }),
      ],
      bolgeler: { type: 'FeatureCollection', features: [] },
      ozet: [bolge(1, 'Zayıf', { kontrol_onerisi: true }), bolge(2, 'Orta'), bolge(3, 'Güçlü')],
      homojen: false, yayilim_yuzde: 20, yorumlar: ['Güneybatı kesim yıllardır zayıf kalıyor; yerinde kontrol edin.', 'Kuzey kesim yıllardır bahçenin en güçlü kısmı.'], not_: 'Bölgeler ağaç gücünü gösterir.',
    })
    await page.route('**/bolgeler/cok-yillik/sonuc*', (route) => route.fulfill({ json: result() }))
    await page.route('**/bolgeler/cok-yillik/yillar', async (route) => {
      state.karar = (route.request().postDataJSON() as { yillar: { dahil: boolean | null }[] }).yillar[0].dahil
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

    await sorular.getByRole('button', { name: 'Hariç tut' }).click()
    await expect(sorular).toContainText('analizden hariç tutuldu')
    await sorular.getByRole('button', { name: 'Geri al' }).click()
    await expect(sorular).toContainText('Analize dahil edilsin mi?')

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
