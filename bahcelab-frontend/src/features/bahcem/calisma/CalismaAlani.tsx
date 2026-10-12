import { useEffect, useRef } from 'react'
import type { Garden } from '../api/types'
import type { GardenTab } from '../lib/routes'
import { Bolucu } from './Bolucu'
import { useCalismaStore } from './calismaStore'
import { HaritaPaneli } from './harita/HaritaPaneli'
import { SagPanel } from './panel/SagPanel'

/** Bölünmüş çalışma alanı: solda tam harita, sağda sabit panel; aradaki bölücü sürüklenir (oran saklanır). Dar ekranda alt alta. */
export function CalismaAlani({ garden, gardens, tab }: { garden: Garden; gardens: Garden[]; tab: GardenTab }) {
  const box = useRef<HTMLDivElement>(null)
  const oran = useCalismaStore((s) => s.oran)
  const bahceDegisti = useCalismaStore((s) => s.bahceDegisti)
  useEffect(() => bahceDegisti(), [garden.id, bahceDegisti])
  return (
    <div ref={box} className="flex min-h-0 flex-1 max-[900px]:flex-col max-[900px]:overflow-y-auto" data-testid="calisma-alani">
      <div className="min-w-[320px] border-r border-app-border max-[900px]:h-[58vh] max-[900px]:min-h-[340px] max-[900px]:min-w-0 max-[900px]:shrink-0 max-[900px]:border-r-0" style={{ flexBasis: `${oran * 100}%`, flexGrow: 0, flexShrink: 0 }}>
        <HaritaPaneli garden={garden} gardens={gardens} />
      </div>
      <Bolucu container={box} />
      <aside aria-label="Bahçe paneli" className="flex min-h-0 min-w-[360px] flex-1 flex-col bg-app-panel max-[900px]:min-w-0 max-[900px]:overflow-visible">
        <SagPanel garden={garden} tab={tab} />
      </aside>
    </div>
  )
}
