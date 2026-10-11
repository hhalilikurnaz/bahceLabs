import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@/features/bahcem/api/notificationsApi'
import { badgeText, newCritical, toastText } from '@/features/bahcem/lib/notifications'

const n = (id: string, oncelik: AppNotification['oncelik'], okundu = false): AppNotification => ({
  id, bahceId: 'g', tur: 'hava_don', turAdi: 'Don uyarısı', oncelik, baslik: `Başlık ${id}`, metin: '…', baglanti: '/bahcem/g/hava', okundu, olusturma: '2026-10-12T05:00:00Z',
})

describe('bildirim yardımcıları', () => {
  it('rozet metni', () => {
    expect(badgeText(0)).toBe('')
    expect(badgeText(7)).toBe('7')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(150)).toBe('99+')
  })

  it('yalnızca yeni, okunmamış ve kritik bildirimler toast olur', () => {
    const items = [n('1', 'kritik'), n('2', 'uyari'), n('3', 'kritik', true), n('4', 'kritik'), n('5', 'bilgi')]
    expect(newCritical(items, new Set()).map((i) => i.id)).toEqual(['1', '4'])
    expect(newCritical(items, new Set(['1'])).map((i) => i.id)).toEqual(['4'])
    expect(newCritical(items, new Set(['1', '4']))).toEqual([])
  })

  it('toast metni tek ya da birleşik', () => {
    expect(toastText([])).toBe('')
    expect(toastText([n('1', 'kritik')])).toBe('Başlık 1')
    expect(toastText([n('1', 'kritik'), n('2', 'kritik'), n('3', 'kritik')])).toBe('Başlık 1 ve 2 bildirim daha')
  })
})
