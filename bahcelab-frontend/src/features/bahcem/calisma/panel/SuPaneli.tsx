import { StaleBadge } from '@/components/chart'
import { ErrorState } from '@/components/ui'
import { useSu } from '../../api/suApi'
import type { Garden } from '../../api/types'
import { sayi } from '../../lib/format'
import { suKarar } from '../../lib/karar'
import { BulutAltindaGorus } from './BulutAltindaGorus'
import { Akordeon, Akordeonlar, IkincilKart, KararBlogu, PanelKabuk } from './parcalar'
import { KaynakCipi } from './su/KaynakCipi'
import { SulamaKarti } from './su/SulamaKarti'
import { NemProfili } from './su/NemProfili'
import { SuDengesi } from './su/SuDengesi'
import { YuzeyHava } from './su/YuzeyHava'

const gunOnce = (iso: string): number => Math.max(0, Math.round((Date.now() - Date.parse(`${iso}T12:00:00Z`)) / 86_400_000))

/** Su sekmesi (Yön C): karar cümlesi → kök bölgesi doluluğu (%) → iki panelli su dengesi → ikincil kartlar (nem profili, yüzey–hava) → Sulama planı kartı → ayrıntı. Katsayılar ön değerdir. */
export function SuPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useSu(garden.id)
  const karar = data ? suKarar(data.karar_detay.durum, data.profil.kok_bolgesi_sinif) : null
  return (
    <PanelKabuk karar={karar} testId="su-paneli">
      {isLoading ? (
        <div className="m-skeleton space-y-3 rounded-md border border-app-border bg-app-card p-5" role="status" aria-label="Su durumu yükleniyor"><div className="h-8 w-4/5 rounded bg-app-card-hover" /><div className="h-14 w-2/5 rounded bg-app-card-hover" /><div className="h-40 rounded bg-app-card-hover" /></div>
      ) : isError || !data ? (
        <ErrorState title="Su durumu alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <>
          <div data-testid="su-karar">
            <KararBlogu karar={karar!} testId="su-karar-blogu" sayi={data.profil.kok_bolgesi_doluluk != null ? `%${Math.round(data.profil.kok_bolgesi_doluluk)}` : null} etiket="kök bölgesi doluluğu"
              kucuk={<span data-testid="su-on-deger">{data.profil.donem ?? 'Dönem'} normaline göre · ön değer · mühendis onayı bekliyor</span>} yas={<StaleBadge kaynak="ERA5-Land · 9 km" gun={data.profil.bugun_tarihi ? gunOnce(data.profil.bugun_tarihi) : null} />}>
              {(data.ayni_hucre_bahceler?.length ?? 0) > 0 && <p className="mt-3 text-small text-app-text-muted" data-testid="ayni-hucre-notu">Bu bahçe, {data.ayni_hucre_bahceler!.join(', ')} ile aynı 9 km’lik hava hücresinde: toprak nemi, yağış ve sıcaklık verisi birebir aynıdır.</p>}
              
            </KararBlogu>
          </div>
          <section className="rounded-md border border-app-border bg-app-card p-4" data-testid="su-denge" aria-label="Su dengesi">
            <h3 className="text-lead font-semibold">Yağış ve bitki tüketimi <span className="text-small font-normal text-app-text-dim">son 30 gün, önümüzdeki 7 gün</span></h3>
            <div className="mt-2"><SuDengesi denge={data.denge} /></div>
            <KaynakCipi cip={data.kaynaklar.denge} testId="kaynak-denge" />
          </section>
          <IkincilKart baslik="Toprak nem profili" testId="su-profil">
            {data.profil.katmanlar.length ? <NemProfili profil={data.profil} /> : <p className="text-small text-app-text-muted">Bu hücre için toprak nemi verisi henüz çekilmedi.</p>}
            <KaynakCipi cip={data.kaynaklar.profil} testId="kaynak-profil" />
          </IkincilKart>
          <IkincilKart baslik="Yüzey ve hava sıcaklığı" testId="su-sicaklik">
            <YuzeyHava sicaklik={data.sicaklik} />
            <KaynakCipi cip={data.kaynaklar.sicaklik} testId="kaynak-sicaklik" />
          </IkincilKart>
          <SulamaKarti gardenId={garden.id} />
          <Akordeonlar>
            <Akordeon baslik="Bulut altında görüş" ozet="optik ve radar geçişleri, son 90 gün"><BulutAltindaGorus gardenId={garden.id} /></Akordeon>
            <Akordeon baslik="Nasıl hesaplandı?" ozet="ön değer · mühendis onayı bekliyor" testId="su-nasil">
              <ul className="list-disc space-y-1 pl-5 text-small leading-snug text-app-text-muted">
                <li data-testid="su-karar-cumlesi">{data.karar}</li>
                <li>Nem profili: ERA5-Land (9 km, saatlik); son günler ve ileri için Open-Meteo model tahmini, ERA5-Land ile örtüşen günlerden katman farkıyla düzeltilmiş. «Dönem normaline göre doluluk»: her katman için ERA5-Land'in yılın aynı ±15 günü, bu hücrenin 2015–2025 dağılımına göre.</li>
                <li>Su dengesi: bitki tüketimi (ETc) = Kc × ET0; Kc, canlılıktan ön değer ilişkiyle. Kova: kullanılabilir su = (tarla kapasitesi − solma noktası) × kök derinliği{data.toprak.tarla_kapasitesi != null && <> ({sayi(data.toprak.tarla_kapasitesi, 2)} − {sayi(data.toprak.solma_noktasi ?? 0, 2)})</>}.</li>
                <li>Yüzey sıcaklığı: Landsat 8/9 (30 m ürün, 100 m fiziksel çözünürlük); hava sıcaklığı ERA5-Land.</li>
                <li data-testid="yagis-karari">Yağış kaynağı: {data.denge.yagis_karari}</li>
                {data.dogrulama.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </Akordeon>
          </Akordeonlar>
        </>
      )}
    </PanelKabuk>
  )
}
