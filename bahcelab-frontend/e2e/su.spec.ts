import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedRadar, seedScenes, seedWater, seedWeather } from './yardimcilar'

/** Su ve sıcaklık dilimi (9E), GERÇEK arka uçla: ERA5 önbelleği + toprak profili tohumlanır, Landsat gerçek doldurma hattından geçer. */
async function kurulum(page: Page, ad: string, lng: number) {
  await newUser(page)
  const garden = await createGarden(page.request, { ad, lng, lat: 38.7, sideM: 200 })
  seedScenes(garden.id)
  seedRadar(garden.id, { bulutlu: true })
  seedWater(garden.id)
  return garden
}

test('Su sekmesi: karar cümlesi üstte, dört kanıt grafiği ve kaynak çipleri', async ({ page }) => {
  const g = await kurulum(page, 'Su Sekmesi', 27.61)
  await page.goto(`/bahceler/${g.id}/su`)
  await expect(page.getByTestId('su-karar-cumlesi')).toContainText(/sulama|nemli|kuru|su/i, { timeout: 30_000 }) // cümle tohumlanan seriden hesaplanır; içeriği birim testlerde sınanır
  await expect(page.getByTestId('su-on-deger')).toContainText('ön değer · mühendis onayı bekliyor')
  // 1) nem profili: 4 derinlik, bugün + 30 gün önce çizgisi, bahçenin normal aralığı
  const profil = page.getByTestId('nem-profili')
  await expect(profil).toBeVisible()
  await expect(profil.getByTestId('profil-nokta')).toHaveCount(4)
  await expect(profil.getByTestId('profil-bugun')).toBeVisible()
  await expect(profil.getByTestId('profil-30gun')).toBeVisible()
  expect(await profil.getByTestId('normal-aralik').count()).toBe(4)
  await expect(page.getByTestId('kaynak-profil')).toContainText('ERA5-Land')
  // 2) su dengesi: yağış/ETc çubukları, birikimli çizgi, 7 günlük tahmin bandı
  const denge = page.getByTestId('su-dengesi')
  await expect(denge).toBeVisible()
  await expect(denge.getByTestId('birikimli-cizgi')).toBeVisible()
  await expect(denge.getByTestId('tahmin-bandi')).toBeVisible()
  await expect(denge.getByTestId('birikimli-son')).toContainText('mm')
  await expect(page.getByTestId('kaynak-denge')).toBeVisible()
  // 3) bulut altında görüş (9D)
  await expect(page.getByTestId('bulut-altinda-gorus')).toBeVisible()
  // 4) yüzey–hava sıcaklığı: son 6 Landsat geçişi; sabit eşik yok, bahçenin aynı ay bandı
  const yuzey = page.getByTestId('yuzey-hava')
  await expect(yuzey).toBeVisible()
  expect(await yuzey.getByTestId('sicaklik-noktasi').count()).toBe(6)
  await expect(yuzey.getByTestId('sicaklik-cumlesi')).toContainText(/normaline göre|normali içinde/) // aynı ay geçmişi yeterli (≥ 8 geçiş)
  expect(await yuzey.getByTestId('ay-normali').count()).toBeGreaterThan(0)
  await expect(yuzey.getByTestId('stres-esigi')).toHaveCount(0) // sabit +5 °C eşiği kaldırıldı
  await expect(page.getByTestId('su-doluluk')).toBeVisible()
  await expect(page.getByTestId('su-on-deger')).toContainText(/normaline göre kök bölgesi doluluğu/)
  await expect(page.getByTestId('kaynak-sicaklik')).toContainText('Landsat')
  // doğrulama kaynakları (SMAP/IMERG/CHIRPS) arayüzde görünmez; yalnız «Nasıl hesaplandı?» içinde anılabilir
  await expect(page.getByTestId('su-karar')).not.toContainText(/SMAP|IMERG|CHIRPS/)
  for (const id of ['nem-profili', 'su-dengesi', 'bulut-altinda-gorus', 'yuzey-hava']) await expect(page.getByTestId(id)).not.toContainText(/SMAP|IMERG|CHIRPS/)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('Yüzey sıcaklığı katmanı: Sıcaklık grubu, 100 m notu, Landsat tarihlerinde gezinme', async ({ page }) => {
  const g = await kurulum(page, 'Sicaklik Katmani', 27.62)
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('katman-menusu').getByRole('button').first().click()
  await expect(page.getByRole('listbox', { name: 'Katmanlar' })).toContainText('Sıcaklık')
  await expect(page.getByTestId('katman-yuzeySicakligi')).toContainText('Yüzey sıcaklığı (Landsat)')
  await page.getByTestId('katman-yuzeySicakligi').click()
  const lejant = page.getByTestId('histogram-lejant')
  await expect(lejant).toContainText('°C', { timeout: 30_000 })
  await expect(page.getByTestId('lejant-not')).toContainText('100 m fiziksel çözünürlük · bahçe içi ayrıntı vermez')
  const once = await page.getByTestId('secili-tarih').innerText()
  await page.getByRole('button', { name: 'Önceki görüntü' }).click()
  await expect(page.getByTestId('secili-tarih')).not.toHaveText(once)
})

test('Yüzey–hava grafiğinde bir geçişe dokununca harita Yüzey sıcaklığı katmanını o tarihte açar', async ({ page }) => {
  const g = await kurulum(page, 'Sicaklik Tikla', 27.63)
  await page.goto(`/bahceler/${g.id}/su`)
  const noktalar = page.getByTestId('yuzey-hava').getByTestId('sicaklik-noktasi')
  await expect(noktalar).toHaveCount(6, { timeout: 30_000 })
  const hedef = noktalar.nth(2)
  const tarih = await hedef.getAttribute('data-tarih')
  await hedef.click()
  await expect(page.getByTestId('katman-menusu')).toContainText('Yüzey sıcaklığı (Landsat)')
  await expect(page.getByTestId('histogram-lejant')).toContainText('°C', { timeout: 30_000 })
  const [, ay, gun] = (tarih ?? '').split('-').map(Number)
  await expect(page.getByTestId('secili-tarih')).toContainText(`${gun}`)
  expect(ay).toBeGreaterThan(0)
  await expect(hedef).toHaveAttribute('role', 'button')
  // klavye ile de açılır
  await noktalar.nth(4).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('secili-tarih')).toBeVisible()
})

test('TEK sulama kararı: Hava sekmesindeki sulama kartı ile Su sekmesi aynı cümleyi söyler', async ({ page }) => {
  const g = await kurulum(page, 'Tek Karar', 27.64)
  seedWeather(g.id)
  await page.goto(`/bahceler/${g.id}/su`)
  const suKarar = (await page.getByTestId('su-karar-cumlesi').innerText({ timeout: 30_000 })).trim()
  await page.goto(`/bahceler/${g.id}/hava`)
  const hava = page.getByTestId('irrigation-sentence')
  await expect(hava).toBeVisible({ timeout: 30_000 })
  expect((await hava.innerText()).trim().startsWith(suKarar)).toBe(true) // gerekliyse sonuna miktar eklenir; karar kısmı aynıdır
  await page.getByTestId('irrigation-su-link').click()
  await expect(page).toHaveURL(/\/su$/)
})

test('Yeni bahçe eklenince ERA5 besleme işi kendiliğinden çalışır ve Su sekmesi elle betik olmadan dolar', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Kendiliginden Su', lng: 27.71, lat: 38.61, sideM: 200 }) // seedWater YOK: yalnız besleme işi
  await page.goto(`/bahceler/${garden.id}/su`)
  await expect(async () => {
    await page.reload()
    await expect(page.getByTestId('nem-profili')).toBeVisible({ timeout: 4_000 })
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] }) // iş arka planda 2015→bugün doldurur
  expect(await page.getByTestId('profil-nokta').count()).toBeGreaterThanOrEqual(3) // son gün model: 100–255 cm modelde yok
  await expect(page.getByTestId('su-karar-cumlesi')).not.toBeEmpty()
  await expect(page.getByTestId('su-on-deger')).toContainText(/normaline göre kök bölgesi doluluğu/)
})
