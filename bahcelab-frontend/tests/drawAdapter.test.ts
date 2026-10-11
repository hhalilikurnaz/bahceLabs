import { describe, expect, it } from 'vitest'
import { FINISH_KEY, finishDrawing } from '@/features/bahcem/lib/drawAdapter'

describe('çizimi bitirme bağdaştırıcısı', () => {
  it('önce keydown sonra keyup olarak Enter gönderir (kabarcıklanır)', () => {
    const received: { type: string; key: unknown; bubbles: boolean }[] = []
    const target = new EventTarget()
    for (const type of ['keydown', 'keyup']) {
      target.addEventListener(type, (e) => received.push({ type: e.type, key: (e as unknown as { key: string }).key, bubbles: e.bubbles }))
    }
    expect(finishDrawing(target)).toBe(true)
    expect(received).toEqual([
      { type: 'keydown', key: FINISH_KEY, bubbles: true },
      { type: 'keyup', key: FINISH_KEY, bubbles: true },
    ])
    expect(FINISH_KEY).toBe('Enter')
  })

  it('hedef yoksa (harita henüz hazır değil) sessizce false döner', () => {
    expect(finishDrawing(null)).toBe(false)
    expect(finishDrawing(undefined)).toBe(false)
  })
})
