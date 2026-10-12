import { expect, test } from '@playwright/test'
import { createGarden, newUser, seedScenes } from './yardimcilar'

/**
 * Performans eşikleri (aşılırsa test kırmızı). Başsız ortamda yazılım oluşturucu (SwiftShader) kullanıldığı için 60 fps hedefi
 * gerçek GPU'da, burada ortam değişkeniyle ayarlanabilen taban değer sınanır; ölçülen değerler rapora yazılır.
 *   E2E_KATMAN_MAKS_MS (varsayılan 150) · E2E_FPS_MIN (varsayılan 30) · E2E_KARE_P95_MAKS_MS (varsayılan 66)
 */
const KATMAN_MAKS_MS = Number(process.env.E2E_KATMAN_MAKS_MS ?? 150)
const FPS_MIN = Number(process.env.E2E_FPS_MIN ?? 30)
const KARE_P95_MAKS_MS = Number(process.env.E2E_KARE_P95_MAKS_MS ?? 66)

const medyan = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]

test('katman değişimi eşik altında ve harita sürüklenirken kare hızı yeterli', async ({ page }, testInfo) => {
  await newUser(page)
  const garden = await createGarden(page.request, { ad: 'Performans', lng: 27.99, lat: 38.99, sideM: 300 })
  seedScenes(garden.id)
  await page.goto(`/bahceler/${garden.id}`)
  await expect(page.getByTestId('histogram-lejant')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)

  // 1) Katman değişimi: tıklama → ilk karede boyanmış katman. Canlılık ↔ Yaprak suyu ↔ Değişim, birkaç tur.
  const menu = page.getByTestId('katman-menusu')
  const sureler: number[] = []
  const sirasi = ['yaprakSuyu', 'klorofil', 'yaprakAlani', 'tacToprak', 'degisim', 'canlilik', 'yaprakAlani', 'tacToprak', 'klorofil', 'yaprakSuyu', 'canlilik'] as const
  for (const hedef of sirasi) {
    await menu.getByRole('button', { name: /Canlılık|Klorofil|Yaprak alanı|Taç ve toprak|Yaprak suyu|Bölgeler|Değişim/ }).first().click()
    await page.evaluate(() => {
      performance.clearMarks('katman-boyandi')
      ;(window as unknown as { __t0: number }).__t0 = performance.now()
    })
    await page.getByTestId(`katman-${hedef}`).click()
    const ms = await page.evaluate(async () => {
      for (let i = 0; i < 100; i++) {
        const m = performance.getEntriesByName('katman-boyandi').pop()
        if (m) return m.startTime - (window as unknown as { __t0: number }).__t0
        await new Promise((r) => setTimeout(r, 20))
      }
      return -1
    })
    expect(ms, `${hedef} katmanı boyanmadı`).toBeGreaterThan(0)
    sureler.push(ms)
  }
  const med = medyan(sureler)
  const max = Math.max(...sureler)

  // 2) Harita sürükleme: rAF kare süreleri
  const box = await page.getByTestId('harita-paneli').boundingBox()
  if (!box) throw new Error('harita yok')
  await page.evaluate(() => {
    const w = window as unknown as { __kareler: number[]; __dur: boolean }
    w.__kareler = []
    w.__dur = false
    let son = performance.now()
    const tick = (t: number) => {
      w.__kareler.push(t - son)
      son = t
      if (!w.__dur) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  const basla = Date.now()
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(cx + Math.sin(i / 6) * 120, cy + Math.cos(i / 6) * 80)
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  const sureMs = Date.now() - basla
  const kareler = await page.evaluate(() => {
    const w = window as unknown as { __kareler: number[]; __dur: boolean }
    w.__dur = true
    return w.__kareler.slice(2)
  })
  const fps = (kareler.length / sureMs) * 1000
  const sirali = [...kareler].sort((a, b) => a - b)
  const p95 = sirali[Math.floor(sirali.length * 0.95)] ?? 0

  const sonuc = { katmanMedyanMs: Math.round(med), katmanMaksMs: Math.round(max), katmanOlcumleri: sureler.map(Math.round), fps: Math.round(fps * 10) / 10, kareP95Ms: Math.round(p95), esikler: { KATMAN_MAKS_MS, FPS_MIN, KARE_P95_MAKS_MS } }
  console.log('PERFORMANS ' + JSON.stringify(sonuc))
  await testInfo.attach('performans.json', { body: JSON.stringify(sonuc, null, 2), contentType: 'application/json' })

  expect(med, `katman değişimi medyanı ${Math.round(med)} ms (eşik ${KATMAN_MAKS_MS})`).toBeLessThan(KATMAN_MAKS_MS)
  expect(fps, `harita fps ${fps.toFixed(1)} (eşik ${FPS_MIN})`).toBeGreaterThanOrEqual(FPS_MIN)
  expect(p95, `kare süresi p95 ${Math.round(p95)} ms (eşik ${KARE_P95_MAKS_MS})`).toBeLessThan(KARE_P95_MAKS_MS)
})
