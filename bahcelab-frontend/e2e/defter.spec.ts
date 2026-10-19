import { expect, test } from '@playwright/test'
import { mapPoint, createGarden, newUser, seedOlayOzet, seedSaha, seedScenes } from './yardimcilar'

/** Saha Defteri (9G-B): konumlu kayıtlar + fotoğraf, «Uydu haklı mıydı?» doğrulaması, doğruluk özeti, otomatik saha turu, harita katmanı. */
// 8×6 piksel geçerli JPEG (sunucu Pillow ile doğrular)
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC5RRRXjHGf/9k=', 'base64')

test.describe('Saha Defteri', () => {
  test('açılır: boş tur durumu, olay kartları ve boş kayıt listesi dürüstçe görünür', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Defter Bahçesi', lng: 27.9, lat: 38.9, sideM: 300 })
    seedOlayOzet(garden.id)
    await page.goto(`/bahceler/${garden.id}/defter`)
    await expect(page.getByTestId('defter-baslik')).toHaveText('Saha Defteri')
    await expect(page.getByTestId('tur-bos')).toBeVisible({ timeout: 30_000 }) // açık uyarı yok → uydurma nokta yok
    await expect(page.getByTestId('dogrulama-karti').first()).toBeVisible()
    await expect(page.getByTestId('kayit-bos')).toBeVisible()
    await expect(page.getByTestId('dogruluk-satiri').first()).toHaveAttribute('data-yeterli', 'false') // az doğrulama: oran yok
    await expect(page.getByTestId('dogruluk-tablosu')).toContainText('henüz yeterli doğrulama yok')
  })

  test('haritada nokta işaretlenir, not ve fotoğrafla kayıt eklenir; haritada işaret olarak görünür', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Nokta Kaydı', lng: 27.91, lat: 38.91, sideM: 300 })
    await page.goto(`/bahceler/${garden.id}/defter`)
    await expect(page.getByTestId('kayit-formu')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('kayit-tur-ilaclama').click()
    await page.getByTestId('konum-nokta').click()
    await expect(page.getByTestId('konum-ipucu')).toContainText('dokunarak')
    const p = await mapPoint(page, 10, 10)
    await page.mouse.click(p.x, p.y)
    await expect(page.getByTestId('konum-ipucu')).toContainText('Nokta seçildi')
    await page.getByTestId('kayit-notu').fill('Meyve sineği için bait püskürtme')
    await page.getByTestId('kayit-foto').setInputFiles({ name: 'saha.jpg', mimeType: 'image/jpeg', buffer: JPEG })
    await page.getByTestId('kayit-kaydet').click()
    const satir = page.getByTestId('kayit-satiri').first()
    await expect(satir).toContainText('İlaçlama', { timeout: 30_000 })
    await expect(satir).toContainText('Meyve sineği')
    await expect(satir.getByTestId('foto-serit').locator('img')).toHaveCount(1)
    await expect(page.getByTestId('kayit-isareti')).toHaveCount(1)
    await page.getByTestId('kayit-katmani').uncheck() // ayrı katman: kapatınca işaret kalkar
    await expect(page.getByTestId('kayit-isareti')).toHaveCount(0)
  })

  test('alan kaydı en az 3 köşeyle kaydedilir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Alan Kaydı', lng: 27.92, lat: 38.92, sideM: 300 })
    await page.goto(`/bahceler/${garden.id}/defter`)
    await expect(page.getByTestId('kayit-formu')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('kayit-tur-sulama').click()
    await page.getByTestId('konum-alan').click()
    await expect(page.getByTestId('kayit-kaydet')).toBeDisabled() // köşe yok
    for (const [dx, dy] of [[-30, -20], [40, -20], [10, 40]] as const) {
      const p = await mapPoint(page, dx, dy)
      await page.mouse.click(p.x, p.y)
    }
    await expect(page.getByTestId('konum-ipucu')).toContainText('3 köşe')
    await page.getByTestId('kayit-kaydet').click()
    await expect(page.getByTestId('kayit-satiri').first()).toContainText('alan', { timeout: 30_000 })
  })

  test('«Uydu haklı mıydı?» yanıtı kaydedilir; kart yanıtlanmış olur, özet ve Geçmiş çizelgesi yanıtı gösterir', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Doğrulama', lng: 27.93, lat: 38.93, sideM: 300 })
    seedScenes(garden.id)
    seedOlayOzet(garden.id)
    await page.goto(`/bahceler/${garden.id}/defter`)
    const kart = page.locator('[data-testid="dogrulama-karti"][data-durum="olay"]').first()
    await expect(kart).toBeVisible({ timeout: 30_000 })
    const bekleyenOnce = await page.getByTestId('kartlar-bekleyen').innerText()
    await kart.getByTestId('sonuc-gerceklesti').click()
    await expect(kart.getByTestId('dogrulama-formu')).toBeVisible()
    await kart.getByTestId('dogrulama-formu').locator('textarea').fill('Sabah çiğ donmuştu')
    await kart.getByTestId('dogrulama-foto').setInputFiles({ name: 'don.jpg', mimeType: 'image/jpeg', buffer: JPEG })
    await kart.getByTestId('dogrulama-kaydet').click()
    await page.getByTestId('kartlar-hepsi').click()
    const yanit = page.locator('[data-testid="dogrulama-karti"][data-sonuc="gerceklesti"]')
    await expect(yanit).toHaveCount(1, { timeout: 30_000 })
    await expect(yanit.getByTestId('dogrulama-yanit')).toContainText('Sabah çiğ donmuştu')
    await expect(yanit.getByTestId('foto-serit').locator('img')).toHaveCount(1)
    expect(await page.getByTestId('kartlar-bekleyen').innerText()).not.toBe(bekleyenOnce) // bekleyen sayısı azaldı
    await expect(page.getByTestId('dogruluk-tablosu')).toContainText('(1/5)') // 1 doğrulama: yeterli değil
    await page.goto(`/bahceler/${garden.id}/gecmis`)
    await expect(page.getByTestId('olay-dogrulama-rozeti').first()).toContainText('gerçekleşti', { timeout: 30_000 })
  })

  test('saha turu: uyarı noktaları en yakın sırayla listelenir, not + fotoğrafla ziyaret edilir ve geri alınır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Saha Turu', lng: 27.94, lat: 38.94, sideM: 300 })
    seedSaha(garden.id)
    await page.goto(`/bahceler/${garden.id}/defter`)
    await expect(page.getByTestId('tur-noktasi')).toHaveCount(2, { timeout: 30_000 })
    await expect(page.getByTestId('tur-baslik')).toContainText('2 nokta')
    await expect(page.getByTestId('tur-isareti')).toHaveCount(2)
    await page.getByTestId('tur-noktasi').first().getByRole('button').first().click()
    await page.getByTestId('tur-notu').fill('Yaprak ucu kurumuş, birkaç ağaç')
    await page.getByTestId('tur-foto').setInputFiles({ name: 'tur.jpg', mimeType: 'image/jpeg', buffer: JPEG })
    await page.getByTestId('tur-kaydet').click()
    await expect(page.getByTestId('tur-ilerleme')).toHaveText('1/2 tamam', { timeout: 30_000 })
    await expect(page.locator('[data-testid="tur-noktasi"][data-ziyaret="true"]')).toHaveCount(1)
    await expect(page.getByTestId('kayit-satiri').first()).toContainText('Yaprak ucu kurumuş')
    await expect(page.getByTestId('tur-baslik')).toContainText('1 nokta') // ziyaret edilen rotadan çıkar
    const baslik = page.locator('[data-testid="tur-noktasi"][data-ziyaret="true"]').getByRole('button').first()
    if ((await baslik.getAttribute('aria-expanded')) === 'false') await baslik.click() // ziyaretten sonra nokta açık kalabilir
    await page.getByTestId('tur-kayda-git').click()
    await page.getByTestId('tur-geri-al').click()
    await expect(page.getByTestId('tur-ilerleme')).toHaveText('0/2 tamam', { timeout: 30_000 })
  })

  test('çalışma alanı haritasında saha kayıtları ayrı katman olarak açılıp kapanır', async ({ page }) => {
    await newUser(page)
    const garden = await createGarden(page.request, { ad: 'Katman Bahçesi', lng: 27.95, lat: 38.95, sideM: 300 })
    const kayit = await page.request.post(`/api/gardens/${garden.id}/saha-kayitlari`, { data: { tur: 'gozlem', tarih: new Date().toISOString().slice(0, 10), konum: { type: 'Point', coordinates: [27.95, 38.95] }, aciklama: 'Katman denemesi' } })
    expect(kayit.status()).toBe(201)
    await page.goto(`/bahceler/${garden.id}`)
    await expect(page.getByTestId('harita-paneli')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('kayit-isareti')).toHaveCount(0) // varsayılan kapalı
    await page.getByTestId('katman-menusu').getByRole('button').first().click()
    await page.getByTestId('saha-katmani').check()
    await expect(page.getByTestId('kayit-isareti')).toHaveCount(1, { timeout: 30_000 })
  })
})
