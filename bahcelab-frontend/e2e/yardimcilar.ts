import { execFileSync } from 'node:child_process'
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
    { cwd: '../bahcelab-backend', env: { ...process.env, PYTHONPATH: 'src' }, stdio: 'pipe' },
  )
}
