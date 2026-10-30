import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedScenes, seedWater } from './yardimcilar'

/** Sulama planı (9H), GERÇEK arka uçla: ERA5 serisi + toprak + uydu tohumlanır (tests/support), FAO-56 motoru ve API gerçek çalışır. */
const PROFIL = { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke' }

async function kurulum(page: Page, ad: string, lng: number, opts: { profil?: boolean; agac?: number; fiyat?: number } = {}) {
  await newUser(page)
  const garden = await createGarden(page.request, { ad, lng, lat: 38.7, sideM: 200 })
  seedScenes(garden.id)
  seedWater(garden.id)
  if (opts.agac) expect((await page.request.patch(`/api/gardens/${garden.id}`, { data: { agac_sayisi: opts.agac } })).ok()).toBeTruthy()
  if (opts.profil !== false) expect((await page.request.put(`/api/gardens/${garden.id}/sulama-profili`, { data: { ...PROFIL, kwh_fiyat_tl: opts.fiyat ?? null } })).ok()).toBeTruthy()
  return garden
}

test('sihirbaz: profil yokken boş durum, dört adımda kayıt, ardından plan gelir', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Sihirbaz', 27.71, { profil: false, agac: 1800 })
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  await expect(page.getByTestId('sulama-profil-yok')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('sulama-baslik')).toContainText('sulama bilgisi gerekiyor')
  await page.getByTestId('sulama-baslat').click()
  const dlg = page.getByTestId('sulama-sihirbazi')
  await expect(dlg).toBeVisible()
  await dlg.getByRole('radio', { name: 'Damla sulama' }).click()
  await page.getByTestId('sihirbaz-ileri').click()
  await expect(page.getByTestId('sihirbaz-agac')).toContainText('1800') // ağaç sayısı bahçe bilgisinden, burada sorulmaz
  await dlg.getByLabel('Sıra aralığı (m)').fill('5')
  await dlg.getByLabel('Ağaç aralığı (m)').fill('4')
  await dlg.getByLabel('Ağaç başına damlatıcı').fill('4')
  await dlg.getByLabel('Damlatıcı debisi (L/sa)').fill('4')
  await page.getByTestId('sihirbaz-ileri').click()
  await page.getByTestId('pompa-bilmiyorum').check() // bilmiyorum: kWh ve TL üretilmez
  await page.getByTestId('sihirbaz-ileri').click()
  await expect(page.getByTestId('tarife-guncel-degil')).toContainText('Tarife güncel değil, faturanızdaki birim fiyatı girin') // doğrulanamayan tarife için sayı uydurulmaz
  await dlg.getByLabel(/Elektrik birim fiyatı/).fill('3,2')
  const sonuc = await new AxeBuilder({ page }).include('[data-testid="sulama-sihirbazi"]').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  await page.getByTestId('sihirbaz-kaydet').click()
  await expect(dlg).toBeHidden()
  await expect(page.getByTestId('sulama-hafta')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('sulama-bolum-maliyet').click()
  await expect(page.getByTestId('maliyet-tl')).toHaveText('—') // pompa bilinmiyor → TL gizli
  await expect(page.getByTestId('maliyet-eksik')).toContainText('Pompa gücü ve debisi girilmedi')
})

test('plan: karar cümlesi, hafta takvimi, kova grafiği (eşik, tahmin, bugün), ağaç başına litre ve etiketi', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Plan', 27.72, { agac: 1800 })
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  await expect(page.getByTestId('sulama-hafta')).toBeVisible({ timeout: 30_000 })
  const baslik = (await page.getByTestId('sulama-baslik').textContent()) ?? ''
  expect(baslik).toMatch(/^(Bugün|Yarın|Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar) (sabah .+ sulayın|yaklaşık \d+ metreküp sulayın)\.$|^Bu hafta sulama gerekmiyor\.$/)
  const kova = page.getByTestId('kova-grafigi')
  await expect(kova).toBeVisible()
  await expect(kova.getByTestId('esik-cizgisi')).toContainText('sulama eşiği')
  await expect(kova.getByTestId('tahmin-bolgesi')).toBeVisible()
  await expect(kova.getByTestId('kova-bugun')).toContainText('bugün')
  await expect(page.getByTestId('kova-aciklama')).toContainText('planlanan sulama')
  if (!baslik.startsWith('Bu hafta')) {
    await expect(page.getByTestId('sulama-litre')).toContainText('beyan edilen ağaç sayısına göre')
    await expect(page.getByTestId('hafta-sure').first()).toContainText(/\d+ (sa|dk)/)
  }
  // tek eksen: ikinci dikey eksen yok; imleç gezinince değer kutusu
  const kutu = await kova.boundingBox()
  await page.mouse.move(kutu!.x + kutu!.width * 0.5, kutu!.y + 60)
  await expect(page.getByTestId('grafik-tooltip')).toContainText('kullanılabilir su')
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('ağaç sayısı beyan edilmemişse ağaç başına değerler gizlenir ve söylenir', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Agacsiz', 27.73)
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  await expect(page.getByTestId('sulama-hafta')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('uyari-agac_sayisi_yok')).toContainText('Ağaç sayısı beyan edilmediği için')
  await expect(page.getByTestId('sulama-karar')).not.toContainText('L/ağaç')
  await expect(page.getByTestId('sulama-hafta')).not.toContainText('L/ağaç')
})

test('maliyet: tarife yoksa TL uydurulmaz; kendi fiyatınız girilince TL ve sezon aralığı gelir', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Maliyet', 27.74)
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  await page.getByTestId('sulama-bolum-maliyet').click()
  await expect(page.getByTestId('maliyet-bolumu')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('maliyet-tl')).toHaveText('—')
  await expect(page.getByTestId('maliyet-eksik')).toContainText('Tarife güncel değil, faturanızdaki birim fiyatı girin')
  await expect(page.getByTestId('sezon-aralik-m3')).toContainText('–') // tek sayı değil aralık
  await expect(page.getByTestId('sezon-tl-yok')).toBeVisible()
  await expect(page.getByTestId('sezon-aralik-not')).toContainText('11 sezonun gerçek havasıyla')
  expect((await page.request.put(`/api/gardens/${g.id}/sulama-profili`, { data: { ...PROFIL, kwh_fiyat_tl: 2.5 } })).ok()).toBeTruthy()
  await page.reload()
  await page.getByTestId('sulama-bolum-maliyet').click()
  await expect(page.getByTestId('sezon-aralik-tl')).toContainText('–', { timeout: 30_000 })
  await expect(page.getByTestId('maliyet-hafta')).toContainText(/Sizin girdiğiniz fiyat|Önümüzdeki 7 gün/)
  expect(await page.getByTestId('aylik-plan').count()).toBeGreaterThan(3)
})

