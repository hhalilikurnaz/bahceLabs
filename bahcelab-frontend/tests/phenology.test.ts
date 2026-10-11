import { describe, expect, it } from 'vitest'
import { bandLabel, stageShortName } from '@/features/bahcem/lib/phenology'

describe('fenoloji bandı etiketi', () => {
  it('bilinen evreler kısa ad alır', () => {
    expect(stageShortName('ciceklenme', 'Çiçeklenme')).toBe('Çiçek')
    expect(stageShortName('meyve_tutumu', 'Meyve tutumu')).toBe('Tutum')
    expect(stageShortName('meyve_gelisimi', 'Meyve büyümesi')).toBe('Büyüme')
    expect(stageShortName('olgunlasma', 'Olgunlaşma ve hasat')).toBe('Olgun.')
    expect(stageShortName('kis_dinlenme', 'Kış dinlenmesi')).toBe('Dinlenme')
  })

  it('bilinmeyen evre adının ilk sözcüğünü kullanır', () => {
    expect(stageShortName('ozel_evre', 'Hasat sonrası bakım')).toBe('Hasat')
  })

  it('sığmayan etiket gizlenir, sığan kesilmeden gösterilir', () => {
    expect(bandLabel('ciceklenme', 'Çiçeklenme', 60)).toBe('Çiçek')
    expect(bandLabel('ciceklenme', 'Çiçeklenme', 30)).toBeNull() // 5 harf × 6,4 + 8 = 40 px gerekir
    expect(bandLabel('ciceklenme', 'Çiçeklenme', 40)).toBe('Çiçek') // sınırda sığar
    expect(bandLabel('kis_dinlenme', 'Kış dinlenmesi', 40)).toBeNull()
  })
})
