import { ErrorState, Skeleton } from '@/components/ui'
import { useEdinimler, type GostergeId } from '../../api/edinimApi'
import { bandKonumu, useNormalBantlar } from '../../api/normalBantApi'
import { sayi } from '../../lib/format'
import { cubukAraligi, KONUM_METNI } from '../../lib/sezon'
import { useCalismaStore } from '../calismaStore'
import { GOSTERGE_KATMAN, KATMANLAR } from '../katmanlar'

const SATIRLAR: GostergeId[] = ['ndvi', 'ndre', 'lai', 'ndmi']

/** Gösterge çubukları (bullet): bugünkü değer + bahçenin kendi normal bandı + konum yazısı. Dokununca harita o katmana geçer. */
export function GostergeCubuklari({ gardenId }: { gardenId: string }) {
  const edinim = useEdinimler(gardenId)
  const bantlar = useNormalBantlar(gardenId)
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const liste = edinim.data?.edinimler ?? []
  const son = liste[liste.length - 1]
  if (!son) {
    if (edinim.isLoading) return <Skeleton className="h-40" aria-label="Göstergeler yükleniyor" />
    if (edinim.isError) return <section aria-label="Göstergeler" className="rounded-md border border-app-border bg-app-card p-3.5"><ErrorState title="Göstergeler alınamadı" error={edinim.error} retrying={edinim.isFetching} onRetry={() => void edinim.refetch()} className="py-4" /></section>
    return null
  }
  const ay = Number(son.tarih.slice(5, 7))
  return (
    <section aria-label="Göstergeler" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="gosterge-cubuklari">
      <h3 className="text-[13px] font-semibold">Göstergeler · bugün</h3>
      <ul className="mt-2 grid gap-1">
        {SATIRLAR.map((g) => {
          const istatistik = son.gostergeler[g]
          const band = bantlar.data?.gostergeler[g]?.find((b) => b.ay === ay)
          const katman = KATMANLAR[GOSTERGE_KATMAN[g]]
          if (!istatistik) {
            return (
              <li key={g} className="flex min-h-11 items-center justify-between text-small text-app-text-muted" data-testid="gosterge-satiri" data-gosterge={g}>
                <span>{katman.ad}</span><span>bu görüntüde hesaplanamadı</span>
              </li>
            )
          }
          const deger = istatistik.medyan
          const konum = bandKonumu(deger, band)
          const [lo, hi] = cubukAraligi(deger, band)
          const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
          return (
            <li key={g}>
              <button
                type="button"
                onClick={() => (setKatman(GOSTERGE_KATMAN[g]), setTarih(null))}
                data-testid="gosterge-satiri"
                data-gosterge={g}
                data-konum={konum ?? 'yetersiz'}
                className="grid min-h-11 w-full grid-cols-[88px_1fr_auto] items-center gap-2.5 rounded-md px-1.5 text-left hover:bg-app-card-hover max-[420px]:grid-cols-[72px_1fr]"
              >
                <span className="text-small font-semibold leading-tight">
                  {katman.ad}
                  {katman.deneysel && <span className="ml-1 rounded-[2px] border border-app-border px-1 text-caption font-medium text-app-text-dim">deneysel</span>}
                </span>
                <span className="relative block h-5" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-app-border" />
                  {band?.onluk_yeterli && band.p10 !== null && band.p90 !== null && <span className="absolute top-[5px] h-2.5 rounded-sm" style={{ left: pos(band.p10), width: `calc(${pos(band.p90)} - ${pos(band.p10)})`, background: 'color-mix(in srgb, var(--color-app-accent) 14%, transparent)' }} />}
                  {band?.ceyrek_yeterli && band.p25 !== null && band.p75 !== null && <span className="absolute top-[3px] h-3.5 rounded-sm" style={{ left: pos(band.p25), width: `calc(${pos(band.p75)} - ${pos(band.p25)})`, background: 'color-mix(in srgb, var(--color-app-accent) 30%, transparent)' }} />}
                  {band?.p50 != null && <span className="absolute top-[2px] h-4 w-px bg-app-text-muted" style={{ left: pos(band.p50) }} />}
                  <span className="absolute top-[3px] h-3.5 w-1.5 -translate-x-1/2 rounded-[1px] bg-app-text" style={{ left: pos(deger) }} />
                </span>
                <span className="num min-w-[132px] text-right text-[12px] max-[420px]:col-span-2 max-[420px]:text-left">
                  <b>{sayi(deger, g === 'lai' ? 1 : 2)}</b>
                  <span className="text-app-text-muted"> · {konum ? KONUM_METNI[konum] : 'yetersiz geçmiş'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
