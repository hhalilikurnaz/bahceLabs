import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { animasyonlarBitsin, createGarden, newUser, seedIzleme } from './yardimcilar'

/** İç izleme ekranı (9J Dilim 2, ADR 0030): GERÇEK arka uç + gerçek izleme işlerinin yazdığı anlık görüntüler. Kullanıcıya gösterilmez. */
async function axeTemiz(page: Page, etiket: string): Promise<void> {
  await animasyonlarBitsin(page)
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const agir = sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(agir.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), etiket).toEqual([])
}

for (const tema of ['acik', 'koyu'] as const) {
  test(`iç izleme (${tema} tema): beş sekme, akış tablosu + zaman çizelgesi, uyum, kurallar, bahçe güveni; axe temiz`, async ({ page }) => {
    test.setTimeout(240_000) // gerçek izleme işleri (7 gün × günlük + 4 hafta × haftalık) CI'da yavaş başlar
    await page.addInitScript((t) => localStorage.setItem('bahcelab.tema', t), tema)
    await newUser(page)
    await createGarden(page.request, { ad: 'İzleme Bahçesi', lng: 27.93, lat: 38.71, sideM: 300 })
    seedIzleme(7)
    await page.goto('/ic/kalite')
    await expect(page.getByTestId('ic-izleme')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('tab')).toHaveCount(5)

    // Akışlar (varsayılan): 11 akış satırı, her satırın durumu var; zaman çizelgesinde akış başına bir satır
    await expect(page.getByTestId('akis-satir')).toHaveCount(11, { timeout: 30_000 })
    await expect(page.getByTestId('akis-zaman-satir')).toHaveCount(11)
    await expect(page.locator('[data-testid="akis-zaman-satir"] [role="img"]').first()).toHaveAttribute('aria-label', /günde \d+ taze/)
    await axeTemiz(page, `${tema} akislar`)

    // Kaynak uyumu: bahçeye özgü seriler; veri yokken «yetersiz» (grafik uydurulmaz)
    await page.getByTestId('sekme-uyum').click()
    await expect(page.getByTestId('ic-uyum')).toBeVisible()
    await expect(page.getByTestId('uyum-seri').first()).toHaveAttribute('data-durum', /yetersiz|uyumlu|drift/)
    await expect(page.getByTestId('uyum-bos').first()).toBeVisible()
    await axeTemiz(page, `${tema} uyum`)

    // Kurallar: tüm kurallar listelenir; yanıt yokken «ölçülemiyor»
    await page.getByTestId('sekme-kurallar').click()
    await expect(page.getByTestId('kural-satir').first()).toBeVisible()
    await expect(page.locator('[data-testid="kural-satir"][data-kural="sistem_kontrol"]')).toHaveAttribute('data-durum', 'olculemiyor')
    await axeTemiz(page, `${tema} kurallar`)

    // Bahçeler: dağılımın toplamı bahçe sayısı; bahçe satırında eksik koşullar
    await page.getByTestId('sekme-bahceler').click()
    await expect(page.getByTestId('guven-dagilim')).toBeVisible()
    await expect(page.getByTestId('bahce-satir')).toHaveCount(1)
    await expect(page.getByTestId('bahce-satir')).toContainText('Uydu görüntüsü')
    await axeTemiz(page, `${tema} bahceler`)

    // ETa (mevcut 1A ekranı) sekme olarak duruyor
    await page.getByTestId('sekme-eta').click()
    await expect(page.getByTestId('panel-eta')).toBeVisible()
    await expect(page.getByTestId('ic-bos')).toBeVisible({ timeout: 30_000 })
    await axeTemiz(page, `${tema} eta`)
  })
}

test('klavye: oklarla sekme değişir; adres sekmeyi taşır', async ({ page }) => {
  await newUser(page)
  await page.goto('/ic/kalite?sekme=kurallar')
  await expect(page.getByTestId('sekme-kurallar')).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 })
  await page.getByTestId('sekme-kurallar').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('sekme-bahceler')).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/sekme=bahceler/)
})

test('kullanıcıya tek satır «Veri durumu»: veri bozukken görünür, sadece bir satır, güven etiketiyle aynı servisten', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Veri Durumu Bahçesi', lng: 27.94, lat: 38.72, sideM: 200 })
  await page.route('**/api/gardens/*/weather', (route) => route.abort())
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('durum-karti')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('veri-durumu-satiri')).toHaveCount(1)
  await expect(page.getByTestId('veri-durumu-satiri')).toContainText(/Uydu görüntüsü|Hava verisi|Veri akışı|henüz/)
  const durum = await (await page.request.get(`/api/gardens/${g.id}/durum`)).json()
  expect(typeof durum.veri_durumu).toBe('string')
  expect(String(durum.veri_durumu).split('\n')).toHaveLength(1)
})
