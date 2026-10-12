import { expect, test } from '@playwright/test'
import { createGarden, newUser } from './yardimcilar'

test('Bugün kartı: ikon · başlık · kısa açıklama · sağda tek eylem', async ({ page }) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Bugün Bahçesi', lng: 27.7, lat: 38.7 })
  await page.route('**/api/gardens/*/bugun', (route) =>
    route.fulfill({
      json: {
        tarih: '2026-10-12',
        maddeler: [
          {
            tur: 'zararli_riski',
            oncelik: 'bilgi',
            baslik: 'Akdeniz meyve sineği',
            metin: 'Meyve sineği için koşullar uygun – tuzakları kontrol edin.',
            sekme: 'hava',
            ayrinti: '2. kuşak, döngünün %45\'i; son 10 günün %90\'ında sıcaklık aktif aralıkta. (Risk tahminidir, teşhis değildir.)',
          },
          { tur: 'ilaclama', oncelik: 'bilgi', baslik: 'İlaçlama: bugün 07:30–10:00, yarın 07:15–09:00', metin: 'Rüzgâr, yağış ve sıcaklığa göre en uygun gündüz saatleri.', sekme: 'hava', ayrinti: null },
        ],
      },
    }),
  )
  await page.goto(`/bahceler/${garden.id}`)
  const card = page.getByTestId('today-card')
  await expect(card.getByTestId('today-item')).toHaveCount(2)
  const risk = card.locator('[data-kind="zararli_riski"]')
  await expect(risk).toContainText('Akdeniz meyve sineği')
  await expect(risk).toContainText('Meyve sineği için koşullar uygun – tuzakları kontrol edin.')
  await expect(risk).not.toContainText('GDD')
  // Satır = ikon + başlık + kısa açıklama + sağda TEK eylem; «Ayrıntı» ve tekrarlayan «… sekmesine git» bağlantıları yok
  await expect(risk.getByTestId('today-action')).toHaveCount(1)
  await expect(risk.getByTestId('today-action')).toHaveText('Hava')
  await expect(card.getByText('Ayrıntı')).toHaveCount(0)
  await expect(card.getByText(/sekmesine git/)).toHaveCount(0)
  await expect(card.locator('[data-kind="ilaclama"]')).toContainText('İlaçlama: bugün 07:30–10:00, yarın 07:15–09:00')
  await expect(card.getByTestId('today-action')).toHaveCount(2)
  await risk.getByTestId('today-action').click()
  await expect(page).toHaveURL(new RegExp(`/bahceler/${garden.id}/hava$`))
})
