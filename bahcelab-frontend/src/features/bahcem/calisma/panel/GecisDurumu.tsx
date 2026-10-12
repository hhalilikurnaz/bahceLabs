import type { Garden } from '../../api/types'
import { TodayCard } from '../../components/garden-page/TodayCard'

/** B1 ara durumu: «Bugün» listesi. Kademe şeridi, bileşen çipleri ve «Nasıl hesaplandı?» B2'de bu panelin yerini alır. */
export function GecisDurumu({ garden }: { garden: Garden }) {
  return (
    <div className="grid gap-4 p-5">
      <p className="rounded-md border border-dashed border-app-border px-3 py-2 text-[12.5px] text-app-text-muted">Durum kademesi (İyi · İzle · Dikkat · Sorun) B2’de bu alana geliyor.</p>
      <TodayCard gardenId={garden.id} />
    </div>
  )
}
