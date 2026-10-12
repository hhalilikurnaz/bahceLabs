import { execFileSync } from 'node:child_process'
import { backendEnv } from './ortam'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

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
    { cwd: '../bahcelab-backend', env: backendEnv(), stdio: 'pipe' },
  )
}

/** Test aracı: bahçeye gerçek yayım yolundan bildirim ekler (öncelik: kritik | uyari | bilgi). */
export function seedNotification(gardenId: string, oncelik: 'kritik' | 'uyari' | 'bilgi', key: string, sekme = 'hava'): void {
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

/** Haritanın görünen (paneller arası) alanında, merkeze göre ofsetli ekran noktası. */
export async function mapPoint(page: Page, dx: number, dy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('.maplibregl-canvas').first().boundingBox()
  if (!box) throw new Error('Harita tuvali bulunamadı')
  const free = await page.evaluate(() => {
    const css = getComputedStyle(document.querySelector('[data-testid="left-panel"]')?.parentElement as HTMLElement)
    return { left: parseFloat(css.getPropertyValue('--map-left')) || 0, right: parseFloat(css.getPropertyValue('--map-right')) || 0 }
  })
  return { x: (free.left + (box.width - free.right)) / 2 + dx, y: box.height / 2 + dy }
}
