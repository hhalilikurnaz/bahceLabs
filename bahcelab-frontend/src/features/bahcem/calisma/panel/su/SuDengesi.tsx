import { SuDengesiPaneller, TimeDomainProvider } from '@/components/chart'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { useCalismaStore } from '../../calismaStore'
import type { SuYaniti } from '../../../api/suApi'
import { sayi } from '../../../lib/format'

/** Su dengesi (Yön C): İKİ PANEL, ORTAK ZAMAN EKSENİ, çift eksen yok (bkz. components/chart/SuGrafikleri). Kapasite ve eşik tek satırda. */
export function SuDengesi({ denge }: { denge: SuYaniti['denge'] }) {
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const imlec = useCalismaStore((s) => s.imlecTarih)
  const setImlec = useCalismaStore((s) => s.setImlecTarih)
  if (!denge.gunler.length) return <p className="text-small text-app-text-muted" data-testid="denge-bos">Su dengesi hesaplanamadı: toprak parametreleri (SoilGrids) alınamadı.</p>
  return (
    <div ref={ref} data-testid="su-dengesi">
      <TimeDomainProvider imlec={imlec} setImlec={setImlec}>
        <SuDengesiPaneller gunler={denge.gunler} genislik={Math.max(280, genislik)} />
      </TimeDomainProvider>
      <p className="mt-1 text-small text-app-text-muted">
        Gri taralı bölge: önümüzdeki 7 gün (tahmin). Soluk yağış çubuğu: günlük 2 mm altı, dengede sayılmaz.
        {denge.taw_mm != null && <> Kullanılabilir su kapasitesi ≈ {sayi(denge.taw_mm, 0)} mm, stres eşiği {sayi(denge.tukenme_esigi_mm ?? 0, 0)} mm tükenme.</>}
      </p>
      <p className="text-small text-app-text-muted" data-testid="kc-notu">{denge.kc_notu}.</p>
    </div>
  )
}
