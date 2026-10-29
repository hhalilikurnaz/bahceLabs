import { useGecmisOzeti } from '../../api/gecmisOzetiApi'
import { SEVIYE_META } from '../../lib/kademe'
import { gunAy } from '../../lib/format'

/**
 * Yıl yıl özet: yaz canlılığı DİĞER yıllara göre (kademe dili, sayı yok), olay sayısı, uyumsuz yıl, hasat (yalnız Saha Defteri kaydı; yoksa «kayıt yok»).
 * Olay sayısına dokununca zaman çizelgesi o yıla süzülür. Yeşerme başlangıcı yalnız güvenilir yıllarda ve «ön değer» etiketiyle.
 */
export function YilTablosu({ gardenId, yilSec, secili }: { gardenId: string; yilSec: (y: number | null) => void; secili: number | null }) {
  const q = useGecmisOzeti(gardenId)
  const o = q.data
  if (q.isLoading) return <div role="status" aria-label="Yıl özeti yükleniyor" className="h-40 animate-pulse rounded-md bg-app-card-hover" />
  if (!o || o.yillar.length === 0) return <section className="rounded-md border border-app-border bg-app-card p-3.5 text-[13px] text-app-text-muted" data-testid="yil-tablosu-bos">Yıl özeti için henüz yeterli uydu geçmişi yok.</section>
  const yesil = new Map(o.yesillenme.map((y) => [y.yil, y]))
  const yesilVar = yesil.size > 0
  return (
    <section aria-label="Yıl yıl özet" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="yil-tablosu">
      <h3 className="text-[13px] font-semibold">Yıl yıl özet</h3>
      <p className="mt-1 text-[12.5px] text-app-text-muted">{o.not_}</p>
      <div className="mt-2 overflow-x-auto" data-testid="yil-tablosu-kap">
        <table className="w-full border-collapse text-left text-[12.5px] max-[560px]:text-[12px]">
          <thead>
            <tr className="border-b border-app-border text-[11.5px] text-app-text-muted">
              <th scope="col" className="py-1.5 pr-1.5 font-semibold">Yıl</th>
              <th scope="col" className="py-1.5 pr-1.5 font-semibold"><span className="max-[560px]:hidden">Yaz canlılığı</span><span className="min-[561px]:hidden">Canlılık</span></th>
              <th scope="col" className="py-1.5 pr-1.5 font-semibold">Olay</th>
              <th scope="col" className="py-1.5 pr-1.5 font-semibold"><span className="max-[560px]:hidden">Uyumsuz mu?</span><span className="min-[561px]:hidden">Uyumsuz</span></th>
              <th scope="col" className="py-1.5 pr-1.5 font-semibold">Hasat</th>
              {yesilVar && <th scope="col" className="py-1.5 font-semibold"><span className="max-[560px]:hidden">Yeşerme (ön değer)</span><span className="min-[561px]:hidden">Yeşerme*</span></th>}
            </tr>
          </thead>
          <tbody>
            {[...o.yillar].reverse().map((y) => {
              const m = y.canlilik ? SEVIYE_META[y.canlilik] : null
              return (
                <tr key={y.yil} data-testid="yil-satiri" data-yil={y.yil} className={`border-b border-app-border/60 ${secili === y.yil ? 'bg-app-card-hover' : ''}`}>
                  <th scope="row" className="num py-1.5 pr-1.5 font-semibold">{y.yil}</th>
                  <td className="py-1.5 pr-2" data-testid="yil-canlilik">{m ? <span style={{ color: m.renk }}><span aria-hidden>{m.isaret}</span> {m.ad}</span> : <span className="text-app-text-muted">{y.canlilik_nedeni ?? 'yetersiz veri'}</span>}</td>
                  <td className="py-1.5 pr-2">
                    {y.olay_sayisi > 0 ? (
                      <button type="button" onClick={() => yilSec(secili === y.yil ? null : y.yil)} aria-pressed={secili === y.yil} title={y.olaylar.map((x) => `${x.tur_adi} ×${x.sayi}`).join(', ')} data-testid="yil-olay" className="num min-h-9 rounded px-1 font-semibold underline-offset-2 hover:underline max-[560px]:min-h-11">{y.olay_sayisi}</button>
                    ) : (
                      <span className="num text-app-text-muted">0</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2" data-testid="yil-uyumsuz">{y.uyumsuz === null ? <span className="text-app-text-muted">analiz yok</span> : y.uyumsuz ? <span title={y.uyumsuz_nedeni ?? undefined}>evet</span> : 'hayır'}</td>
                  <td className="py-1.5 pr-2" data-testid="yil-hasat">{y.hasat.durum === 'kayit' ? <>{y.hasat.adet} kayıt{y.hasat.son_tarih ? <span className="block text-[11px] text-app-text-muted max-[560px]:block min-[561px]:inline"><span className="min-[561px]:before:content-['·_']">{gunAy(y.hasat.son_tarih, 'always')}</span></span> : null}</> : <span className="text-app-text-muted">kayıt yok</span>}</td>
                  {yesilVar && <td className="num py-1.5">{yesil.has(y.yil) ? gunAy(yesil.get(y.yil)!.tarih, 'always') : <span className="text-app-text-muted">—</span>}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!yesilVar && <p className="mt-2 text-[11.5px] text-app-text-dim" data-testid="yesillenme-yok">Yeşerme başlangıcı gösterilmedi: eğri hiçbir yılda yeterince güvenilir değil.</p>}
      <p className="mt-1 text-[11.5px] text-app-text-dim">{o.esik_durumu}{yesilVar ? ' · *yeşerme: yalnız güvenilir yıllarda, ön değer' : ''}</p>
    </section>
  )
}
