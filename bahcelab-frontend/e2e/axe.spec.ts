import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

/** axe-core (WCAG 2.1 A/AA): ciddi ve kritik ihlal 0 olmalı. Harita telifi (Mapbox/OSM yükümlülüğü) ve tuval hariç. */
async function taraYaz(page: Page, etiket: string): Promise<void> {
  const sonuc = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.maplibregl-ctrl-attrib')
    .exclude('.maplibregl-canvas')
    .analyze()
  const agir = sonuc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(agir.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), etiket).toEqual([])
}

for (const tema of ['acik', 'koyu'] as const) {
  test.describe(`axe — ${tema} tema`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('bahcelab.tema', t), tema)
    })

    test('durum, analiz, hava ve tam sayfalar', async ({ page }) => {
      await newUser(page)
      const garden = await createGarden(page.request, { ad: 'Axe Bahçesi', lng: 27.95, lat: 38.95, sideM: 200 })
      seedScenes(garden.id)
      await page.route('**/api/gardens/*/weather', (route) => route.abort())
      for (const [yol, hazir] of [
        [`/bahceler/${garden.id}`, 'durum-karti'],
        [`/bahceler/${garden.id}/analiz`, 'analiz-yok'],
        [`/bahceler/${garden.id}/gecmis`, 'gecmis-sayfasi'],
        [`/bahceler/${garden.id}/defter`, 'defter-sayfasi'],
        [`/bahceler/${garden.id}/su`, 'sulama-karti'],
      ] as const) {
        await page.goto(yol)
        await expect(page.getByTestId(hazir)).toBeVisible({ timeout: 30_000 })
        await taraYaz(page, `${tema} ${yol}`)
      }
    })

    test('katman menüsü açıkken ve nokta incelemede', async ({ page }) => {
      await newUser(page)
      const garden = await createGarden(page.request, { ad: 'Axe Katman', lng: 27.96, lat: 38.96, sideM: 200 })
      seedScenes(garden.id)
      await page.goto(`/bahceler/${garden.id}`)
      await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
      await page.getByTestId('katman-menusu').getByRole('button', { name: /Canlılık/ }).click()
      await expect(page.getByTestId('katman-bolgeler')).toBeVisible()
      await taraYaz(page, `${tema} katman menüsü`)
      await page.keyboard.press('Escape')
      const box = await page.getByTestId('harita-paneli').boundingBox()
      if (!box) throw new Error('harita yok')
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55)
      await expect(page.getByRole('dialog', { name: 'Nokta incelemesi' })).toBeVisible()
      await taraYaz(page, `${tema} nokta inceleme`)
    })

    test('giriş sayfası', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await taraYaz(page, `${tema} giriş`)
    })
  })
}
