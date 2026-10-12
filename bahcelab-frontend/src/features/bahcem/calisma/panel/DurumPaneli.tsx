import type { Garden } from '../../api/types'
import { useGardenStatus } from '../../api/agroApi'
import { ErrorState, Skeleton } from '@/components/ui'
import { TodayCard } from '../../components/garden-page/TodayCard'
import { BosDurum } from '../../kabuk/BosDurum'
import { KADEME_META, SEVIYE_META, type Kademe } from '../../lib/kademe'
import { GecmisCekiliyor } from './GecmisCekiliyor'
import { KademeSeridi } from './KademeSeridi'
import { NasilHesaplandi } from './NasilHesaplandi'

/** Durum sekmesi (v1): kademe şeridi + üç bileşen çipi + «Nasıl hesaplandı?» + Bugün. Sayısal skor yoktur. */
export function DurumPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, refetch, isFetching } = useGardenStatus(garden.id)
  const kademe: Kademe | null = data && data.durum !== 'veri_yok' ? data.durum : null
  return (
    <div className="grid gap-4 p-5">
      <GecmisCekiliyor gardenId={garden.id} />
      {isLoading ? (
        <Skeleton className="h-40" aria-label="Durum yükleniyor" />
      ) : isError || !data ? (
        <ErrorState title="Durum alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <section aria-label="Bahçe durumu" className="space-y-3.5" data-testid="durum-karti" data-kademe={data.durum}>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-app-text-dim">Durum</div>
            {kademe ? (
              <h2 className="mt-0.5 flex items-baseline gap-2 text-[26px] font-bold leading-none" data-testid="kademe-ad" style={{ color: KADEME_META[kademe].renk }}>
                <span aria-hidden className="text-[16px]">{KADEME_META[kademe].isaret}</span>
                {KADEME_META[kademe].ad}
              </h2>
            ) : (
              <h2 className="mt-0.5 text-[22px] font-bold leading-tight" data-testid="kademe-ad">Veri yetersiz</h2>
            )}
            <p className="mt-1.5 text-[14px] text-app-text-muted" data-testid="durum-ozet">{data.veriYeterli ? data.ozet : (data.veriYetersizNedeni ?? data.ozet)}</p>
          </div>
          <KademeSeridi kademe={kademe} />
          <ul className="grid gap-2" aria-label="Bileşenler">
            {data.cipler.map((c) => {
              const meta = c.seviye ? SEVIYE_META[c.seviye] : null
              return (
                <li key={c.kod} data-testid="durum-cip" data-kod={c.kod} data-seviye={c.seviye ?? 'yok'} className="flex items-start gap-3 rounded-md border border-app-border bg-app-card px-3.5 py-2.5">
                  <span aria-hidden className="mt-0.5 w-4 text-center text-[13px]" style={{ color: meta?.renk }}>{meta?.isaret ?? '–'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <b className="text-[13.5px]">{c.ad}</b>
                      <span className="text-[12.5px] font-semibold" style={{ color: meta?.renk }}>{c.etiket ?? meta?.ad ?? 'veri yok'}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-app-text-muted">{c.aciklama}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <NasilHesaplandi nasil={data.nasil} />
        </section>
      )}
      <TodayCard gardenId={garden.id} />
      <section aria-label="Sezon bandı" className="rounded-md border border-dashed border-app-border" data-testid="sezon-bandi-bos">
        <BosDurum gravur="kesit" baslik="Çok yıllık sezon bandı" fayda="Bu sezonun bahçenin kendi geçmişi yanında nerede durduğu burada görünecek." adim="Çok yıllık veri 9C’de çekiliyor" />
      </section>
    </div>
  )
}
