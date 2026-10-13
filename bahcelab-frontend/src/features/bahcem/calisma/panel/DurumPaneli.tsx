import { Link, useNavigate } from 'react-router-dom'
import type { Garden } from '../../api/types'
import { useGardenStatus, type StatusBilesen } from '../../api/agroApi'
import { ErrorState, Skeleton } from '@/components/ui'
import { TodayCard } from '../../components/garden-page/TodayCard'
import { KADEME_META, seviyeMeta, type Kademe } from '../../lib/kademe'
import { gardenPath } from '../../lib/routes'
import { useEdinimler } from '../../api/edinimApi'
import { useRadarDegisimler, useRadarEdinimler } from '../../api/radarApi'
import { eskiOptikSatiri } from '../../lib/radarSerit'
import { useCalismaStore } from '../calismaStore'
import type { KatmanId } from '../katmanlar'
import { GecmisCekiliyor } from './GecmisCekiliyor'
import { GostergeCubuklari } from './GostergeCubuklari'
import { SezonEgrisi } from './SezonEgrisi'
import { KademeSeridi } from './KademeSeridi'
import { NasilHesaplandi } from './NasilHesaplandi'

/** Çipe dokununca açılacak yer: harita katmanı (aynı sayfada) ya da sekme. */
const HEDEF: Record<StatusBilesen['kod'], { katman?: KatmanId; sekme?: 'su' }> = {
  agac_gucu: { katman: 'canlilik' },
  su: { sekme: 'su' },
  beslenme: { katman: 'klorofil' },
  ani_degisim: { katman: 'degisim' },
  isi: { katman: 'yuzeySicakligi' },
}
const EYLEM: Record<StatusBilesen['kod'], string> = {
  agac_gucu: 'Canlılık katmanını haritada aç',
  su: 'Su sekmesini aç',
  beslenme: 'Klorofil (beslenme) katmanını haritada aç',
  ani_degisim: 'Değişim katmanını haritada aç',
  isi: 'Yüzey sıcaklığı katmanını haritada aç',
}

/** Durum sekmesi (v2, ADR 0018): kademe şeridi + 5 bileşen çipi (dokununca ilgili katman/sekme) + risk satırı + «Nasıl hesaplandı?» + Bugün + sezon eğrisi. Sayısal skor yoktur. */
export function DurumPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, refetch, isFetching } = useGardenStatus(garden.id)
  const kademe: Kademe | null = data && data.durum !== 'veri_yok' ? data.durum : null
  const navigate = useNavigate()
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const edinim = useEdinimler(garden.id).data
  const radar = useRadarEdinimler(garden.id).data
  const olaylar = useRadarDegisimler(garden.id).data
  const sonOptik = edinim?.edinimler[edinim.edinimler.length - 1]?.tarih ?? null
  const eskiOptik = eskiOptikSatiri(new Date().toISOString().slice(0, 10), sonOptik, radar?.edinimler, olaylar?.degisimler)
  const ac = (kod: StatusBilesen['kod']) => {
    const hedef = HEDEF[kod]
    if (hedef.sekme) {
      void navigate(gardenPath(garden.id, hedef.sekme))
      return
    }
    if (hedef.katman) {
      setKatman(hedef.katman)
      setTarih(null)
      document.querySelector('[data-testid="harita-paneli"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) // dar ekranda harita üstte
    }
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-5">
      <GecmisCekiliyor gardenId={garden.id} />
      {isLoading ? (
        <Skeleton className="h-40" aria-label="Durum yükleniyor" />
      ) : isError || !data ? (
        <ErrorState title="Durum alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <section aria-label="Bahçe durumu" className="space-y-3.5" data-testid="durum-karti" data-kademe={data.durum}>
          {eskiOptik && <p className="rounded border border-app-border bg-app-card px-2.5 py-1.5 text-[12.5px] leading-snug text-app-text-muted" data-testid="eski-optik-satiri">{eskiOptik}</p>}
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
            <p className="mt-1.5 text-[14px] text-app-text-muted" data-testid="durum-ozet">{data.ozet}</p>
          </div>
          <KademeSeridi kademe={kademe} />
          <ul className="grid gap-2" aria-label="Bileşenler">
            {data.bilesenler.map((b) => {
              const meta = seviyeMeta(b.kod, b.seviye)
              return (
                <li key={b.kod}>
                  <button
                    type="button"
                    onClick={() => ac(b.kod)}
                    aria-label={`${b.ad}: ${meta?.ad ?? 'veri yok'}. ${EYLEM[b.kod]}`}
                    data-testid="durum-cip"
                    data-kod={b.kod}
                    data-seviye={b.seviye ?? 'yok'}
                    data-bayat={String(b.bayat)}
                    className="flex min-h-11 w-full items-start gap-3 rounded-md border border-app-border bg-app-card px-3.5 py-2.5 text-left hover:border-app-text"
                  >
                    <span aria-hidden className="mt-0.5 w-4 text-center text-[13px]" style={{ color: meta?.renk }}>{meta?.isaret ?? '–'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <b className="text-[13.5px]">{b.ad}</b>
                        <span className="text-[12.5px] font-semibold" style={{ color: meta?.renk }} data-testid="durum-cip-etiket">{meta?.ad ?? (b.bayat ? 'veri bayat' : 'veri yok')}</span>
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-app-text-muted">{b.neden}</span>
                    </span>
                  </button>
                </li>
              )
            })}
            <li>
              <Link
                to={gardenPath(garden.id, 'hava')}
                className="flex min-h-11 w-full items-start gap-3 rounded-md border border-app-border bg-app-card px-3.5 py-2.5 hover:border-app-text"
                data-testid="durum-risk-satiri"
                data-risk={data.riskler.length ? 'var' : 'yok'}
                aria-label={`Risk: ${data.riskler.length ? data.riskler.join(', ') : 'aktif risk görünmüyor'}. Hava sekmesini aç`}
              >
                <span aria-hidden className="mt-0.5 w-4 text-center text-[13px]" style={{ color: data.riskler.length ? 'var(--color-app-watch)' : 'var(--color-app-success)' }}>{data.riskler.length ? '▲' : '✓'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="text-[13.5px]">Risk</b>
                    <span className="text-[12.5px] font-semibold">{data.riskler.length ? 'aktif' : 'yok'}</span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-app-text-muted">
                    {data.riskler.length ? `${data.riskler.join(', ')} (risk tahmini, teşhis değil)${data.riskSinirladi ? ' · kademeyi sınırlıyor' : ''}` : 'Zararlı, hastalık ya da hava riski görünmüyor.'}
                  </span>
                </span>
              </Link>
            </li>
          </ul>
          <NasilHesaplandi nasil={data.nasil} esikDurumu={data.esikDurumu} />
        </section>
      )}
      <TodayCard gardenId={garden.id} />
      <SezonEgrisi gardenId={garden.id} />
      <GostergeCubuklari gardenId={garden.id} />
    </div>
  )
}
