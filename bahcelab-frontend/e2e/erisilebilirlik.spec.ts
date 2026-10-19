import { expect, test, type Page } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

interface Issue {
  kind: string
  detail: string
}

/** Sayfadaki etkileşimli öğeleri tarar: erişilebilir ad, dokunma hedefi (≥44 px), görsel alt metni, başlık yapısı. */
async function audit(page: Page, options: { touch: boolean }): Promise<Issue[]> {
  return page.evaluate(({ touch }) => {
    const issues: { kind: string; detail: string }[] = []
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const style = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !el.closest('[inert],[aria-hidden="true"]')
    }
    const nameOf = (el: HTMLElement): string => {
      const aria = el.getAttribute('aria-label')
      if (aria) return aria
      const by = el.getAttribute('aria-labelledby')
      if (by) return by.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        const label = el.labels?.[0]?.textContent?.trim()
        if (label) return label
      }
      return (el.textContent ?? '').trim() || el.getAttribute('title') || ''
    }
    const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String((el as HTMLElement).className).split(' ').slice(0, 3).join('.')}`

    const interactive = document.querySelectorAll<HTMLElement>('a[href],button,input:not([type=hidden]),select,textarea,[role=tab],[role=slider],[role=separator][tabindex],[role=switch]')
    for (const el of interactive) {
      if (!visible(el)) continue
      if (!nameOf(el)) issues.push({ kind: 'ad-yok', detail: describe(el) })
      if (touch) {
        const r = el.getBoundingClientRect()
        const inline = el.tagName === 'A' && el.closest('p,li,span') && getComputedStyle(el).display === 'inline'
        const sr = el.classList.contains('sr-only') || (el instanceof HTMLInputElement && el.type === 'checkbox')
        const attribution = el.closest('.maplibregl-ctrl-attrib')
        if (!inline && !sr && !attribution && (r.height < 43.5 || r.width < 43.5) && !(el.tagName === 'A' && r.height >= 43.5)) {
          issues.push({ kind: 'hedef-küçük', detail: `${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)} "${nameOf(el).slice(0, 24)}"` })
        }
      }
    }
    for (const img of document.querySelectorAll('img')) {
      if (visible(img) && !img.hasAttribute('alt')) issues.push({ kind: 'alt-yok', detail: describe(img) })
    }
    if (document.querySelectorAll('h1').length === 0) issues.push({ kind: 'h1-yok', detail: location.pathname })
    return issues
  }, options)
}

/** Klavyeyle gezerken odaklanan her öğede görünür bir odak göstergesi (outline/box-shadow) olmalı. */
async function focusIndicators(page: Page, steps: number): Promise<Issue[]> {
  const issues: Issue[] = []
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const outline = parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== 'none'
      const ring = s.boxShadow !== 'none'
      const parentRing = !!el.closest('label')?.querySelector(':focus-visible + *') // sr-only girdi + görsel anahtar
      return { outline, ring, parentRing, label: `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}`, sr: el.classList.contains('sr-only') || el.classList.contains('peer') }
    })
    if (info && !info.outline && !info.ring && !info.parentRing && !info.sr) issues.push({ kind: 'odak-yok', detail: info.label })
  }
  return issues
}

test('giriş sayfası: adlar, başlık, odak göstergesi', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await audit(page, { touch: false })).toEqual([])
  expect(await focusIndicators(page, 8)).toEqual([])
})

test('çalışma alanı (masaüstü): adlar, odak göstergesi, etiketli harita denetimleri', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Erişim', lng: 27.5, lat: 38.5, sideM: 200 })
  seedScenes(g.id)
  await page.goto(`/bahceler/${g.id}`)
  await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
  for (const name of ['Yakınlaştır', 'Uzaklaştır', 'Bahçeye dön', 'Önceki görüntü', 'Katman opaklığı']) {
    await expect(page.getByRole(name === 'Katman opaklığı' ? 'slider' : 'button', { name })).toBeVisible()
  }
  expect(await audit(page, { touch: false })).toEqual([])
  expect(await focusIndicators(page, 40)).toEqual([])
})

test('geçmiş ve saha defteri sayfaları: adlar ve odak', async ({ page }) => {
  await newUser(page)
  const g = await createGarden(page.request, { ad: 'Erişim Sayfa', lng: 27.55, lat: 38.55, sideM: 200 })
  for (const yol of ['gecmis', 'defter']) {
    await page.goto(`/bahceler/${g.id}/${yol}`)
    await expect(page.getByTestId(yol === 'gecmis' ? 'gecmis-sayfasi' : 'defter-sayfasi')).toBeVisible()
    expect(await audit(page, { touch: false })).toEqual([])
    expect(await focusIndicators(page, 20)).toEqual([])
  }
})

test.describe('mobil 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('dokunma hedefleri ≥ 44 px ve adlar tam (çalışma alanı)', async ({ page }) => {
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Mobil Erişim', lng: 27.6, lat: 38.6, sideM: 200 })
    seedScenes(g.id)
    await page.goto(`/bahceler/${g.id}`)
    await expect(page.getByTestId('lejant-cip')).toBeVisible({ timeout: 30_000 }) // telefonda lejant küçük çip
    expect(await audit(page, { touch: true })).toEqual([])
    await page.getByTestId('lejant-cip').click() // açık lejant da dokunma hedeflerini karşılar
    await expect(page.getByTestId('histogram-lejant')).toBeVisible()
    expect(await audit(page, { touch: true })).toEqual([])
  })

  test('sezon grafiği: çeyrek ay etiketleri, şerit boyunca dokunma haritayı o aya götürür; aya git düğmeleri yalnız ekran okuyucuda', async ({ page }) => {
    await newUser(page)
    const g = await createGarden(page.request, { ad: 'Mobil Sezon', lng: 27.61, lat: 38.61, sideM: 200 })
    seedScenes(g.id)
    await page.goto(`/bahceler/${g.id}`)
    const sezon = page.getByTestId('sezon-egrisi')
    await sezon.scrollIntoViewIfNeeded()
    await expect(sezon.getByTestId('eksen-ay')).toHaveCount(4)
    await expect(sezon.getByTestId('ay-3')).toHaveClass(/sr-only/)
    const kutu = await sezon.getByTestId('sezon-dokunma').boundingBox()
    if (!kutu) throw new Error('dokunma şeridi yok')
    await page.mouse.click(kutu.x + kutu.width * (2.5 / 12), kutu.y + 40) // Mart
    await expect(page.getByTestId('tarih-kutusu')).toContainText('Mar')
    expect(await audit(page, { touch: true })).toEqual([])
  })
})
