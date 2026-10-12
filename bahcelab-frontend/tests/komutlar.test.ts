import { describe, expect, it } from 'vitest'
import { ara, komutlar } from '@/features/bahcem/kabuk/komutlar'

const ctx = { bahceler: [{ id: 'g1', ad: 'jlnnlk' }, { id: 'g2', ad: 'soğuk hava' }], seciliBahce: 'g1' }

describe('⌘K komutları (kural tabanlı)', () => {
  it('zayıf bölgeleri göster → bölge katmanı', () => {
    expect(ara(komutlar(ctx), 'zayıf bölgeleri göster')[0].eylem).toEqual({ tur: 'katman', katman: 'bolgeler' })
    expect(ara(komutlar(ctx), 'zayif')[0].id).toBe('zayif')
  })
  it('geçen yılla karşılaştır → Geçmiş sayfası', () => {
    expect(ara(komutlar(ctx), 'geçen yıl')[0].eylem).toEqual({ tur: 'git', yol: '/bahceler/g1/gecmis' })
  })
  it('ilaçlama zamanı → Hava sekmesi', () => {
    expect(ara(komutlar(ctx), 'ilaçlama')[0].eylem).toEqual({ tur: 'git', yol: '/bahceler/g1/hava' })
  })
  it('<bahçe adı> aç', () => {
    expect(ara(komutlar(ctx), 'soguk hava')[0].eylem).toEqual({ tur: 'git', yol: '/bahceler/g2' })
  })
  it('bahçe seçili değilse bahçeye özgü komutlar yok; boş sorgu tümünü verir', () => {
    const none = komutlar({ ...ctx, seciliBahce: null })
    expect(none.some((k) => k.id === 'zayif')).toBe(false)
    expect(ara(none, '').length).toBe(none.length)
    expect(ara(none, 'xyzq')).toEqual([])
  })
})
