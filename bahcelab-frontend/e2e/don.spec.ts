import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, newUser, seedDon } from './yardimcilar'

/** ADIM 10 Dilim 2: «Önümüzdeki 3 gece» kartı (olasılık sözcükleri, kaynaklı «ne yapmalı»), «Don oldu mu?», bahçe içi soğuk nokta katmanı (kapı), arazi kartı, hasar raporu PDF'i, bildirim tercihi.
 * GERÇEK arka uç + gerçek don motoru (sentetik saatlik tahminlerle tohumlanır; tahmin ağı yok). */
async function axeTemiz(page: Page, etiket: string): Promise<void> {
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-ctrl-attrib').exclude('.maplibregl-canvas').analyze()
  const agir = sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(agir.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), etiket).toEqual([])
}

test('Durum: uyarı geceleri sözcükle (yüksek / orta / düşük), en soğuk saat, kritik eşik, temkin notu ve «nasıl hesaplandı»; sayısal olasılık yok', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Don Bahçesi', lng: 27.96, lat: 38.96, sideM: 200 })
  seedDon(g.id, 'uyari')
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  const yanit = page.waitForResponse((r) => r.url().includes('/don') && r.request().method() === 'GET' && !r.url().includes('goreli'))
  await page.goto(`/bahceler/${g.id}`)
  const govde = JSON.stringify(await (await yanit).json())
  expect(govde).not.toMatch(/"olasilik"/) // kullanıcıya sayı değil sözcük
  const kart = page.getByTestId('don-karti')
  await expect(kart).toBeVisible({ timeout: 30_000 })
  const geceler = page.getByTestId('don-gece')
  await expect(geceler).toHaveCount(3)
  await expect(geceler.nth(0)).toHaveAttribute('data-soz', 'yüksek')
  await expect(geceler.nth(0).getByTestId('don-soz')).toContainText('don olasılığı: yüksek')
  await expect(geceler.nth(0)).toContainText('Bu gece')
  await expect(geceler.nth(0).getByTestId('don-gece-ayrinti')).toContainText('En soğuk saat ≈ 06:00')
  await expect(geceler.nth(0).getByTestId('don-gece-ayrinti')).toContainText(/kritik eşik -?\d,\d °C \((olgun meyve|çiçek|yeni meyve|yeşil meyve)/)
  await expect(geceler.nth(1)).toHaveAttribute('data-soz', 'orta')
  await expect(geceler.nth(2)).toHaveAttribute('data-soz', 'düşük')
  await expect(page.getByTestId('don-temkin')).toContainText('Uyarılarımız bilerek temkinlidir')
  await page.getByTestId('don-nasil').locator('summary').click()
  await expect(page.getByTestId('don-nasil')).toContainText('EN SOĞUĞU')
  await expect(page.getByTestId('don-nasil')).toContainText('ön değer')
  // Ne yapmalı: her önlemin kaynağı (bağlantı) var; uydurma yok
  const onlemler = page.getByTestId('don-onlem')
  expect(await onlemler.count()).toBeGreaterThanOrEqual(4)
  for (const o of await onlemler.all()) {
    const href = await o.getByTestId('don-onlem-kaynak').getAttribute('href')
    expect(href).toMatch(/^https?:\/\//)
  }
  await onlemler.filter({ has: page.locator('[data-kod="ruzgar_makinesi"]') }).count()
  const rm = page.locator('[data-testid="don-onlem"][data-kod="ruzgar_makinesi"]')
  await rm.locator('summary').click()
  await expect(rm).toContainText('inversiyon')
  await expect(rm).toContainText('2,5 m/s')
  await axeTemiz(page, 'durum don kartı')
})

test('düşük risk: «ne yapmalı» çıkmaz; kart sözcüğü «düşük»', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Düşük Risk', lng: 27.97, lat: 38.96, sideM: 200 })
  seedDon(g.id, 'dusuk')
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('don-karti')).toBeVisible({ timeout: 30_000 })
  for (const s of await page.getByTestId('don-gece').all()) await expect(s).toHaveAttribute('data-soz', 'düşük')
  await expect(page.getByTestId('don-onlemler')).toHaveCount(0)
})

test('«Don oldu mu?»: dün uyarı verildiyse sorulur; yanıt Saha Defteri\'ne yazılır ve soru kaybolur', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Soru Bahçesi', lng: 27.98, lat: 38.96, sideM: 200 })
  seedDon(g.id, 'dusuk', '--dun')
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('don-soru')).toBeVisible({ timeout: 30_000 })
  for (const s of ['oldu', 'olmadi', 'bilmiyorum']) await expect(page.getByTestId(`don-yanit-${s}`)).toBeVisible()
  await page.getByTestId('don-yanit-olmadi').click()
  await expect(page.getByTestId('don-soru')).toHaveCount(0)
  await page.goto(`/bahceler/${g.id}/defter`)
  await expect(page.getByTestId('kayit-satiri').first()).toContainText('Don uyarısı geri bildirimi', { timeout: 30_000 })
  await expect(page.getByTestId('kayit-satiri').first()).toContainText('olmadı')
})

