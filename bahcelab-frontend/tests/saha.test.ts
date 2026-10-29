import { describe, expect, it } from 'vitest'
import { dogrulanacakMi, ON_YARGI_SIRA, type DogrulamaKarti, type Kayit } from '@/features/bahcem/api/sahaApi'
import { bugunIstanbul, haversine, koseleriCokgene, mesafe, temsilNoktasi, turSuz } from '@/features/bahcem/lib/saha'

describe('saha yardımcıları', () => {
  it('bugün Europe/Istanbul takvim günüdür (UTC gece yarısına yakın bile)', () => {
    expect(bugunIstanbul(new Date('2026-10-18T21:30:00Z'))).toBe('2026-10-19') // UTC'de hâlâ 18, İstanbul'da 19
    expect(bugunIstanbul(new Date('2026-10-18T20:59:00Z'))).toBe('2026-10-18')
  })
  it('çokgen en az 3 köşeyle kurulur ve halka kapatılır', () => {
    expect(koseleriCokgene([[27, 38], [27.1, 38]])).toBeNull()
    const poly = koseleriCokgene([[27, 38], [27.1, 38], [27.1, 38.1]])!
    expect(poly.coordinates[0]).toHaveLength(4)
    expect(poly.coordinates[0][0]).toEqual(poly.coordinates[0][3])
    expect(temsilNoktasi(poly)[0]).toBeCloseTo(27.0667, 3)
  })
  it('mesafe metin biçimi ve haversine', () => {
    expect(mesafe(540)).toBe('540 m')
    expect(mesafe(1234)).toBe('1,2 km')
    expect(haversine([27, 38], [27, 38])).toBe(0)
    expect(haversine([27, 38], [27.001, 38])).toBeGreaterThan(80)
  })
  it('tür süzgeci boş kümede hepsini verir', () => {
    const k = (tur: Kayit['tur']) => ({ tur }) as Kayit
    expect(turSuz([k('hasat'), k('gozlem')], new Set())).toHaveLength(2)
    expect(turSuz([k('hasat'), k('gozlem')], new Set(['hasat']))).toHaveLength(1)
  })
})

describe('dış ön yargı süzgeci', () => {
  const kart = (over: Partial<DogrulamaKarti>): DogrulamaKarti => ({ hedef_tur: 'olay', hedef_anahtar: 'k', baslik: 'b', tur_grubu: 'don', baslangic: '2026-01-01', bitis: '2026-01-01', guven: null, durum: 'olay', olay_id: null, sonuc: null, aciklama: null, dogrulama_id: null, fotograflar: [], dogrulandi: null, on_yargi: { sonuc: 'kanit_yok', kanitlar: [], neden: '' }, ...over })
  it('yalnız yanıtsız ve (çelişen ya da kanıtsız) olaylar «doğrulanması gereken»dir', () => {
    expect(dogrulanacakMi(kart({}))).toBe(true)
    expect(dogrulanacakMi(kart({ on_yargi: { sonuc: 'celisiyor', kanitlar: [], neden: '' } }))).toBe(true)
    expect(dogrulanacakMi(kart({ on_yargi: { sonuc: 'destekleniyor', kanitlar: [], neden: '' } }))).toBe(false)
    expect(dogrulanacakMi(kart({ sonuc: 'gerceklesti' }))).toBe(false) // yanıtlanmış
    expect(dogrulanacakMi(kart({ hedef_tur: 'uyari', on_yargi: null }))).toBe(false)
    expect(dogrulanacakMi(kart({ on_yargi: { sonuc: 'belirsiz', kanitlar: [], neden: '' } }))).toBe(true) // belirsiz de bakılacak olaydır
  })
  it('liste sırası çelişen, belirsiz, kanıt yok', () => {
    const sirali = (['kanit_yok', 'belirsiz', 'celisiyor'] as const).map((sonuc) => kart({ on_yargi: { sonuc, kanitlar: [], neden: '' } })).sort((a, b) => ON_YARGI_SIRA[a.on_yargi!.sonuc] - ON_YARGI_SIRA[b.on_yargi!.sonuc]).map((k) => k.on_yargi!.sonuc)
    expect(sirali).toEqual(['celisiyor', 'belirsiz', 'kanit_yok'])
  })
})
