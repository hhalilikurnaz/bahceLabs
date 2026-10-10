import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFlag() {
  vi.resetModules()
  return (await import('@/features/auth/authConfig')).REGISTRATION_ENABLED
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('authConfig', () => {
  it('bayrak tanımsızsa kayıt formu kapalı (erken erişim)', async () => {
    vi.stubEnv('VITE_REGISTRATION_ENABLED', '')
    expect(await loadFlag()).toBe(false)
  })

  it("VITE_REGISTRATION_ENABLED='true' ise kayıt formu açılır", async () => {
    vi.stubEnv('VITE_REGISTRATION_ENABLED', 'true')
    expect(await loadFlag()).toBe(true)
  })
})