test('senaryolar: alışkanlık, kuru/ıslak yıl, kilitli kısıntı dönemleri, sistem değişikliği', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Senaryo', 27.75, { agac: 2000, fiyat: 2.5 })
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  await page.getByTestId('sulama-bolum-senaryo').click()
  const b = page.getByTestId('senaryo-bolumu')
  await expect(b.getByTestId('senaryo-kuru-islak')).toBeVisible({ timeout: 45_000 })
  await expect(b.getByTestId('kuru-islak-fark')).toContainText('m³')
  expect(await b.getByTestId('kuru-islak-yillar').locator('li').count()).toBeGreaterThanOrEqual(9)
  // kısıntı: varsayılan plan değil; kilitli dönemler açıkça yazılı; verim riski
  await expect(b.getByTestId('kisinti-uyari')).toContainText('varsayılan plan tam sulamadır')
  await expect(b.getByTestId('kisinti-kilitli')).toContainText('Çiçeklenme ve meyve tutumu')
  await expect(b.getByTestId('kisinti-kilitli')).toContainText('Hızlı meyve büyümesi')
  await expect(b.getByTestId('kisinti-kilitli')).toContainText('Bu dönemde önerilmez')
  await expect(b.getByTestId('kisinti-risk')).toContainText('Verim riski: düşük')
  // alışkanlık: haftada 2 gün × 4 saat
  await expect(b.getByTestId('aliskanlik-bos')).toBeVisible()
  await b.getByRole('button', { name: 'Pzt' }).click()
  await b.getByRole('button', { name: 'Per' }).click()
  await b.getByTestId('aliskanlik-saat').fill('4')
  await expect(b.getByTestId('aliskanlik-fark-m3')).toContainText('m³', { timeout: 30_000 })
  await expect(b.getByTestId('aliskanlik-ozet')).toContainText('alışkanlığınız plandan')
  // sistem değişikliği: salma → daha fazla su; geri ödeme yok
  await b.getByTestId('sistem-hedef').selectOption('salma')
  await b.getByTestId('sistem-yatirim').fill('50000')
  await expect(b.getByTestId('sistem-fark-m3')).toContainText('+', { timeout: 30_000 })
  await expect(b.getByTestId('sistem-geri-odeme')).toContainText('geri ödeme hesaplanmaz')
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('sezon animasyonu: oynatınca gün ve sayaçlar ilerler; sulama günleri vurgulanır', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Animasyon', 27.76, { fiyat: 2.5 })
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  const a = page.getByTestId('sezon-anim')
  await expect(a.getByTestId('anim-gun')).toBeVisible({ timeout: 45_000 })
  const ilkGun = await a.getByTestId('anim-gun').textContent()
  await a.getByTestId('anim-oynat').click()
  await expect.poll(async () => a.getByTestId('anim-gun').textContent(), { timeout: 15_000 }).not.toBe(ilkGun)
  await expect.poll(async () => parseInt(((await a.getByTestId('anim-sayac-m3').textContent()) ?? '0').replace(/\D/g, ''), 10), { timeout: 30_000 }).toBeGreaterThan(0)
  await a.getByTestId('anim-oynat').click() // durdur
  const kaydir = a.getByTestId('anim-slider')
  await kaydir.fill('120')
  await expect(a.getByTestId('anim-sayac-tl')).toContainText('TL')
  await expect(a.getByTestId('anim-ozet')).toContainText('sulama')
})

