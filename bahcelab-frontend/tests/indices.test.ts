import { describe, expect, it } from 'vitest'
import type { Scene } from '@/features/bahcem/api/indeksApi'
import {
  COLORMAPS,
  INDEX_DEFS,
  INDEX_IDS,
  LAYER_OPTIONS,
  TRUE_COLOR,
  colorAt,
  formatIndexValue,
  gradientCss,
  indexColor,
  indexRgb,
  isIndexId,
  layerName,
  vigorLabel,
} from '@/features/bahcem/lib/indices'
import { findScene, isUsable, changeAt, latestIndexValue, latestUsableScene, usableDates } from '@/features/bahcem/lib/scenes'

const scene = (tarih: string, opts: Partial<Scene> & { ndvi?: number; veri?: boolean } = {}): Scene => ({
  tarih,
  durum: opts.durum ?? 'tamam',
  sceneId: `s-${tarih}`,
  bulutOrani: 10,
  gecerliPikselOrani: 1,
  satir: 4,
  sutun: 5,
  koordinatlar: [[0, 0], [1, 0], [1, 1], [0, 1]],
  gercekRenkVar: opts.gercekRenkVar ?? true,
  indeksler:
    opts.indeksler ??
    (opts.durum === 'bulutlu'
      ? {}
      : {
          ndvi: {
            ortalama: opts.ndvi ?? 0.5,
            medyan: 0.5,
            p10: 0.4,
            p90: 0.6,
            min: 0.3,
            max: 0.7,
            pngVar: true,
            veriVar: opts.veri ?? true,
            sorunluBolgeSayisi: 0,
          },
        }),
  kaynak: 'sentinel-2',
  surum: 1,
})

describe('indeks tanımları', () => {
  it('beş indeks ve gerçek renk (6 katman)', () => {
    expect(INDEX_IDS).toEqual(['ndvi', 'msavi', 'ndre', 'ndmi', 'cigreen'])
    expect(LAYER_OPTIONS.map((o) => o.id)).toEqual([...INDEX_IDS, TRUE_COLOR])
    expect(layerName('ndre')).toBe('Klorofil / besin')
    expect(layerName(TRUE_COLOR)).toBe('Gerçek renk')
    expect(isIndexId('ndmi')).toBe(true)
    expect(isIndexId(TRUE_COLOR)).toBe(false)
  })

  it('her indeksin kendi skalası, aralığı ve açıklaması var', () => {
    expect(INDEX_DEFS.ndvi).toMatchObject({ min: 0, max: 0.9, renk: 'rdylgn' })
    expect(INDEX_DEFS.ndmi).toMatchObject({ min: -0.2, max: 0.6, renk: 'mavi' })
    expect(INDEX_DEFS.cigreen).toMatchObject({ min: 0, max: 3, renk: 'yesil' })
    for (const id of INDEX_IDS) {
      expect(INDEX_DEFS[id].aciklama.length).toBeGreaterThan(40)
      expect(COLORMAPS[INDEX_DEFS[id].renk][0][0]).toBe(0)
    }
  })

  it('NDVI duraklarında backend ile aynı renkler (rozet/lejant/PNG tutarlılığı)', () => {
    expect(indexRgb('ndvi', 0)).toEqual([215, 48, 39])
    expect(indexRgb('ndvi', 0.3)).toEqual([252, 141, 89])
    expect(indexRgb('ndvi', 0.5)).toEqual([254, 224, 139])
    expect(indexRgb('ndvi', 0.7)).toEqual([145, 207, 96])
    expect(indexRgb('ndvi', 0.9)).toEqual([26, 152, 80])
    expect(indexColor('ndvi', 0.5)).toBe('rgb(254 224 139)')
  })

  it('renk karışımı, kırpma ve gradyan', () => {
    expect(colorAt(COLORMAPS.mavi, -1)).toEqual(COLORMAPS.mavi[0][1])
    expect(colorAt(COLORMAPS.mavi, 9)).toEqual(COLORMAPS.mavi[COLORMAPS.mavi.length - 1][1])
    expect(gradientCss('rdylgn')).toContain('rgb(215 48 39) 0.0%')
    expect(gradientCss('fark')).toContain('rgb(245 245 245) 50.0%')
  })

  it('biçimlendirme ve etiketler', () => {
    expect(formatIndexValue('ndvi', 0.456)).toBe('0,46')
    expect(formatIndexValue('cigreen', 1.644)).toBe('1,64')
    expect(formatIndexValue('ndvi', null)).toBe('—')
    expect(vigorLabel('ndvi', 0.7)).toBe('Güçlü')
    expect(vigorLabel('ndvi', 0.45)).toBe('Orta')
    expect(vigorLabel('ndvi', 0.2)).toBe('Zayıf')
  })
})

describe('sahne seçimi', () => {
  const scenes = [
    scene('2026-09-01'),
    scene('2026-09-06', { durum: 'bulutlu' }),
    scene('2026-09-11'),
    scene('2026-09-16', { gercekRenkVar: false }),
  ]

  it('bulutlu sahne ve eksik katman kullanılamaz', () => {
    expect(isUsable(scenes[1], 'ndvi')).toBe(false)
    expect(isUsable(scenes[0], 'ndre')).toBe(false) // bu sahnede NDRE yok
    expect(isUsable(scenes[0], TRUE_COLOR)).toBe(true)
    expect(isUsable(scenes[3], TRUE_COLOR)).toBe(false)
    expect(usableDates(scenes, 'ndvi')).toEqual(['2026-09-01', '2026-09-11', '2026-09-16'])
    expect(usableDates(scenes, TRUE_COLOR)).toEqual(['2026-09-01', '2026-09-11'])
  })

  it('latestUsableScene: ana ekran her zaman en son kullanılabilir görüntüyü seçer', () => {
    expect(latestUsableScene(scenes, 'ndvi')?.tarih).toBe('2026-09-16')
    expect(latestUsableScene(scenes, TRUE_COLOR)?.tarih).toBe('2026-09-11')
    expect(latestUsableScene([scene('2026-09-06', { durum: 'bulutlu' })], 'ndvi')).toBeNull()
    expect(latestUsableScene(undefined, 'ndvi')).toBeNull()
    expect(findScene(scenes, '2026-09-11')?.tarih).toBe('2026-09-11')
    expect(findScene(scenes, null)).toBeNull()
  })

  it('latestIndexValue en son bulutsuz değeri verir', () => {
    expect(latestIndexValue(scenes, 'ndvi')).toEqual({ tarih: '2026-09-16', ortalama: 0.5 })
    expect(latestIndexValue(scenes, 'ndre')).toBeNull()
  })

  it('changeAt: seçili tarihteki değerin 14 gün öncesine göre değişimi; yakın görüntü yoksa null', () => {
    const change = changeAt(scenes, 'ndvi', '2026-09-16', 14, 7)
    expect(change?.previous.tarih).toBe('2026-09-01')
    expect(change?.latest.tarih).toBe('2026-09-16')
    expect(changeAt(scenes, 'ndvi', '2026-09-01', 14, 7)).toBeNull() // öncesinde görüntü yok
    expect(changeAt(scenes, 'ndvi', '2026-09-16', 60, 3)).toBeNull() // tolerans içinde görüntü yok
  })
})
