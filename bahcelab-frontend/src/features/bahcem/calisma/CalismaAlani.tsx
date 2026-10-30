import { useEffect, useRef } from 'react'
import { useDarEkran } from '../hooks/useDarEkran'
import type { Garden } from '../api/types'
import type { GardenTab } from '../lib/routes'
import { Bolucu } from './Bolucu'
import { useCalismaStore } from './calismaStore'
import { HaritaPaneli } from './harita/HaritaPaneli'
import { AltSayfa } from './panel/AltSayfa'
import { SagPanel } from './panel/SagPanel'
import { useUrlGorunumu } from './useUrlGorunumu'

/** Bölünmüş çalışma alanı: solda harita, sağda sabit genişlikli panel (420–640 px, sürüklenebilir ayraç; tercih hatırlanır). ≤ 899 px: harita tam ekran, panel üç duraklı alt sayfa. */
export function CalismaAlani({ garden, gardens, tab }: { garden: Garden; gardens: Garden[]; tab: GardenTab }) {
  const box = useRef<HTMLDivElement>(null)
  const panelPx = useCalismaStore((s) => s.panelPx)
  const bahceDegisti = useCalismaStore((s) => s.bahceDegisti)
  const dar = useDarEkran(899)
  useEffect(() => bahceDegisti(), [garden.id, bahceDegisti])
  // Sekme haritanın katmanını da değiştirir (ilke 10): Durum→Canlılık, Analiz→Bölgeler, Su→Yaprak suyu, Hava→sade (katman kapalı)
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setSade = useCalismaStore((s) => s.setSade)
  const setSekme = useCalismaStore((s) => s.setSekme)
  useEffect(() => {
    setSekme(tab)
    if (tab === 'durum') setKatman('canlilik')
    else if (tab === 'analiz') setKatman('bolgeler')
    else if (tab === 'su') setKatman('yaprakSuyu')
    else if (tab === 'hava') setSade(true)
  }, [tab, garden.id, setKatman, setSade, setSekme])
  useUrlGorunumu(garden.id)
  if (dar) {
    return (
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden" data-testid="calisma-alani" data-yerlesim="alt-sayfa">
        <div className="absolute inset-0"><HaritaPaneli garden={garden} gardens={gardens} /></div>
        <AltSayfa>
          <aside aria-label="Bahçe paneli" className="flex min-h-0 flex-1 flex-col"><SagPanel garden={garden} tab={tab} /></aside>
        </AltSayfa>
      </div>
    )
  }
  return (
    <div ref={box} className="flex min-h-0 flex-1" data-testid="calisma-alani" data-yerlesim="yan-yana">
      <div className="min-w-[320px] flex-1 border-r border-app-border">
        <HaritaPaneli garden={garden} gardens={gardens} />
      </div>
      <Bolucu container={box} />
      <aside aria-label="Bahçe paneli" className="flex min-h-0 shrink-0 flex-col border-l border-app-border bg-app-canvas" style={{ width: panelPx, maxWidth: 'calc(100% - 360px)' }} data-testid="sag-panel">
        <SagPanel garden={garden} tab={tab} />
      </aside>
    </div>
  )
}
