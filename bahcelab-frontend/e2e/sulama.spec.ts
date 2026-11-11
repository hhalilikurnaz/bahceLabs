import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, newUser, seedGecici, seedScenes, seedWater } from './yardimcilar'

/** Sulama paneli (9H-S4 dilim 1), GERÇEK arka uçla: ERA5 + toprak + uydu tohumlanır (tests/support); FAO-56 motoru, vanalar, panel ve simülasyon gerçek çalışır. */
const PROFIL = { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke' }

async function kurulum(page: Page, ad: string, lng: number, opts: { profil?: boolean; agac?: number; fiyat?: number; vanalar?: boolean } = {}) {
  await newUser(page)
  const garden = await createGarden(page.request, { ad, lng, lat: 38.7, sideM: 200 })
  seedScenes(garden.id)
  seedWater(garden.id)
  if (opts.agac) expect((await page.request.patch(`/api/gardens/${garden.id}`, { data: { agac_sayisi: opts.agac } })).ok()).toBeTruthy()
  if (opts.profil !== false) expect((await page.request.put(`/api/gardens/${garden.id}/sulama-profili`, { data: { ...PROFIL, kwh_fiyat_tl: opts.fiyat ?? null } })).ok()).toBeTruthy()
  if (opts.vanalar) {
    const g = (await (await page.request.get(`/api/gardens/${garden.id}`)).json()) as { geometry: GeoJSON.Polygon }
    const xs = g.geometry.coordinates[0].map((c) => c[0])
    const ys = g.geometry.coordinates[0].map((c) => c[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const xm = (x0 + x1) / 2
    const kutu = (a: number, b: number) => ({ type: 'Polygon', coordinates: [[[a, y0], [b, y0], [b, y1], [a, y1], [a, y0]]] })
    const r = await page.request.put(`/api/gardens/${garden.id}/sulama-sektorleri`, { data: { sektorler: [{ ad: 'V1', geometry: kutu(x0, xm), vana_debi_m3h: 30 }, { ad: 'V2', geometry: kutu(xm, x1), vana_debi_m3h: 30 }] } })
    expect(r.ok(), await r.text()).toBeTruthy()
  }
  return garden
}
const yol = (id: string) => `/bahceler/${id}/su/sulama`

test('profil yokken boş durum; sihirbazla kayıttan sonra panel gelir; eski adres yönlenir', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Sihirbaz', 27.71, { profil: false, agac: 1800 })
  await page.goto(`/bahceler/${g.id}/sulama-plani`)
  await expect(page).toHaveURL(new RegExp(`/su/sulama$`)) // ayrı sayfa yok: eski adres Su sekmesinin sulama moduna yönlenir
  await expect(page.getByTestId('sulama-baslat')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('karar-cumlesi')).toContainText('sulama bilgisi gerekiyor')
  await page.getByTestId('sulama-baslat').click()
  const dlg = page.getByTestId('sulama-sihirbazi')
  await dlg.getByRole('radio', { name: 'Damla sulama' }).click()
  await page.getByTestId('sihirbaz-ileri').click()
  await expect(page.getByTestId('sihirbaz-agac')).toContainText('1800')
  await dlg.getByLabel('Sıra aralığı (m)').fill('5')
  await dlg.getByLabel('Ağaç aralığı (m)').fill('4')
  await dlg.getByLabel('Ağaç başına damlatıcı').fill('4')
  await dlg.getByLabel('Damlatıcı debisi (L/sa)').fill('4')
  await page.getByTestId('sihirbaz-ileri').click()
  await page.getByTestId('pompa-bilmiyorum').check()
  await page.getByTestId('sihirbaz-ileri').click()
  await expect(page.getByTestId('tarife-guncel-degil')).toContainText('Tarife güncel değil, faturanızdaki birim fiyatı girin')
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).include('[data-testid="sulama-sihirbazi"]').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  await page.getByTestId('sihirbaz-kaydet').click()
  await expect(dlg).toBeHidden()
  await expect(page.getByTestId('sulama-kpi')).toBeVisible({ timeout: 30_000 })
})

test('panel: karar, 3 KPI, Bugün sekmesi, toprak suyu (bantlar + eşik), su dengesi (14 gün), kaynak + güven', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Panel', 27.72, { agac: 1800 })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('sulama-kpi')).toBeVisible({ timeout: 30_000 })
  const baslik = (await page.getByTestId('karar-cumlesi').textContent()) ?? ''
  expect(baslik).toMatch(/sulanacak\.$|^Bu hafta sulama gerekmiyor\.$/)
  await expect(page.getByTestId('kpi-sonraki')).toBeVisible()
  await expect(page.getByTestId('kpi-ihtiyac')).toContainText('İhtiyaç karşılandı')
  await expect(page.getByTestId('kpi-sezon-alt')).toContainText('Plan · uygulanan: kayıt yok')
  const kpiY = (await page.getByTestId('sulama-kpi').boundingBox())!.y
  const kararY = (await page.getByTestId('karar-cumlesi').boundingBox())!.y
  expect(kpiY).toBeLessThan(kararY) // prototip: KPI'lar üstte, karar cümlesi altında
  await expect(page.getByTestId('sulama-baslik-satiri')).toContainText('Sulama')
  await expect(page.getByTestId('karar-alt')).toContainText(/^Kök bölgesi %\d+ dolu; (10 gün içinde eşiğe inmesi beklenmiyor|kullanılabilir su %\d+ sulama eşiğine iniyor)\.$/) // tek vanada «En kuru vana» yok
  await expect(page.getByTestId('karar-alt')).not.toContainText('En kuru vana')
  await expect(page.getByTestId('eksik-bilgi-listesi')).toHaveCount(0) // eksik bilgi tek satırda toplu, liste kapalı
  await expect(page.getByTestId('eksik-bilgi-satiri')).toContainText(/Eksik bilgi \(\d\)/)
  await expect(page.getByTestId('eksik-bilgi-satiri')).toContainText('Tamamla')
  await expect(page.getByTestId('kpi-ihtiyac')).toContainText(/karşılanıyor|dikkat|yetersiz/) // renk + yazı
  await expect(page.getByTestId('kpi-sezon')).toContainText('Sezon suyu')
  expect(await page.getByTestId('hafta-seridi').locator('li').count()).toBe(7)
  await expect(page.getByTestId('vana-satiri')).toHaveCount(1) // vana çizilmedi: tek sektör
  await expect(page.getByTestId('vana-not')).toContainText('tek sektör')
  const toprak = page.getByTestId('toprak-suyu-grafigi')
  await expect(toprak).toBeVisible()
  await expect(toprak.getByTestId('bant-stres')).toBeVisible()
  await expect(toprak.getByTestId('bant-ideal')).toBeVisible()
  await expect(toprak.getByTestId('esik-cizgisi')).toContainText('sulama eşiği')
  await expect(toprak.getByTestId('toprak-bugun')).toContainText('bugün')
  await expect(toprak.getByTestId('tahmin-bolgesi')).toBeVisible()
  await expect(page.getByTestId('toprak-suyu-cumlesi')).toContainText(/^(Kök bölgesi|En düşük vana|Bahçe) .*%\d+; 7 günde eşik altına/)
  const denge = page.getByTestId('su-dengesi-grafigi')
  await expect(denge).toBeVisible()
  expect(await denge.getByTestId('denge-gunu').count()).toBe(14)
  await expect(page.getByTestId('su-dengesi-cumlesi')).toContainText(/^Son 14 günde ihtiyacın %\d+'i karşılandı/)
  await expect(page.getByTestId('guven-etiketi')).toContainText(/Güven: (düşük|orta|yüksek)/)
  await expect(page.getByTestId('sulama-kaynak')).toContainText('FAO-56')
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('vanalar: iki vana satırı + iki çizgi, vardiya saatleri; «sonraki sulama» KPI ile çizelge aynı gün; onayla ve Saha Defteri\'ne işle', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Vana', 27.73, { agac: 1800, vanalar: true })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('vana-satiri')).toHaveCount(2, { timeout: 30_000 })
  expect(await page.getByTestId('vana-cizgisi').count()).toBe(2)
  await expect(page.getByTestId('vana-baslik').first()).toHaveText(/^V1 · %\d+$/)
  await expect(page.getByTestId('vana-alt').first()).toContainText(/(stres|yakın|yeterli|dolu) · (sonraki \d+ \p{L}+|sulama gerekmiyor)/u)
  // vardiya: 05:00'te başlar; vanalar art arda
  const kalemler = page.getByTestId('vardiya-kalemi')
  if ((await kalemler.count()) > 0) {
    await expect(kalemler.first()).toContainText('05:00')
    // KPI'daki tarih ile «Sonraki program» başlığındaki tarih aynı
    const kpi = (await page.getByTestId('kpi-sonraki').textContent()) ?? ''
    const gun = /(\d+) (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)/.exec(kpi)
    const prog = (await page.getByTestId('sonraki-program').locator('h3').textContent()) ?? ''
    if (gun) expect(prog).toContain(`${gun[1]}.`)
    else expect(kpi).toContain('Bugün') // sulama bugün: KPI tarih yerine «Bugün» yazar
    await page.getByTestId('programi-onayla').click()
    await expect(page.getByTestId('programi-onayla')).toHaveText('Program onaylandı', { timeout: 30_000 })
    await page.getByTestId('sahaya-isle').click()
    await expect(page.getByText(/Saha Defteri'ne \d+ sulama kaydı işlendi/)).toBeVisible({ timeout: 30_000 })
    const kayit = (await (await page.request.get(`/api/gardens/${g.id}/saha-kayitlari`)).json()) as { kayitlar: { tur: string; ayrinti: { sektor?: string; m3?: number } | null }[] }
    expect(kayit.kayitlar.filter((k) => k.tur === 'sulama' && k.ayrinti?.sektor).length).toBeGreaterThan(0)
  }
})

test('simülasyon: yıl düğmeleri (kuru/normal/ıslak), 4 sayaç, sistem ve kısıntı, kilitli dönemler, TL yoksa neden', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Sim', 27.74, { agac: 1800 })
  await page.goto(yol(g.id))
  await page.getByTestId('sulama-sekme-simulasyon').click()
  const sim = page.getByTestId('sulama-simulasyon')
  await expect(sim.getByTestId('sim-sayaclar')).toBeVisible({ timeout: 45_000 })
  const yillar = sim.getByTestId('sim-yillar')
  expect(await yillar.locator('button').count()).toBeGreaterThanOrEqual(10) // 2015–2025 hepsi
  for (const tip of ['kuru', 'normal', 'islak']) expect(await yillar.locator(`[data-tip="${tip}"]`).count()).toBeGreaterThan(0)
  await expect(yillar.getByRole('button', { name: /kuru yıl, sezon yağışı \d+ mm/ }).first()).toBeVisible() // her sütunun erişilebilir adı var
  await expect(sim.getByTestId('sayac-tl')).toHaveText('—')
  await expect(sim.getByTestId('sim-tl-eksik')).toContainText('Tarife güncel değil, faturanızdaki birim fiyatı girin')
  const m3 = async () => parseInt(((await sim.getByTestId('sayac-m3').textContent()) ?? '0').replace(/\D/g, ''), 10)
  const damla = await m3()
  await sim.getByTestId('sim-sistem-salma').click()
  await expect.poll(m3, { timeout: 30_000 }).toBeGreaterThan(damla) // salma daha çok su
  await sim.getByTestId('sim-sistem-damla').click()
  await expect.poll(m3, { timeout: 30_000 }).toBe(damla)
  await sim.getByTestId('sim-kisinti').click()
  await expect(sim.getByTestId('sim-kisinti-notu')).toContainText('Kilitli: Çiçeklenme ve meyve tutumu, Hızlı meyve büyümesi')
  await expect(sim.getByTestId('sim-kisinti-notu')).toContainText('Bu dönemde önerilmez')
  await expect.poll(m3, { timeout: 30_000 }).toBeLessThan(damla)
  await expect(sim.getByTestId('sim-kisinti-ozet')).toContainText(/az su .*stres günü \d+ → \d+ .*verim riski: (düşük|orta|yüksek)/) // tasarruf tek başına gösterilmez
  await sim.getByTestId('sim-kisinti').click()
  await sim.getByTestId('sim-kwh').fill('2,5')
  await expect(sim.getByTestId('sayac-tl')).toContainText('TL', { timeout: 30_000 })
  await expect(sim.getByTestId('sayac-kwh')).toContainText('kWh')
  // çizelge: sulama günleri arasında gezinme
  await expect(sim.getByTestId('sim-cizelge')).toBeVisible()
  // gün seçimi alt çubukta (eski kaydırıcının yerine): sonraki sulama → panelin vana programı o güne geçer
  await page.getByTestId('alt-sonraki-sulama').click()
  await expect(sim.getByTestId('sim-gun')).toBeVisible()
  const gun1 = await sim.getByTestId('sim-gun').textContent()
  await page.getByTestId('alt-sonraki-sulama').click()
  await expect(sim.getByTestId('sim-gun')).not.toHaveText(gun1 ?? '')
  // alışkanlık: kayıt yok → neden; elle gün + süre → karşılaştırma cümlesi
  await sim.getByTestId('sim-mod-aliskanlik').click()
  await expect(sim.getByTestId('sim-aliskanlik-neden')).toContainText('en az 4 sulama günü')
  await sim.getByRole('button', { name: 'Pzt' }).click()
  await sim.getByRole('button', { name: 'Per' }).click()
  await sim.getByTestId('sim-elle-saat').fill('4')
  await expect(sim.getByTestId('sim-karsilastirma-cumle')).toContainText('alışkanlığınız plana göre', { timeout: 30_000 })
  await expect(sim.getByTestId('sim-karsilastirma')).toContainText('Boşa giden')
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('ağaç sayısı yoksa ağaç başına değer gizlenir; hareketi azalt açıkken panel aynı bilgiyi verir', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const g = await kurulum(page, 'Sulama Agacsiz', 27.75)
  await page.goto(yol(g.id))
  await expect(page.getByTestId('sulama-kpi')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('eksik-bilgi-satiri').click() // «Eksik bilgi (N) · Tamamla →» tek satır; tıklayınca liste
  await expect(page.getByTestId('uyari-agac_sayisi_yok')).toContainText('Ağaç sayısı beyan edilmediği için')
  await expect(page.getByTestId('sulama-paneli')).not.toContainText('L/ağaç')
  await expect(page.getByTestId('toprak-suyu-grafigi')).toBeVisible()
  await expect(page.getByTestId('guven-etiketi')).toHaveAttribute('data-guven', /dusuk|orta|yuksek/)
})

test('Su kartı, Bugün satırı ve Geçmiş satırı sulama moduna bağlanır; Saha Defteri miktarı kovaya girer', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Baglanti', 27.76, { agac: 1800 })
  // BÜYÜK SAYI TEK KAYNAKTAN: Su sekmesi ↔ sulama paneli (kova), ERA5-Land nemi yalnız küçük referans satırı
  await page.goto(yol(g.id))
  await expect(page.getByTestId('vana-baslik').first()).toHaveText(/^Bahçe · %\d+$/, { timeout: 30_000 })
  const panelPct = ((await page.getByTestId('vana-baslik').first().textContent()) ?? '').match(/%(\d+)/)![1]
  await page.goto(`/bahceler/${g.id}/su`)
  await expect(page.getByTestId('buyuk-sayi')).toHaveText(`%${panelPct}`, { timeout: 30_000 })
  await expect(page.getByTestId('su-on-deger')).toContainText('model toprak nemi (ERA5-Land')
  const kart = page.getByTestId('sulama-karti')
  await expect(kart.getByTestId('sulama-karti-karar')).toContainText(/sulayın\.|sulama gerekmiyor\./, { timeout: 30_000 })
  await kart.getByTestId('plana-git').click()
  await expect(page).toHaveURL(/\/su\/sulama$/)
  await expect(page.getByTestId('sulama-paneli')).toBeVisible()
  await page.getByTestId('sulamadan-cik').click()
  await expect(page).toHaveURL(new RegExp(`/bahceler/${g.id}/su$`))
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('bugun-sulama-satiri')).toContainText(/^Sulama: /, { timeout: 30_000 })
  await page.getByTestId('bugun-plana-git').click()
  await expect(page).toHaveURL(/\/su\/sulama$/)
  const gun = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
  expect((await page.request.post(`/api/gardens/${g.id}/saha-kayitlari`, { data: { tur: 'sulama', tarih: gun, ayrinti: { m3: 150 } } })).ok()).toBeTruthy()
  await page.reload()
  await expect(page.getByTestId('kpi-sezon')).toContainText('150 m³', { timeout: 30_000 })
  await expect(page.getByTestId('kpi-sezon-alt')).not.toContainText('kayıt yok')
  await expect(page.getByTestId('kpi-sezon-alt')).toContainText('Uygulanan · plan')
  await page.goto(`/bahceler/${g.id}/gecmis`)
  await expect(page.getByTestId('gecmis-sulama')).toContainText(/planlanan .* m³ · uygulanan 150 m³/, { timeout: 30_000 })
})

test('mobil (390): panel alt sayfada, KPI yatay kaydırılır, sayfa taşmaz; sihirbaz alt sayfa gibi açılır', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const g = await kurulum(page, 'Sulama Mobil', 27.77, { agac: 1800 })
  await page.goto(yol(g.id))
  await expect(page.getByTestId('sulama-kpi')).toBeVisible({ timeout: 30_000 })
  const kpi = await page.getByTestId('sulama-kpi').evaluate((el) => ({ kaydirilir: el.scrollWidth > el.clientWidth, genislik: el.clientWidth }))
  expect(kpi.kaydirilir).toBe(true)
  expect(kpi.genislik).toBeLessThanOrEqual(390)
  await expect(page.getByTestId('toprak-suyu-grafigi')).toBeVisible()
  await page.getByTestId('sulama-bilgileri').click()
  const dlg = page.getByTestId('sulama-sihirbazi')
  const kutu = await dlg.boundingBox()
  expect(kutu!.width).toBeLessThanOrEqual(390)
  expect(kutu!.y + kutu!.height).toBeGreaterThan(800)
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test('geçici günler taralı ve notlu; bahçe yağış ölçümü seriden önce kullanılır, etiketlenir; yanlılık önerisi görünür; kesinleşince plan yeniden hesaplanır', async ({ page }) => {
  const g = await kurulum(page, 'Sulama Gecici', 27.78, { agac: 1800 })
  seedGecici(g.id, 5) // son 5 gün (bugün dahil) ERA5 kesinleşmemiş
  // Saha Defteri: arayüzden «Yağış ölçümü (mm)» kaydı
  await page.goto(`/bahceler/${g.id}/defter`)
  await page.getByTestId('kayit-tur-yagis').click()
  await expect(page.getByTestId('kayit-kaydet')).toBeDisabled() // mm girilmeden kaydedilmez
  await page.getByTestId('yagis-mm').fill('21,5')
  await page.getByTestId('kayit-tarih').fill(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10))
  await page.getByTestId('kayit-kaydet').click()
  await expect(page.getByTestId('kayit-tur-yagis')).toBeVisible()
  await page.goto(yol(g.id))
  await expect(page.getByTestId('sulama-kpi')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('gecici-notu')).toContainText('Son 5 gün geçici')
  await expect(page.getByTestId('gecici-notu-bugun')).toContainText('kesinleşince plan yeniden hesaplanır')
  await expect(page.getByTestId('toprak-suyu-grafigi').getByTestId('gecici-bolge')).toBeVisible()
  await expect(page.getByTestId('su-dengesi-grafigi').getByTestId('denge-gecici')).toBeVisible()
  await expect(page.getByTestId('denge-olculdu')).toHaveCount(1) // «bahçede ölçüldü» işareti
  await expect(page.getByTestId('olculdu-notu')).toContainText('bahçede ölçüldü')
  await expect(page.getByTestId('sulama-kaynak')).toContainText('1 gün bahçede ölçüldü')
  await expect(page.getByTestId('sulama-kaynak')).toContainText('son 5 gün geçici')
  await expect(page.getByTestId('yagis-yanlilik')).toContainText('1 gün')
  await expect(page.getByTestId('yagis-yanlilik')).toContainText('öneri için yeterli kanıt yok') // tek gün: öneri yok, otomatik uygulanmaz
  // Su kartı da aynı notu verir
  await page.goto(`/bahceler/${g.id}/su`)
  await expect(page.getByTestId('sulama-karti-gecici')).toContainText('Son 5 gün geçici')
  await expect(page.getByTestId('sulama-karti-gecici')).toContainText('1 gün bahçede ölçüldü')
  // ERA5 kesinleşti (yağışlı geldi): geçici not kalkar, kova yeniden hesaplanır
  seedGecici(g.id, 5, 40)
  await page.goto(yol(g.id))
  await expect(page.getByTestId('sulama-kpi')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('gecici-notu')).toHaveCount(0)
  await expect(page.getByTestId('toprak-suyu-grafigi').getByTestId('gecici-bolge')).toHaveCount(0)
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  expect(sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})
