import type { Garden } from '../../api/types'
import { WeatherTab } from '../../components/hava/WeatherTab'
import { BosDurum } from '../../kabuk/BosDurum'
import type { GardenTab } from '../../lib/routes'
import { AnalizPaneli } from './AnalizPaneli'
import { DurumPaneli } from './DurumPaneli'

/** Sağ sabit panel: sekme içeriği. */
export function SagPanel({ garden, tab }: { garden: Garden; tab: GardenTab }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid={`panel-${tab}`}>
      {tab === 'durum' && <DurumPaneli garden={garden} />}
      {tab === 'analiz' && <AnalizPaneli garden={garden} />}
      {tab === 'su' && <BosDurum gravur="yaprak" baslik="Su sekmesi 9E’de" fayda="Landsat yüzey sıcaklığı ve ERA5-Land toprak nemiyle bahçenin su durumu dört grafikte gösterilecek." adim="Adım 9E" testId="bos-su" />}
      {tab === 'hava' && <WeatherTab garden={garden} />}
      {tab === 'gunluk' && <BosDurum gravur="dal" baslik="Günlük" fayda="Gözlem, hasat ve iş kayıtları konumlu fotoğraflarla burada tutulacak." adim="Adım 11" />}
      {tab === 'rapor' && <BosDurum gravur="kesit" baslik="Rapor" fayda="Sezonun uydu, hava ve kayıt özeti PDF ve paylaşım bağlantısı olarak." adim="Adım 16" />}
    </div>
  )
}
