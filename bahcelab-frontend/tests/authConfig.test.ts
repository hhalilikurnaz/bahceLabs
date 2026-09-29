import { describe, expect, it } from 'vitest'
import { REGISTRATION_ENABLED } from '@/features/auth/authConfig'

describe('authConfig', () => {
  it('yeni kayıt kapalı (erken erişim)', () => {
    expect(REGISTRATION_ENABLED).toBe(false)
  })
})
