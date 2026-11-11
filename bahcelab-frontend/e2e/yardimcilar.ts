import { execFileSync } from 'node:child_process'
import { backendEnv } from './ortam'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

/** Axe, süren (sonlu) animasyonlar bitmeden koşarsa yarı saydam öğeler için sahte «color-contrast» üretir (CI'da aralıklı düşme; kök neden): önce bitmelerini bekler. */
export async function animasyonlarBitsin(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().endTime ?? 0) === Infinity), undefined, { timeout: 10_000 })
}

export const PASSWORD = 'test1234'

/** Karelik bahçe (kenar ≈ metre) — belirli bir yer değil, test için rastgele ofsetli. */
export function square(lng: number, lat: number, sideM: number): GeoJSON.Polygon {
  const dLat = sideM / 2 / 110950
  const dLng = sideM / 2 / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring = [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
  ]
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
}

/** Her test kendi kullanıcısını açar (e-posta `e2e-…@example.test`); çerezler sayfada kalır. */
export async function newUser(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`
  const response = await page.request.post('/api/auth/register', { data: { name: 'E2E Test', email, password: PASSWORD } })
  expect(response.status()).toBe(201)
  return email
}

export async function createGarden(
  request: APIRequestContext,
  body: { ad: string; lng: number; lat: number; sideM?: number },
): Promise<{ id: string }> {
  const response = await request.post('/api/gardens', {
    data: { ad: body.ad, urun: 'limon', geometry: square(body.lng, body.lat, body.sideM ?? 150), il: 'Test', ilce: 'Test' },
  })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

/**
 * Bahçeye gerçek işleme hattından geçen örnek uydu serisi yazar (yalnızca TEST aracı; ürün kodunda sahte veri yoktur).
 * `flat`: mekânsal deseni olmayan, homojen bahçe.
 */
export function seedScenes(gardenId: string, options: { flat?: boolean } = {}): void {
  execFileSync(
    '../bahcelab-backend/.venv/bin/python',
    ['-m', 'tests.support.seed_scenes', gardenId, ...(options.flat ? ['--flat'] : [])],
    { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 180_000, maxBuffer: 512 * 1024 * 1024 }, // takılırsa test hata verir (sonsuz beklemez)
  )
  seedAcquisitions(gardenId) // harita, sezon eğrisi ve normal bantlar TEK veri hattından (edinimler) beslenir
}

/** Test aracı: bahçeye 2017'den bugüne ay başına 2 net edinim + normal bantlar (sentetik desen; gerçek depolama ve bant hesabı). */
export function seedAcquisitions(gardenId: string): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_acquisitions', gardenId], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 180_000, maxBuffer: 512 * 1024 * 1024 })
}

/** Test aracı: bahçeye radar serisi (sahte radar sağlayıcısı + gerçek doldurma hattı; son haftalarda olay adayı). */
export function seedRadar(gardenId: string, options: { eskiOptik?: boolean; bulutlu?: boolean } = {}): void {
  const flags = [...(options.eskiOptik ? ['--eski-optik'] : []), ...(options.bulutlu ? ['--bulutlu'] : [])]
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_radar', gardenId, ...flags], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 240_000, maxBuffer: 512 * 1024 * 1024 }) // API_DEBUG açıkken SQL günlüğü büyük çıktı üretir
}

/** Test aracı: bahçeye ERA5 günlük serisi, toprak profili ve Landsat yüzey sıcaklığı yazar (ağsız; gerçek su dengesi ve hat çalışır). */
export function seedWater(gardenId: string): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_water', gardenId], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 240_000, maxBuffer: 512 * 1024 * 1024 })
}

/** Test aracı: son N günü (bugün dahil) «geçici» (ERA5 kesinleşmemiş) yapar; `kesinlestirMm` verilirse o günleri kesinleştirir ve yağışı yazar. */
export function seedGecici(gardenId: string, n: number, kesinlestirMm?: number): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_gecici', gardenId, String(n), ...(kesinlestirMm !== undefined ? ['--kesinlestir', String(kesinlestirMm)] : [])], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 120_000 })
}

/** Test aracı: bahçeye taze olaylar (kritik don + önemli aşırı yağış) yazar; bildirimler karar katmanından geçer, günlük özet üretilir. */
export function seedOlayOzet(gardenId: string): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_olay_ozet', gardenId], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 180_000, maxBuffer: 512 * 1024 * 1024 })
}

/** Test aracı: bahçenin yakınına test istasyonu ve dünün gerçek-gözlem min sıcaklığını yazar (bağımsız dış kanıt; yağış verisi yok). */
export function seedIstasyon(gardenId: string, tmin: number): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_istasyon', gardenId, String(tmin)], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 180_000, maxBuffer: 512 * 1024 * 1024 })
}

/** Test aracı: saha turu için bahçeye iki «doğrulama bekliyor» olayı (yama merkezleriyle) yazar. */
export function seedSaha(gardenId: string): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_saha', gardenId], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 180_000, maxBuffer: 512 * 1024 * 1024 })
}

/** Test aracı: bahçenin hava önbelleğini kayıtlı örnek veriyle doldurur (ağsız; gerçek hava servisi ve risk motoru çalışır). */
export function seedWeather(gardenId: string): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_weather', gardenId], { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe', timeout: 180_000, maxBuffer: 512 * 1024 * 1024 })
}

/** Test aracı: bahçeye gerçek yayım yolundan bildirim ekler (öncelik: kritik | uyari | bilgi). */
export function seedNotification(gardenId: string, oncelik: 'kritik' | 'onemli' | 'bilgi', key: string, sekme = 'hava'): void {
  execFileSync('../bahcelab-backend/.venv/bin/python', ['-m', 'tests.support.seed_notifications', gardenId, oncelik, key, sekme], {
    cwd: '../bahcelab-backend',
    env: backendEnv(),
    stdio: 'pipe',
  })
}

/** Haritayı verilen konuma (yakın zoom) açacak başlangıç görünümünü yazar: çizim için yakınlaşmak gerekir. */
export async function startAt(page: Page, lng: number, lat: number, zoom = 17): Promise<void> {
  const me = await page.request.get('/api/auth/me')
  expect(me.ok()).toBe(true)
  const user = (await me.json()) as { id?: string; user?: { id: string } }
  const id = user.id ?? user.user?.id
  await page.addInitScript(
    ([key, view]) => localStorage.setItem(key as string, JSON.stringify(view)),
    [`bahcelab_map_view_v1:${id}`, { center: [lng, lat], zoom, basemap: 'satellite', provider: 'mapbox' }],
  )
}

/** Haritanın (tuvalin) merkezine göre ofsetli ekran noktası; çalışma alanında harita sol bölmeyi doldurur. */
export async function mapPoint(page: Page, dx: number, dy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('.maplibregl-canvas').first().boundingBox()
  if (!box) throw new Error('Harita tuvali bulunamadı')
  return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy }
}

/** 9H-S4 D2 teslim ekranları: 4 vanalı, pompa + ana boru çizili, profilli test bahçesi. */
const PROFIL = { sistem: 'damla', damlatici_sayisi: 4, damlatici_debi_lh: 4, sira_aralik_m: 5, agac_aralik_m: 4, pompa_kw: 7.5, pompa_debi_m3h: 40, enerji: 'sebeke' }

export async function hazirla(page: Page, ad: string, lng: number) {
  await newUser(page)
  const garden = await createGarden(page.request, { ad, lng, lat: 38.7, sideM: 200 })
  seedScenes(garden.id)
  seedWater(garden.id)
  await page.request.patch(`/api/gardens/${garden.id}`, { data: { agac_sayisi: 1800 } })
  await page.request.put(`/api/gardens/${garden.id}/sulama-profili`, { data: { ...PROFIL, kwh_fiyat_tl: null } })
  const g = (await (await page.request.get(`/api/gardens/${garden.id}`)).json()) as { geometry: GeoJSON.Polygon }
  const xs = g.geometry.coordinates[0].map((c) => c[0])
  const ys = g.geometry.coordinates[0].map((c) => c[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const xm = (x0 + x1) / 2
  const ym = (y0 + y1) / 2
  const kutu = (a: number, b: number, c: number, d: number) => ({ type: 'Polygon', coordinates: [[[a, c], [b, c], [b, d], [a, d], [a, c]]] })
  const r = await page.request.put(`/api/gardens/${garden.id}/sulama-sektorleri`, {
    data: {
      sektorler: [{ ad: 'V1', geometry: kutu(x0, xm, y0, ym), vana_debi_m3h: 20 }, { ad: 'V2', geometry: kutu(xm, x1, y0, ym), vana_debi_m3h: 20 }, { ad: 'V3', geometry: kutu(x0, xm, ym, y1), vana_debi_m3h: 25 }, { ad: 'V4', geometry: kutu(xm, x1, ym, y1), vana_debi_m3h: 25 }],
      pompa: { type: 'Point', coordinates: [x0 - 0.00025, ym] },
      ana_boru: { type: 'LineString', coordinates: [[x0 - 0.00025, ym], [xm, ym], [x1, ym]] },
      sira_yonu_derece: null,
    },
  })
  expect(r.ok(), await r.text()).toBeTruthy()
  return garden
}
