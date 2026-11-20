import { DEFTER_KARAR } from '../lib/karar'
import { useLayoutEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSahaKayitlari, useSahaTuru } from '../api/sahaApi'
import type { Garden } from '../api/types'
import { dekar } from '../lib/format'
import { gardenPath } from '../lib/routes'
import '../varliklar/defter.css'
import { DogrulamaBolumu } from './defter/DogrulamaBolumu'
import { DogrulukBolumu } from './defter/DogrulukBolumu'
import { KayitFormu, KayitListesi } from './defter/KayitBolumu'
import { KayitCekmecesi } from './defter/KayitCekmecesi'
import { SahaHaritasi } from './defter/SahaHaritasi'
import { TurBolumu } from './defter/TurBolumu'
import { useKonumSecimi } from './defter/useKonumSecimi'

/**
 * Saha Defteri (9G-B): doğrulama aracı — uydunun gördüğünü sahada doğrulama, konumlu kayıtlar ve otomatik saha turu. Editoryal dil yalnız bu sayfada (`.notebook`).
 * Geçmiş sayfasından işlevce ayrıdır: Geçmiş zamanı gösterir, Defter sahadaki gerçeği toplar.
 */
export function DefterSayfasi({ garden }: { garden: Garden }) {
  const konum = useKonumSecimi(garden.id)
  const [params, setParams] = useSearchParams()
  const [kayitAcik, setKayitAcik] = useState(params.get('kayit') === 'yeni')
  // ≤ 900 px: harita ekranın üstüne oturur, çekmece haritanın altında kalan yüksekliğe sığar (harita ile form AYNI görünümde). DOM'a doğrudan yazılır (dış sistem eşitlemesi).
  const yerlestir = () => {
    const kap = document.querySelector<HTMLElement>('[data-testid="defter-sayfasi"]')
    const harita = document.querySelector<HTMLElement>('[data-testid="saha-haritasi"]')
    const cekmece = document.querySelector<HTMLElement>('[data-testid="kayit-cekmecesi"]')
    if (!kap || !harita || !cekmece) return
    if (window.matchMedia('(max-width: 900px)').matches) {
      kap.scrollTo({ top: harita.getBoundingClientRect().top - kap.getBoundingClientRect().top + kap.scrollTop })
      cekmece.style.maxHeight = `${Math.max(260, Math.floor(window.innerHeight - harita.getBoundingClientRect().bottom))}px`
    } else cekmece.style.maxHeight = ''
    cekmece.dataset.yerlesti = 'true'
    window.dispatchEvent(new Event('resize')) // harita yeni yüksekliğine uysun
  }
  const kayitAc = () => setKayitAcik(true)
  const kayitKapat = () => {
    setKayitAcik(false)
    if (params.has('kayit')) setParams((p) => (p.delete('kayit'), p), { replace: true })
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
  }
  // Açılınca (düğme ya da ?kayit=yeni) DOM güncellendikten sonra, boyamadan ÖNCE yerleştirilir: ara bir kare yok
  useLayoutEffect(() => {
    if (kayitAcik) yerlestir()
  }, [kayitAcik]) // eslint-disable-line react-hooks/exhaustive-deps
  const [seciliKayit, setSeciliKayit] = useState<string | null>(null)
  const [seciliNokta, setSeciliNokta] = useState<string | null>(null)
  const sec = (id: string) => (/^(olay|bolge|yama):/.test(id) ? setSeciliNokta(id) : setSeciliKayit(id)) // tur noktası anahtarları ön ekli; kayıtlar kimlik
  const [baslangic, setBaslangic] = useState<{ lng: number; lat: number } | null>(null)
  const [kayitlarGorunur, setKayitlarGorunur] = useState(true)
  const kayitlar = useSahaKayitlari(garden.id).data ?? []
  const tur = useSahaTuru(garden.id, baslangic).data
  return (
    <div className="notebook min-h-0 flex-1 overflow-y-auto max-[900px]:overflow-y-auto" data-testid="defter-sayfasi">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--rule)] px-5 py-3 max-[560px]:px-3">
        <Link to={gardenPath(garden.id)} className="btn max-[560px]:!h-11" data-testid="calisma-alanina-don">← Çalışma alanı</Link>
        <h1 className="text-h1 font-semibold leading-tight" data-testid="defter-baslik">{DEFTER_KARAR}</h1>
        <span className="text-small text-[var(--ink-3)]">{garden.ad} · {dekar(garden.alanDekar)} · sahaya çıkarken, yazdırılabilir</span>
      </div>
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-0 max-[900px]:grid-cols-[minmax(0,1fr)]">
        <section aria-label="Saha haritası" data-testid="saha-haritasi" className={`sticky top-0 h-[calc(100vh-170px)] min-h-[420px] border-r border-[var(--rule)] max-[900px]:border-r-0 ${kayitAcik ? 'max-[900px]:z-20 max-[900px]:h-[30dvh] max-[900px]:min-h-0' : 'max-[900px]:relative max-[900px]:h-[56vh]'}`}>
          <SahaHaritasi garden={garden} kayitlar={kayitlar} tur={tur} konum={konum} secili={seciliKayit ?? seciliNokta} sec={sec} kayitlarGorunur={kayitlarGorunur} />
          <label className="absolute left-3 top-3 z-10 flex min-h-11 items-center gap-2 border border-[var(--rule-2)] bg-[var(--paper)] px-3 text-[12px] font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={kayitlarGorunur} onChange={(e) => setKayitlarGorunur(e.target.checked)} data-testid="kayit-katmani" /> Saha kayıtları ({kayitlar.filter((k) => k.konum).length})
          </label>
        </section>
        <div className="grid content-start gap-7 px-5 py-5 max-[560px]:px-3">
          <TurBolumu gardenId={garden.id} kayitSec={setSeciliKayit} noktaSec={setSeciliNokta} seciliNokta={seciliNokta} baslangic={baslangic} setBaslangic={setBaslangic} />
          <DogrulamaBolumu gardenId={garden.id} />
          <DogrulukBolumu gardenId={garden.id} />
          <section aria-label="Saha kayıtları ve yeni kayıt">
            <span className="eyebrow">KAYITLAR</span>
            <h2 className="serif mb-2 mt-1 text-[22px] leading-tight">Sahadan notlar.</h2>
            <button type="button" onClick={kayitAc} data-testid="kayit-ekle-satir" className="btn primary">+ Yeni kayıt</button>
            <div className="mt-4"><KayitListesi gardenId={garden.id} secili={seciliKayit} sec={setSeciliKayit} /></div>
          </section>
        </div>
      </div>
      {!kayitAcik && (
        <button type="button" onClick={kayitAc} data-testid="kayit-ekle" className="btn primary fixed bottom-4 right-4 z-30 !min-h-12 px-5 shadow-lg" aria-label="Yeni kayıt ekle">+ Kayıt</button>
      )}
      {kayitAcik && (
        <KayitCekmecesi kapat={kayitKapat}>
          <KayitFormu gardenId={garden.id} konum={konum} kaydedildi={kayitKapat} />
        </KayitCekmecesi>
      )}
    </div>
  )
}
