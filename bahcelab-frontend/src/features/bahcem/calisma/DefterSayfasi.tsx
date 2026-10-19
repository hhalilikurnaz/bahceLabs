import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSahaKayitlari, useSahaTuru } from '../api/sahaApi'
import type { Garden } from '../api/types'
import { dekar } from '../lib/format'
import { gardenPath } from '../lib/routes'
import '../varliklar/defter.css'
import { DogrulamaBolumu } from './defter/DogrulamaBolumu'
import { DogrulukBolumu } from './defter/DogrulukBolumu'
import { KayitFormu, KayitListesi } from './defter/KayitBolumu'
import { SahaHaritasi } from './defter/SahaHaritasi'
import { TurBolumu } from './defter/TurBolumu'
import { useKonumSecimi } from './defter/useKonumSecimi'

/**
 * Saha Defteri (9G-B): doğrulama aracı — uydunun gördüğünü sahada doğrulama, konumlu kayıtlar ve otomatik saha turu. Editoryal dil yalnız bu sayfada (`.notebook`).
 * Geçmiş sayfasından işlevce ayrıdır: Geçmiş zamanı gösterir, Defter sahadaki gerçeği toplar.
 */
export function DefterSayfasi({ garden }: { garden: Garden }) {
  const konum = useKonumSecimi()
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
        <h1 className="serif text-[28px] leading-none" data-testid="defter-baslik">Saha Defteri</h1>
        <span className="text-[12.5px] text-[var(--ink-3)]">{garden.ad} · {dekar(garden.alanDekar)} · sahaya çıkarken, yazdırılabilir</span>
      </div>
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-0 max-[900px]:grid-cols-[minmax(0,1fr)]">
        <section aria-label="Saha haritası" className="sticky top-0 h-[calc(100vh-170px)] min-h-[420px] border-r border-[var(--rule)] max-[900px]:static max-[900px]:h-[56vh] max-[900px]:border-r-0">
          <SahaHaritasi garden={garden} kayitlar={kayitlar} tur={tur} konum={konum} secili={seciliKayit ?? seciliNokta} sec={sec} kayitlarGorunur={kayitlarGorunur} />
          <label className="absolute left-3 top-3 z-10 flex min-h-9 items-center gap-2 border border-[var(--rule-2)] bg-[var(--paper)] px-2.5 text-[12px] font-semibold max-[560px]:min-h-11">
            <input type="checkbox" checked={kayitlarGorunur} onChange={(e) => setKayitlarGorunur(e.target.checked)} data-testid="kayit-katmani" /> Saha kayıtları ({kayitlar.filter((k) => k.konum).length})
          </label>
        </section>
        <div className="grid content-start gap-7 px-5 py-5 max-[560px]:px-3">
          <TurBolumu gardenId={garden.id} kayitSec={setSeciliKayit} noktaSec={setSeciliNokta} seciliNokta={seciliNokta} baslangic={baslangic} setBaslangic={setBaslangic} />
          <DogrulamaBolumu gardenId={garden.id} />
          <DogrulukBolumu gardenId={garden.id} />
          <section aria-label="Saha kayıtları ve yeni kayıt">
            <span className="eyebrow">KAYITLAR</span>
            <h2 className="serif mb-2 mt-1 text-[22px] leading-tight">Sahadan notlar.</h2>
            <KayitFormu gardenId={garden.id} konum={konum} />
            <div className="mt-4"><KayitListesi gardenId={garden.id} secili={seciliKayit} sec={setSeciliKayit} /></div>
          </section>
        </div>
      </div>
    </div>
  )
}
