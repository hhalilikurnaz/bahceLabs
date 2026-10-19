import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePhenology } from '../api/agroApi'
import { useGecmisOzeti } from '../api/gecmisOzetiApi'
import type { Garden } from '../api/types'
import { useElementWidth } from '../hooks/useElementWidth'
import { dekar } from '../lib/format'
import { gardenPath } from '../lib/routes'
import { OlayZamanCizelgesi } from './gecmis/OlayZamanCizelgesi'
import { YazHaritalari } from './gecmis/YazHaritalari'
import { YilTablosu } from './gecmis/YilTablosu'
import { Fenoloji, SezonEgrisi } from './panel/SezonEgrisi'

/**
 * Geçmiş (9G): bahçenin yıllar içindeki seyri — bu sezon / önceki sezonlar, yaz yaz küçük haritalar, olay zaman çizelgesi, yıl özeti ve fenoloji.
 * Çalışma alanından ayrı bir sayfadır; her etkileşim (ay, yıl, olay) çalışma alanı haritasını ilgili ana açar.
 */
export function GecmisSayfasi({ garden }: { garden: Garden }) {
  const navigate = useNavigate()
  const ozet = useGecmisOzeti(garden.id).data
  const fenoloji = usePhenology(garden.id).data
  const [yil, setYil] = useState<number | null>(null)
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const simdi = new Date().getFullYear()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-app-bg" data-testid="gecmis-sayfasi">
      <div className="mx-auto max-w-[1180px] px-5 py-5 max-[560px]:px-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <Link to={gardenPath(garden.id)} data-testid="calisma-alanina-don" className="inline-flex min-h-11 items-center rounded-md border border-app-border px-3 text-[13px] font-semibold hover:border-app-text">← Çalışma alanı</Link>
          <div>
            <div className="text-[11.5px] text-app-text-muted">{garden.ad} · {dekar(garden.alanDekar)}</div>
            <h2 className="text-[22px] font-bold leading-tight" data-testid="gecmis-baslik">Geçmiş · {ozet?.ilk_yil ?? '…'}–{simdi}</h2>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
          <SezonEgrisi gardenId={garden.id} gostergeler={['ndvi', 'ndre', 'ndmi']} baslikSezonSayili onAy={(katman, tarih) => navigate(`${gardenPath(garden.id)}?katman=${katman}${tarih ? `&tarih=${tarih}` : ''}`)} />
          <YazHaritalari garden={garden} />
          <OlayZamanCizelgesi gardenId={garden.id} yil={yil} yilTemizle={() => setYil(null)} />
          <YilTablosu gardenId={garden.id} yilSec={setYil} secili={yil} />
          <section aria-label="Fenoloji" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="gecmis-fenoloji">
            <h3 className="text-[13px] font-semibold">Ortalama limon yılı</h3>
            <p className="mt-1 text-[12.5px] text-app-text-muted">Evre tarihleri katalogdan gelir · ön değer · mühendis onayı bekliyor.</p>
            <div ref={ref} className="mt-2">{fenoloji?.evreler?.length ? <Fenoloji evreler={fenoloji.evreler} yil={simdi} genislik={Math.max(300, genislik)} /> : <p className="text-[13px] text-app-text-muted">Bu ürün için fenoloji kuralı yok.</p>}</div>
            {ozet && ozet.yesillenme.length > 0 && (
              <p className="mt-2 text-[12.5px]" data-testid="yesillenme-listesi">
                <b>Yeşerme başlangıcı (ön değer, yalnız eğrinin güvenilir olduğu yıllar):</b>{' '}
                {ozet.yesillenme.map((y) => `${y.yil} · ${new Date(`${y.tarih}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`).join(' · ')}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