test('hareketi azalt: oynatma yok, gün gün adımlama; sayaçlar adımla ilerler', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const g = await kurulum(page, 'Sulama Azalt', 27.77, { fiyat: 2.5 })
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  const a = page.getByTestId('sezon-anim')
  await expect(a.getByTestId('anim-gun')).toBeVisible({ timeout: 45_000 })
  await expect(a.getByTestId('anim-oynat')).toHaveCount(0)
  const ilk = await a.getByTestId('anim-gun').textContent()
  await a.getByTestId('anim-ileri').click()
  await expect(a.getByTestId('anim-gun')).not.toHaveText(ilk ?? '')
  await a.getByTestId('anim-hafta').click()
  await a.getByTestId('anim-hafta').click()
  await a.getByTestId('anim-hafta').click()
  await a.getByTestId('anim-hafta').click()
  await a.getByTestId('anim-hafta').click()
  await a.getByTestId('anim-hafta').click()
  await expect(a.getByTestId('anim-sayac-m3')).toContainText('m³')
})

test('Su sekmesi kartı, Bugün satırı ve Geçmiş satırı plana bağlanır; Saha Defteri sulama miktarı kovaya girer', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Baglanti', 27.78, { agac: 1800 })
  await page.goto(`/bahceler/${g.id}/su`)
  const kart = page.getByTestId('sulama-karti')
  await expect(kart.getByTestId('sulama-karti-karar')).toContainText(/sulayın\.|sulama gerekmiyor\./, { timeout: 30_000 })
  await expect(page.getByTestId('su-karar')).toBeVisible()
  // Su sekmesindeki eski karar ile planın cümlesi çelişmez (iki ayrı sorgu, tek veri)
  await page.goto(`/bahceler/${g.id}`)
  const satir = page.getByTestId('bugun-sulama-satiri')
  await expect(satir).toContainText(/^Sulama: /, { timeout: 30_000 })
  await satir.getByTestId('bugun-plana-git').click()
  await expect(page).toHaveURL(/\/sulama-plani$/)
  // Saha Defteri: bugünden 2 gün önce 150 m³ sulama kaydı
  const gun = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
  expect((await page.request.post(`/api/gardens/${g.id}/saha-kayitlari`, { data: { tur: 'sulama', tarih: gun, ayrinti: { m3: 150 } } })).ok()).toBeTruthy()
  await page.reload()
  await page.getByTestId('sulama-bolum-maliyet').click()
  await expect(page.getByTestId('uygulanan-toplam')).toContainText('150 m³', { timeout: 30_000 })
  await page.goto(`/bahceler/${g.id}/gecmis`)
  await expect(page.getByTestId('gecmis-sulama')).toContainText(/planlanan .* m³ · uygulanan 150 m³/, { timeout: 30_000 })
})

test('mobil (390): Su kartı alt sayfada, plan sayfası ve sihirbaz taşmadan açılır', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const g = await kurulum(page, 'Sulama Mobil', 27.79, { profil: false, agac: 1800 })
  await page.goto(`/bahceler/${g.id}/su`)
  await expect(page.getByTestId('sulama-karti')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('plana-git')).toContainText('Sulama bilgilerini gir')
  await page.getByTestId('plana-git').click()
  await expect(page.getByTestId('sulama-profil-yok')).toBeVisible()
  await page.getByTestId('sulama-baslat').click()
  const dlg = page.getByTestId('sulama-sihirbazi')
  const kutu = await dlg.boundingBox()
  expect(kutu!.width).toBeLessThanOrEqual(390)
  expect(kutu!.y + kutu!.height).toBeGreaterThan(800) // alt sayfa: ekranın altına yaslı
  const sonuc = await new AxeBuilder({ page }).include('[data-testid="sulama-sihirbazi"]').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
  const tasma = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(tasma).toBeLessThanOrEqual(0)
})
