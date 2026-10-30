import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/ui'
import type { Garden } from '../../api/types'
import { useMultiyear, useStartMultiyear, type MultiyearYear, type MultiyearZone } from '../../api/multiyearApi'
import { ZONE_SHADES } from '../../lib/paletler'
import { BosDurum } from '../../kabuk/BosDurum'
import { gardenPagePath } from '../../lib/routes'
import { analizBuyukSayi, analizKarar } from '../../lib/karar'
import { BolgeTablosu } from './BolgeTablosu'
import { Akordeon, Akordeonlar, IkincilKart, KararBlogu, PanelKabuk, Yapilacaklar } from './parcalar'
import { YilSorusu } from './YilSorusu'

function yilDurumu(y: MultiyearYear): string {
  if (y.yetersiz_veri) return 'yetersiz veri'
  if (y.karar_bekliyor) return y.dahil ? 'uyumsuz · analizde' : 'uyumsuz · hariç'
  return y.dahil ? 'analizde' : 'hariç'
}

/** Yıl yıl veri: net sahne, dönem kapsamı ve durum. «Yetersiz veri» analize girmez ve soru sorulmaz. */
function YilTablosu({ yillar }: { yillar: MultiyearYear[] }) {
  return (
    <div data-testid="yil-tablosu">
      <div className="@container border-t border-app-border">
        <table className="w-full table-fixed text-left text-small">
          <thead className="text-caption text-app-text-dim">
            <tr><th className="px-3 py-1.5 font-semibold">Yıl</th><th className="px-2 py-1.5 text-right font-semibold">Net sahne</th><th className="px-2 py-1.5 text-right font-semibold @max-[400px]:hidden">Haz–Eyl ay kapsamı</th><th className="px-3 py-1.5 font-semibold">Durum</th></tr>
          </thead>
          <tbody>
            {yillar.map((y) => (
              <tr key={y.yil} className="border-t border-app-border" data-testid="yil-satiri" data-yil={y.yil} title={y.yetersiz_nedeni ?? y.uyumsuz_nedeni ?? undefined}>
                <th scope="row" className="num px-3 py-1.5 font-semibold">{y.yil}{y.kismi ? ' · kısmi yıl' : ''}</th>
                <td className="num px-2 py-1.5 text-right" title={`Analiz penceresinde ${y.sahne_sayisi} net sahne`}>{y.yil_net_sahne}</td>
                <td className="num px-2 py-1.5 text-right @max-[400px]:hidden">{y.donem_kapsami === null ? '—' : `%${Math.round(y.donem_kapsami * 100)}`}</td>
                <td className="px-3 py-1.5">{yilDurumu(y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Bölge alan payı: tek çubuk (güçlü / orta / zayıf, zayıf taralı); doğrudan etiketli. */
function PayCubugu({ ozet }: { ozet: MultiyearZone[] }) {
  const sirali = [...ozet].sort((a, b) => b.sinif - a.sinif)
  return (
    <div data-testid="bolge-pay-cubugu" role="img" aria-label={`Alan payı: ${sirali.map((z) => `${z.ad} %${Math.round(z.pay * 100)}`).join(', ')}`}>
      <div className="flex h-5 overflow-hidden rounded-sm border border-app-border">
        {sirali.map((z) => <span key={z.sinif} style={{ width: `${z.pay * 100}%`, background: z.sinif === 1 ? `repeating-linear-gradient(45deg, rgb(23 32 27 / .55) 0 1.5px, transparent 1.5px 5px), ${ZONE_SHADES[1]}` : ZONE_SHADES[z.sinif] }} />)}
      </div>
      <div className="mt-1 flex text-small text-app-text-muted">
        {sirali.map((z) => <span key={z.sinif} style={{ width: `${z.pay * 100}%` }} className="min-w-0 truncate tabular-nums"><b className="text-app-text">{z.ad}</b> %{Math.round(z.pay * 100)}</span>)}
      </div>
    </div>
  )
}

/** Analiz sekmesi (Yön C): karar cümlesi → «3,6 da sürekli zayıf alan» → bölge payı çubuğu + tablo → Yapılacaklar (karar bekleyen yıl) → ayrıntı. Harita: Bölgeler katmanı. */
export function AnalizPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useMultiyear(garden.id)
  const baslat = useStartMultiyear(garden.id)
  if (isLoading) return <PanelKabuk karar={null} testId="analiz-yukleniyor"><div className="m-skeleton space-y-3 rounded-md border border-app-border bg-app-card p-5" role="status" aria-label="Analiz yükleniyor"><div className="h-8 w-4/5 rounded bg-app-card-hover" /><div className="h-14 w-2/5 rounded bg-app-card-hover" /><div className="h-32 rounded bg-app-card-hover" /></div></PanelKabuk>
  if (isError || !data) return <PanelKabuk karar={null} testId="analiz-hata"><ErrorState title="Analiz alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} /></PanelKabuk>
  if (data.durum === 'yok') {
    return (
      <PanelKabuk karar={null} testId="analiz-bos">
        <BosDurum gravur="yaprak" baslik="Çok yıllık analiz henüz yok" fayda="Bahçenin yıllar içindeki güçlü ve zayıf kesimlerini bulmak için uydu arşivi yıl yıl işlenir; birkaç dakika sürer." testId="analiz-yok">
          <button type="button" onClick={() => baslat.mutate()} disabled={baslat.isPending} className="h-11 rounded-md bg-app-primary px-4 text-body font-semibold text-app-on-primary disabled:opacity-60">Analizi başlat</button>
        </BosDurum>
      </PanelKabuk>
    )
  }
  const sorular = data.yillar.filter((y) => y.uyumsuz && !y.yetersiz_veri)
  const hazir = data.durum === 'hazir'
  const zayif = data.ozet.find((z) => z.sinif === 1)
  const bulgu = analizKarar({ hazir, sureniyor: data.durum === 'islem_suruyor', homojen: data.homojen, zayifPay: zayif?.pay ?? null })
  const sayi = hazir ? analizBuyukSayi(zayif?.alan_dekar ?? null) : null
  return (
    <PanelKabuk karar={bulgu} testId="analiz-paneli">
      <KararBlogu testId="analiz-karar" karar={bulgu} sayi={sayi?.buyuk ?? null} etiket={sayi?.etiket}
        kucuk={zayif ? `bahçenin %${Math.round(zayif.pay * 100)}’i${zayif.fark_yuzde !== null ? ` · yıllardır normalin %${Math.abs(zayif.fark_yuzde).toFixed(1).replace('.', ',')} ${zayif.fark_yuzde < 0 ? 'altında' : 'üstünde'}` : ''}` : undefined}>
        <span hidden data-testid="analiz-bulgu">{bulgu}</span>
        {data.durum !== 'hazir' && data.mesaj && <p className="mt-2 text-body text-app-text-muted">{data.mesaj}</p>}
        {hazir && data.yorumlar.map((y) => <p key={y} className="mt-2 text-body text-app-text-muted">{y}</p>)}
      </KararBlogu>
      {hazir && (
        <section aria-label="Bölgeler" className="rounded-md border border-app-border bg-app-card p-4" data-testid="bolgeler-karti">
          <h3 className="text-lead font-semibold">Bahçenin güçlü ve zayıf kesimleri</h3>
          <div className="mt-3"><PayCubugu ozet={data.ozet} /></div>
          <div className="mt-3"><BolgeTablosu ozet={data.ozet} /></div>
          <p className="mt-2 text-caption text-app-text-dim">Ön değer · mühendis onayı bekliyor. {data.not_}</p>
        </section>
      )}
      {sorular.length > 0 && (
        <Yapilacaklar testId="analiz-yapilacaklar">
          <p className="mt-0.5 text-small text-app-text-dim">Uyumsuz görünen yıllar için karar bekleniyor.</p>
          <ul className="mt-2 grid gap-2">{sorular.map((y) => <YilSorusu key={y.yil} gardenId={garden.id} yil={y} />)}</ul>
        </Yapilacaklar>
      )}
      <IkincilKart baslik="Tüm yıllar" testId="tum-yillar-karti">
        <Link to={gardenPagePath(garden.id, 'gecmis')} data-testid="tum-yillar" className="flex min-h-11 items-center justify-between rounded-md border border-app-border px-3 text-body font-semibold hover:border-app-border-strong"><span>{data.yillar.length} yılın tamamı</span><span aria-hidden>↗</span></Link>
      </IkincilKart>
      <Akordeonlar>
        <Akordeon baslik="Yıl yıl veri" ozet={`${data.yillar.length} yıl`}><YilTablosu yillar={data.yillar} /></Akordeon>
      </Akordeonlar>
    </PanelKabuk>
  )
}
