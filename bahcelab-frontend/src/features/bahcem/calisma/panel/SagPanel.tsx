import type { Garden } from '../../api/types'
import { WeatherTab } from '../../components/hava/WeatherTab'
import type { GardenTab } from '../../lib/routes'
import { AnalizPaneli } from './AnalizPaneli'
import { DurumPaneli } from './DurumPaneli'
import { PanelKabuk, YakindaSatiri } from './parcalar'
import { SulamaPaneli } from '../sulama/panel/SulamaPaneli'
import { SuPaneli } from './SuPaneli'

/** Sağ panel: sekme içeriği. Sekme değişince içerik hafif çapraz geçiş + 8 px kayma ile gelir (250 ms; reduced-motion'da anında). */
export function SagPanel({ garden, tab, sulama = false }: { garden: Garden; tab: GardenTab; sulama?: boolean }) {
  return (
    <div key={`${tab}${sulama ? "-sulama" : ""}`} className="m-panel-in flex min-h-0 flex-1 flex-col" data-testid={`panel-${tab}`}>
      {tab === 'durum' && <DurumPaneli garden={garden} />}
      {tab === 'analiz' && <AnalizPaneli garden={garden} />}
      {tab === 'su' && (sulama ? <SulamaPaneli garden={garden} /> : <SuPaneli garden={garden} />)}
      {tab === 'hava' && <WeatherTab garden={garden} />}
      {tab === 'gunluk' && <PanelKabuk karar={null} testId="gunluk-paneli"><YakindaSatiri ad="Günlük" ne="Gözlem, hasat ve iş kayıtları konumlu fotoğraflarla burada tutulacak." /></PanelKabuk>}
      {tab === 'rapor' && <PanelKabuk karar={null} testId="rapor-paneli"><YakindaSatiri ad="Rapor" ne="Sezonun uydu, hava ve kayıt özeti PDF olarak burada olacak." /></PanelKabuk>}
    </div>
  )
}
