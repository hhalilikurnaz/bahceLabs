import { ErrorState, Skeleton } from '@/components/ui'
import { BosDurum } from '../../kabuk/BosDurum'
import { useSu } from '../../api/suApi'
import type { Garden } from '../../api/types'
import { sayi } from '../../lib/format'
import { BulutAltindaGorus } from './BulutAltindaGorus'
import { KaynakCipi } from './su/KaynakCipi'
import { NemProfili } from './su/NemProfili'
import { SuDengesi } from './su/SuDengesi'
import { YuzeyHava } from './su/YuzeyHava'

const KART = 'rounded-md border border-app-border bg-app-card p-3.5'

/** Su sekmesi (9E): karar cümlesi + kanıt grafikleri (nem profili, su dengesi, bulut altında görüş, yüzey–hava sıcaklığı). Katsayılar ön değerdir. */
export function SuPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, refetch, isFetching } = useSu(garden.id)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-5" data-testid="su-paneli">
      {isLoading ? (
        <Skeleton className="h-28" aria-label="Su durumu yükleniyor" />
      ) : isError || !data ? (
        <ErrorState title="Su durumu alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <>
          <section aria-label="Su durumu kararı" className="space-y-1.5" data-testid="su-karar">
            <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-app-text-dim">Su</div>
            <h2 className="text-[20px] font-bold leading-snug" data-testid="su-karar-cumlesi">{data.karar}</h2>
            <p className="text-[12.5px] text-app-text-muted" data-testid="su-on-deger">
              {data.profil.kok_bolgesi_doluluk != null && <>{data.profil.donem ?? 'Dönem'} normaline göre kök bölgesi doluluğu <b className="num text-app-text" data-testid="su-doluluk">%{Math.round(data.profil.kok_bolgesi_doluluk)}</b> · </>}
              ön değer · mühendis onayı bekliyor
            </p>
          </section>
          <section aria-label="Toprak nem profili" className={KART} data-testid="su-profil">
            <h3 className="text-[13px] font-semibold">Toprak nem profili</h3>
            {data.profil.katmanlar.length ? <NemProfili profil={data.profil} /> : <p className="mt-2 text-[12.5px] text-app-text-muted">Bu hücre için toprak nemi verisi henüz çekilmedi.</p>}
            <KaynakCipi cip={data.kaynaklar.profil} testId="kaynak-profil" />
          </section>
          <section aria-label="Su dengesi" className={KART} data-testid="su-denge">
            <h3 className="text-[13px] font-semibold">Su dengesi</h3>
            <SuDengesi denge={data.denge} />
            <KaynakCipi cip={data.kaynaklar.denge} testId="kaynak-denge" />
          </section>
          <BulutAltindaGorus gardenId={garden.id} />
          <section aria-label="Yüzey ve hava sıcaklığı" className={KART} data-testid="su-sicaklik">
            <h3 className="text-[13px] font-semibold">Yüzey–hava sıcaklığı</h3>
            <YuzeyHava sicaklik={data.sicaklik} />
            <KaynakCipi cip={data.kaynaklar.sicaklik} testId="kaynak-sicaklik" />
          </section>
          <details className={KART} data-testid="su-nasil">
            <summary className="flex min-h-9 cursor-pointer items-center text-[13px] font-semibold max-[560px]:min-h-11">Nasıl hesaplandı?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-snug text-app-text-muted">
              <li>Nem profili: ERA5-Land (9 km, saatlik); son günler ve ileri için Open-Meteo model tahmini, ERA5-Land ile örtüşen günlerden katman farkıyla düzeltilmiş. «Dönem normaline göre doluluk»: her katman için ERA5-Land'in yılın aynı ±15 günü (2015–2025) dağılımında p2 = 0, p98 = 100.</li>
              <li>Su dengesi: ETc = Kc × ET0; Kc, NDVI'dan ön değer ilişkiyle. Kova: kullanılabilir su = (tarla kapasitesi − solma noktası) × kök derinliği{data.toprak.tarla_kapasitesi != null && <> ({sayi(data.toprak.tarla_kapasitesi, 2)} − {sayi(data.toprak.solma_noktasi ?? 0, 2)} m³/m³)</>}. {data.toprak.kaynak}. Bu eşikler ERA5'in mutlak nemine uygulanmaz. Günlük 2 mm'nin altındaki yağış dengede sayılmaz (ön değer). Sulama kararı: «sulama planlayın» yalnız doluluk dönem normaline göre düşükken ve kova stres eşiğinde ya da 7 gün içinde ona inerken çıkar; Hava sekmesindeki sulama kartı aynı kararı gösterir.</li>
              <li>Yüzey sıcaklığı: Landsat 8/9 (30 m ürün, 100 m fiziksel çözünürlük); hava sıcaklığı ERA5-Land.</li>
              <li data-testid="yagis-karari">Yağış kaynağı: {data.denge.yagis_karari}</li>
              {data.dogrulama.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </details>
          <BosDurum gravur="yaprak" baslik="Sulama planı ve karar kartı 9H’de" fayda="Sulama sistemi, kayıtlar ve plan kartı Adım 9H ile gelecek; buradaki cümle yalnızca durum bilgisidir." adim="Adım 9H" testId="bos-su" />
        </>
      )}
    </div>
  )
}