test('harita: düz bahçede «bahçe içi soğuk nokta» pasif + neden (rölyef, eğim); dik yamaçta açılır, «göreli, °C değil» etiketi ve 30 m hücre katmanı', async ({ page }) => {
  await newUser(page)
  const duz = await createGarden(page.request, { ad: 'Düz Bahçe', lng: 27.99, lat: 38.96, sideM: 200 })
  seedDon(duz.id, 'dusuk')
  await page.goto(`/bahceler/${duz.id}`)
  await page.getByTestId('katman-dugmesi').click()
  const kutu = page.getByTestId('don-katmani')
  await expect(kutu).toBeDisabled({ timeout: 30_000 })
  await expect(page.getByTestId('don-katmani-neden')).toContainText(/Pasif — rölyef \d+ m \(en az 10 m\), eğim \d,\d° \(en az 3°\): bahçe içi fark ölçülemez/)

  const dik = await createGarden(page.request, { ad: 'Dik Bahçe', lng: 28.0, lat: 38.97, sideM: 200 })
  seedDon(dik.id, 'dusuk', '--dik')
  await page.goto(`/bahceler/${dik.id}`)
  await page.getByTestId('katman-dugmesi').click()
  await expect(page.getByTestId('don-katmani')).toBeEnabled({ timeout: 30_000 })
  await expect(page.getByTestId('don-katmani-neden')).toContainText('Göreli, °C değil')
  await page.getByTestId('don-katmani').check()
  await expect(page.getByTestId('don-lejant')).toContainText('göreli, °C değil')
  await page.waitForFunction(() => Boolean((window as unknown as { __bahcelabHarita?: { getLayer: (id: string) => unknown } }).__bahcelabHarita?.getLayer('don-goreli-dolgu')), undefined, { timeout: 30_000 })
  await axeTemiz(page, 'don katmanı açık, katman menüsü AÇIK')  // menü açıkken (veri yok / pasif satırlar dahil) taranır
})

test('arazi kartı (bahçe bilgisi): sınıf, eğim, bakı; bahçe içi neden', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Arazi Bahçesi', lng: 28.01, lat: 38.97, sideM: 200 })
  seedDon(g.id, 'dusuk', '--dik')
  await page.goto(`/bahceler/${g.id}`)
  await page.getByRole('button', { name: /işlemleri/ }).first().click()
  await page.getByRole('menuitem', { name: 'Bilgileri düzenle' }).click()
  const kart = page.getByTestId('arazi-karti')
  await expect(kart).toBeVisible({ timeout: 30_000 })
  await expect(kart).toHaveAttribute('data-sinif', /yamac|duz|cukur|sirt/)
  await expect(page.getByTestId('arazi-cumle')).toContainText(/eğim \d+,\d°, bakı/)
  await expect(kart).toContainText('sıcaklığa °C olarak eklenmez')
})

test('hasar raporu: don olayında «Hasar raporu hazırla» PDF indirir; olay etiketi görünür; «resmi ekspertiz değildir»', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Rapor Bahçesi', lng: 28.02, lat: 38.97, sideM: 200 })
  seedDon(g.id, 'dusuk', '--olay')
  await page.goto(`/bahceler/${g.id}/gecmis`)
  const satir = page.locator('[data-testid="olay-satiri"][data-tur="don"]').first()
  await expect(satir).toBeVisible({ timeout: 30_000 })
  await satir.getByRole('button').first().click()
  await expect(page.getByTestId('olay-etiket')).toContainText('Olay etiketi')
  await expect(page.getByTestId('olay-etiket')).toContainText('yeniden değerlendirildi')
  await expect(page.getByTestId('hasar-raporu').locator('..')).toContainText('resmi ekspertiz değildir')
  const indirme = page.waitForEvent('download')
  await page.getByTestId('hasar-raporu').click()
  const d = await indirme
  expect(d.suggestedFilename()).toMatch(/^don-hasar-raporu-\d{4}-\d{2}-\d{2}\.pdf$/)
  const yol = await d.path()
  const { readFileSync } = await import('node:fs')
  expect(readFileSync(yol).subarray(0, 5).toString()).toBe('%PDF-')
})

test('bildirim tercihleri: eski «Don uyarısı» yok; «Gece don uyarısı» ve «Don oldu mu?» (iç pilot) var', async ({ page }) => {
  await newUser(page)
  const r = await page.request.get('/api/notifications/tercihler')
  const turler = ((await r.json()) as { tur: string }[]).map((x) => x.tur)
  expect(turler).not.toContain('hava_don')
  expect(turler).toEqual(expect.arrayContaining(['don_uyari', 'don_soru']))
})
