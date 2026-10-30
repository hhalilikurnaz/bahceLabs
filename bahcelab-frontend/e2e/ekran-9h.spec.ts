import { test } from '@playwright/test'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createGarden, newUser, seedScenes, seedWater } from './yardimcilar'

/**
 * EKRAN GÖRÜNTÜSÜ + HAREKET KAYDI aracı (test değil): Sulama planı (9H) ekranları 1440/1024/390 ve sezon animasyonu (webm).
 * Veri: test tohumlu bahçe (ERA5/toprak/uydu serisi `tests/support`; ürün kodunda sahte veri yok). Yalnız `EKRAN_CIKTI=<klasör>` verilince koşar.
 */
test.skip(!process.env.EKRAN_CIKTI, 'ekran görüntüsü aracı: EKRAN_CIKTI verilince çalışır')

test('9H: Sulama planı ekranları ve sezon animasyonu (test tohumlu, açık tema)', async ({ page, browser }) => {
  test.setTimeout(420_000)
  const cikti = process.env.EKRAN_CIKTI as string
  mkdirSync(join(cikti, 'hareket'), { recursive: true })
  await page.emulateMedia({ colorScheme: 'light' })
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Tohumlu Narenciye', lng: 27.81, lat: 38.71, sideM: 300 })
  seedScenes(g.id)
  seedWater(g.id)
  await page.request.patch(`/api/gardens/${g.id}`, { data: { agac_sayisi: 2200 } })
  await page.request.put(`/api/gardens/${g.id}/sulama-profili`, { data: { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke', kwh_fiyat_tl: 3.2 } })
  const bugun = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
  await page.request.post(`/api/gardens/${g.id}/saha-kayitlari`, { data: { tur: 'sulama', tarih: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10), ayrinti: { sure_dk: 360 } } })
  for (const [ad, width, height] of [['1440', 1440, 900], ['1024', 1024, 768], ['390', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    const tam = async (dosya: string) => {
      await page.waitForTimeout(900)
      await page.setViewportSize({ width, height: 2600 })
      await page.waitForTimeout(500)
      await page.getByTestId('sulama-plani-sayfasi').screenshot({ path: join(cikti, `${dosya}-${ad}.png`) })
      await page.setViewportSize({ width, height })
    }
    await page.goto(`/bahceler/${g.id}/sulama-plani`)
    await page.getByTestId('kova-grafigi').waitFor({ timeout: 45_000 })
    await tam('u9h-plan')
    await page.getByTestId('sulama-bolum-maliyet').click()
    await page.getByTestId('sezon-aralik-m3').waitFor({ timeout: 30_000 })
    await tam('u9h-maliyet')
    await page.getByTestId('sulama-bolum-senaryo').click()
    await page.getByTestId('senaryo-kuru-islak').waitFor({ timeout: 45_000 })
    await page.getByRole('button', { name: 'Pzt' }).click()
    await page.getByRole('button', { name: 'Per' }).click()
    await page.getByTestId('aliskanlik-saat').fill('4')
    await page.getByTestId('sistem-hedef').selectOption('salma')
    await page.getByTestId('sistem-yatirim').fill('120000')
    await page.getByTestId('aliskanlik-fark-m3').waitFor({ timeout: 30_000 })
    await page.getByTestId('sistem-fark-m3').waitFor({ timeout: 30_000 })
    await tam('u9h-senaryo')
    await page.goto(`/bahceler/${g.id}/sulama-plani`)
    await page.getByTestId('sulama-bilgileri').click()
    await page.getByTestId('sulama-sihirbazi').waitFor()
    await page.getByTestId('sihirbaz-ileri').click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(cikti, `u9h-sihirbaz-${ad}.png`) })
    await page.keyboard.press('Escape')
    await page.goto(`/bahceler/${g.id}/su`)
    await page.getByTestId('sulama-karti').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: join(cikti, `u9h-su-${ad}.png`) })
    await page.goto(`/bahceler/${g.id}`)
    await page.getByTestId('bugun-sulama-satiri').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: join(cikti, `u9h-bugun-${ad}.png`) })
  }
  // hata/boş durum: profilsiz bahçe
  await page.setViewportSize({ width: 1440, height: 900 })
  const bos = await createGarden(page.request, { ad: 'Profilsiz Bahçe', lng: 27.83, lat: 38.73, sideM: 200 })
  await page.goto(`/bahceler/${bos.id}/sulama-plani`)
  await page.getByTestId('sulama-profil-yok').waitFor({ timeout: 30_000 })
  await page.screenshot({ path: join(cikti, 'u9h-profil-yok-1440.png') })
  // animasyon kaydı (webm) ve anahtar kareler
  const durum = await page.context().storageState()
  for (const [ad, w, h, azalt] of [['sezon-animasyonu-1440', 1440, 900, false], ['sezon-animasyonu-390', 390, 844, false], ['sezon-animasyonu-azaltilmis-1440', 1440, 900, true]] as const) {
    const dir = join(cikti, '.tmp-' + ad)
    rmSync(dir, { recursive: true, force: true })
    const ctx = await browser.newContext({ storageState: durum, viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } }, locale: 'tr-TR', reducedMotion: azalt ? 'reduce' : 'no-preference', baseURL: process.env.E2E_WEB_URL ?? undefined })
    const p = await ctx.newPage()
    await p.goto(`${page.url().split('/bahceler')[0]}/bahceler/${g.id}/sulama-plani`)
    const a = p.getByTestId('sezon-anim')
    await a.scrollIntoViewIfNeeded()
    await a.getByTestId('anim-gun').waitFor({ timeout: 45_000 })
    if (azalt) {
      for (let k = 0; k < 14; k++) { await a.getByTestId('anim-hafta').click(); await p.waitForTimeout(450) }
    } else {
      await a.getByTestId('anim-oynat').click()
      for (let k = 1; k <= 6; k++) { await p.waitForTimeout(2500); await a.screenshot({ path: join(cikti, 'hareket', `${ad}-kare-${k}.png`) }) }
    }
    await p.waitForTimeout(800)
    await ctx.close()
    const f = readdirSync(dir).find((x) => x.endsWith('.webm'))
    if (f) renameSync(join(dir, f), join(cikti, 'hareket', `${ad}.webm`))
    rmSync(dir, { recursive: true, force: true })
  }
})
