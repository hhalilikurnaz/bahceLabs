import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Akordeon, Akordeonlar, BuyukSayi } from './panel/parcalar'
import { usePhenology } from '../api/agroApi'
import { useGecmisOzeti } from '../api/gecmisOzetiApi'
import { useSulamaPlani } from '../api/sulamaApi'
import type { Garden } from '../api/types'
import { useElementWidth } from '../hooks/useElementWidth'
import { dekar, sayi } from '../lib/format'
import { gecmisKarar } from '../lib/karar'
import { gardenPath, sulamaPath } from '../lib/routes'
import { OlayZamanCizelgesi } from './gecmis/OlayZamanCizelgesi'
import { YazHaritalari } from './gecmis/YazHaritalari'
import { YilTablosu } from './gecmis/YilTablosu'
import { Fenoloji } from './panel/Fenoloji'
import { SezonEgrisi } from './panel/SezonEgrisi'
import { useSezonDagilimi } from './useKonum'

/**
 * Geçmiş: tek soru «bu sezon geçmişe göre nasıl?». Karar cümlesi + tek sayı → sadeleşmiş sezon çizgisi → 12 yaz (ortak skala) → ayrıntı akordeonları (olaylar, yıl özeti, fenoloji).
 * Çalışma alanından ayrı sayfadır; her etkileşim (ay, yıl, olay) çalışma alanı haritasını ilgili ana açar.
 */
export function GecmisSayfasi({ garden }: { garden: Garden }) {
  const navigate = useNavigate()
  const ozet = useGecmisOzeti(garden.id).data
  const fenoloji = usePhenology(garden.id).data
  const dagilim = useSezonDagilimi(garden.id)
  const sulama = useSulamaPlani(garden.id).data
  const [yil, setYil] = useState<number | null>(null)
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const simdi = new Date().getFullYear()
  const karar = gecmisKarar(dagilim.ic, dagilim.alt, dagilim.ust)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-app-canvas" data-testid="gecmis-sayfasi">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-3 px-5 py-4 max-[560px]:px-3">
        <Link to={gardenPath(garden.id)} data-testid="calisma-alanina-don" className="inline-flex min-h-11 w-fit items-center text-small font-semibold text-app-text-muted hover:text-app-text">← Çalışma alanı</Link>
        <section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-md border border-app-border bg-app-card p-5" data-testid="gecmis-karar">
          <div>
            <h1 className="text-h1 font-semibold text-app-text" data-testid="gecmis-baslik">{dagilim.yukleniyor ? 'Geçmiş yükleniyor' : karar}</h1>
            <p className="mt-1 text-small text-app-text-dim">{garden.ad} · {dekar(garden.alanDekar)} · {ozet?.ilk_yil ?? '…'}–{simdi}</p>
            {sulama?.durum === 'hazir' && sulama.planlanan_bugune_kadar_m3 != null && (
              <p className="mt-1 text-small text-app-text-muted" data-testid="gecmis-sulama">Sulama: planlanan {sayi(sulama.planlanan_bugune_kadar_m3, 0)} m³ · uygulanan {sulama.uygulanan_sezon_m3 != null ? `${sayi(sulama.uygulanan_sezon_m3, 0)} m³` : 'kayıt yok'} <Link className="font-semibold underline" to={sulamaPath(garden.id)}>Plana git</Link></p>
            )}
          </div>
          {dagilim.n > 0 && (
            <div className="flex items-end gap-3">
              <span className="text-metric font-semibold leading-none"><BuyukSayi metin={String(dagilim.ic + dagilim.ust)} className="text-metric" /><small className="text-h2 font-medium text-app-text-dim">/{dagilim.n}</small></span>
              <div className="pb-1"><b className="block text-body">görüntü normal ya da üstünde</b><span className="text-small text-app-text-muted">{simdi} uydu görüntüleri · {dagilim.alt} tanesi normalin altında</span></div>
            </div>
          )}
        </section>
        <SezonEgrisi gardenId={garden.id} gostergeler={['ndvi', 'ndre', 'ndmi']} ayrintili yukseklik={250} onAy={(katman, tarih) => navigate(`${gardenPath(garden.id)}?katman=${katman}${tarih ? `&tarih=${tarih}` : ''}`)} />
        <YazHaritalari garden={garden} />
        <Akordeonlar>
          <Akordeon baslik="Olaylar" ozet="don, aşırı yağış, rüzgâr ve uydudan görülen ani değişimler" acik><OlayZamanCizelgesi gardenId={garden.id} yil={yil} yilTemizle={() => setYil(null)} /></Akordeon>
          <Akordeon baslik="Yıl yıl özet" ozet="yaz canlılığı, olay sayısı, hasat kaydı"><YilTablosu gardenId={garden.id} yilSec={setYil} secili={yil} /></Akordeon>
          <Akordeon baslik="Ortalama limon yılı" ozet="evre tarihleri · ön değer" testId="gecmis-fenoloji">
            <div ref={ref}>{fenoloji?.evreler?.length ? <Fenoloji evreler={fenoloji.evreler} yil={simdi} genislik={Math.max(300, genislik)} /> : <p className="text-small text-app-text-muted">Bu ürün için fenoloji kuralı yok.</p>}</div>
            {ozet && ozet.yesillenme.length > 0 && (
              <p className="mt-2 text-small" data-testid="yesillenme-listesi"><b>Yeşerme başlangıcı (ön değer, yalnız eğrinin güvenilir olduğu yıllar):</b> {ozet.yesillenme.map((y) => `${y.yil} · ${new Date(`${y.tarih}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`).join(' · ')}</p>
            )}
          </Akordeon>
        </Akordeonlar>
      </div>
    </div>
  )
}
