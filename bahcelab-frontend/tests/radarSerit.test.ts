import { describe, expect, it } from 'vitest'
import type { Edinimler } from '../src/features/bahcem/api/edinimApi'
import type { RadarDegisim, RadarEdinim } from '../src/features/bahcem/api/radarApi'
import { buildSerit, bulguCumlesi, eskiOptikSatiri } from '../src/features/bahcem/lib/radarSerit'

const BUGUN = '2026-10-12'
const optik = (net: string[], bulutlu: string[]): Edinimler => ({ izgara: null, net_sayisi: net.length, bulutlu_sayisi: bulutlu.length, bulutlu_tarihler: bulutlu, edinimler: net.map((t) => ({ tarih: t, scene_id: t, bulut_orani: 3, gecerli_oran: 1, isleme_surumu: null, formul_surumu: null, gostergeler: {} })) })
const radar = (t: string, o: Partial<RadarEdinim> = {}): RadarEdinim => ({ tarih: t, scene_id: `S-${t}`, yorunge: 167, gecis_yonu: 'inis', birincil: true, maskeli_oran: 0, izgara: true, vh_db: -15, rvi: 0.8, ...o })
const olay = (t: string, o: Partial<RadarDegisim> = {}): RadarDegisim => ({ tarih: t, scene_id: `S-${t}`, yorunge: 167, gecis_yonu: 'inis', durum: 'aday', isaret: 'azalis', alan_orani: 0.28, alan_m2: 900, buyukluk_db: -3.1, bahce_delta_db: -2.5, kalici_sapma: 'alt', art_arda: true, islaklik_olabilir: false, yagis_mm: 0.2, ...o })

describe('bulut altında görüş şeridi', () => {
  it('yalnız son 90 günü alır, bulutlu geçişler tek bulutlu döneme birleşir', () => {
    const s = buildSerit(BUGUN, optik(['2026-09-01', '2026-10-05', '2026-03-01'], ['2026-09-10', '2026-09-15', '2026-10-01', '2026-02-01']), [radar('2026-09-11'), radar('2026-01-01')], [])
    expect(s.optikNet).toBe(2)
    expect(s.optikGoremedi).toBe(3)
    expect(s.radarGordu).toBe(1)
    expect(s.bantlar).toHaveLength(2) // 10 ve 15 Eylül birleşir, 1 Ekim ayrı
    expect(s.bantlar[0].bit).toBeGreaterThan(s.bantlar[0].bas)
  })

  it('bulgu cümlesi: sayılar kayıtlardan, değişim yoksa «anlamlı değişim yok»', () => {
    const s = buildSerit(BUGUN, optik([], ['2026-09-10', '2026-09-20', '2026-10-01']), ['2026-09-12', '2026-09-24', '2026-09-30', '2026-10-06', '2026-10-10'].map((t) => radar(t)), [])
    expect(bulguCumlesi(s)).toBe('Son 90 günde optik uydu 3 kez göremedi; radar bu sürede 5 kez gördü, anlamlı değişim yok.')
  })

  it('aday varsa cümle yönü, alanı, yörüngeyi ve (gerekiyorsa) ıslaklık notunu söyler; gürültü sayılmaz', () => {
    const s = buildSerit(BUGUN, optik(['2026-10-01'], []), [radar('2026-10-06')], [olay('2026-10-06', { islaklik_olabilir: true }), olay('2026-09-20', { durum: 'gurultu' })])
    const c = bulguCumlesi(s)
    expect(s.adaylar).toHaveLength(1)
    expect(c).toContain('alanın %28’inde azalma')
    expect(c).toContain('yörünge 167 · iniş')
    expect(c).toContain('ıslaklık olabilir')
    expect(s.radar[0].aday).not.toBeNull()
  })

  it('radar kaydı yoksa «radar geçişi kaydı yok» der, uydurma yapmaz', () => {
    expect(bulguCumlesi(buildSerit(BUGUN, optik([], []), [], []))).toContain('radar geçişi kaydı yok')
  })
})

describe('Durum üstündeki eski optik satırı', () => {
  it('son optik 10 günden yeni ise satır yok', () => {
    expect(eskiOptikSatiri(BUGUN, '2026-10-05', [radar('2026-10-10')], [])).toBeNull()
  })
  it('eskiyse son radar geçişi ve değişim durumu yazılır', () => {
    expect(eskiOptikSatiri(BUGUN, '2026-09-28', [radar('2026-10-11')], [])).toBe('Son optik görüntü 14 gün önce · radar 11 Eki: anlamlı değişim yok')
    expect(eskiOptikSatiri(BUGUN, '2026-09-28', [radar('2026-10-11')], [olay('2026-10-05')])).toContain('azalma olay adayı (5 Eki)')
  })
  it('optik sonrası radar kaydı yoksa bunu söyler', () => {
    expect(eskiOptikSatiri(BUGUN, '2026-09-28', [radar('2026-09-20')], [])).toContain('radar geçişi kaydı yok')
  })
})
