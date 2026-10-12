import { Link } from 'react-router-dom'
import { ErrorState, Skeleton } from '@/components/ui'
import type { Garden } from '../../api/types'
import { useMultiyear, useStartMultiyear, type MultiyearYear } from '../../api/multiyearApi'
import { BosDurum } from '../../kabuk/BosDurum'
import { gardenPagePath } from '../../lib/routes'
import { useCalismaStore } from '../calismaStore'
import { BolgeTablosu } from './BolgeTablosu'
import { YilSorusu } from './YilSorusu'

function yilDurumu(y: MultiyearYear): string {
  if (y.yetersiz_veri) return 'yetersiz veri'
  if (y.karar_bekliyor) return y.dahil ? 'uyumsuz · analizde' : 'uyumsuz · hariç'
  return y.dahil ? 'analizde' : 'hariç'
}

/** Yıl yıl veri: net sahne, dönem kapsamı ve durum. «Yetersiz veri» analize girmez ve soru sorulmaz. */
function YilTablosu({ yillar }: { yillar: MultiyearYear[] }) {
  return (
    <details className="rounded-md border border-app-border bg-app-card" data-testid="yil-tablosu">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[13px] font-semibold">
        Yıl yıl veri ({yillar.length} yıl)
        <span aria-hidden className="text-app-text-muted">⌄</span>
      </summary>
      <div className="overflow-x-auto border-t border-app-border">
        <table className="w-full min-w-[400px] text-left text-[12.5px]">
          <thead className="text-[11px] uppercase tracking-[.06em] text-app-text-dim">
            <tr><th className="px-3 py-1.5 font-semibold">Yıl</th><th className="px-2 py-1.5 text-right font-semibold">Net sahne</th><th className="px-2 py-1.5 text-right font-semibold">Dönem kapsamı</th><th className="px-3 py-1.5 font-semibold">Durum</th></tr>
          </thead>
          <tbody>
            {yillar.map((y) => (
              <tr key={y.yil} className="border-t border-app-border" data-testid="yil-satiri" data-yil={y.yil} title={y.yetersiz_nedeni ?? y.uyumsuz_nedeni ?? undefined}>
                <th scope="row" className="num px-3 py-1.5 font-semibold">{y.yil}{y.kismi ? ' · kısmi yıl' : ''}</th>
                <td className="num px-2 py-1.5 text-right">{y.sahne_sayisi}</td>
                <td className="num px-2 py-1.5 text-right">{y.donem_kapsami === null ? '—' : `%${Math.round(y.donem_kapsami * 100)}`}</td>
                <td className="px-3 py-1.5">{yilDurumu(y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Analiz sekmesi (v1): bulgu cümlesi · uyumsuz yıl soruları · bölge tablosu · yıl yıl veri · «tüm yıllar» kartı. */
export function AnalizPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, refetch, isFetching } = useMultiyear(garden.id)
  const baslat = useStartMultiyear(garden.id)
  const setKatman = useCalismaStore((s) => s.setKatman)
  if (isLoading) return <div className="p-5"><Skeleton className="h-48" aria-label="Analiz yükleniyor" /></div>
  if (isError || !data) return <div className="p-5"><ErrorState title="Analiz alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} /></div>
  if (data.durum === 'yok') {
    return (
      <BosDurum gravur="yaprak" baslik="Çok yıllık analiz henüz yok" fayda="Bahçenin yıllar içindeki güçlü ve zayıf kesimlerini bulmak için uydu arşivi yıl yıl işlenir; birkaç dakika sürer." testId="analiz-yok">
        <button type="button" onClick={() => baslat.mutate()} disabled={baslat.isPending} className="h-11 rounded-md bg-app-primary px-4 text-[14px] font-semibold text-app-on-primary disabled:opacity-60">Analizi başlat</button>
      </BosDurum>
    )
  }
  const sorular = data.yillar.filter((y) => y.uyumsuz && !y.yetersiz_veri)
  const yorumlar = data.yorumlar
  const bulgu = data.durum === 'hazir' ? (yorumlar[0] ?? 'Bölgeler hesaplandı.') : data.durum === 'islem_suruyor' ? 'Analiz sürüyor.' : 'Bölgeleme için yeterli veri yok.'
  return (
    <div className="grid gap-4 p-5" data-testid="analiz-paneli">
      <section aria-label="Bulgu">
        <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-app-text-dim">Analiz{data.yil_araligi ? ` · ${data.yil_araligi}` : ''}</div>
        <h2 className="mt-0.5 text-[20px] font-bold leading-snug" data-testid="analiz-bulgu">{bulgu}</h2>
        {data.durum === 'hazir' && yorumlar.slice(1).map((y) => <p key={y} className="mt-1 text-[14px] text-app-text-muted">{y}</p>)}
        {data.durum !== 'hazir' && data.mesaj && <p className="mt-1 text-[14px] text-app-text-muted">{data.mesaj}</p>}
      </section>

      {sorular.length > 0 && (
        <section aria-label="Uyumsuz yıllar" className="grid gap-2">
          <h3 className="text-[13px] font-semibold">Uyumsuz yıllar</h3>
          <ul className="grid gap-2">{sorular.map((y) => <YilSorusu key={y.yil} gardenId={garden.id} yil={y} />)}</ul>
        </section>
      )}

      {data.durum === 'hazir' && (
        <section aria-label="Bölgeler" className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold">Ağaç gücü bölgeleri</h3>
            <button type="button" onClick={() => setKatman('bolgeler')} className="h-11 rounded-md px-3 text-[13px] font-semibold text-app-accent underline-offset-2 hover:underline">Haritada göster</button>
          </div>
          <BolgeTablosu ozet={data.ozet} />
          <p className="text-[12px] text-app-text-dim">Ön değer · mühendis onayı bekliyor. {data.not_}</p>
        </section>
      )}

      <YilTablosu yillar={data.yillar} />

      <Link to={gardenPagePath(garden.id, 'gecmis')} data-testid="tum-yillar" className="flex min-h-11 items-center justify-between rounded-md border border-app-border bg-app-card px-3.5 py-3 text-[14px] font-semibold hover:border-app-text">
        <span>{data.yillar.length} yılın tamamı</span>
        <span aria-hidden>↗</span>
      </Link>
    </div>
  )
}
