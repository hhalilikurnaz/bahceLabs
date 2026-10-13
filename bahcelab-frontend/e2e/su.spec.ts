import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedRadar, seedScenes, seedWater } from './yardimcilar'

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
  // 4) yüzey–hava sıcaklığı: son 6 Landsat geçişi, stres eşiği
  const yuzey = page.getByTestId('yuzey-hava')
  await expect(yuzey).toBeVisible()
  expect(await yuzey.getByTestId('sicaklik-noktasi').count()).toBe(6)
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
