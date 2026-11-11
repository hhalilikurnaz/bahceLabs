import { useEffect, useState } from 'react'
import { VanaOdagi } from './VanaOdagi'
import { useSulamaHaritaStore } from '../harita/sulamaHaritaStore'
import { Link } from 'react-router-dom'
import { ChartFrame, ChartState, SuDengesiGrafigi, TimeDomainProvider, ToprakSuyuGrafigi } from '@/components/chart'
import { Button, ErrorState } from '@/components/ui'
import { useSulamaPanel, type PanelYaniti } from '../../../api/sulamaPanelApi'
import { useSulamaProfili } from '../../../api/sulamaApi'
import type { Garden } from '../../../api/types'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { GUVEN_AD, geciciNotu, sulamaNeden, sulamaPanelKarar, suDengesiCumlesi, toprakSuyuCumlesi } from '../../../lib/karar'
import { gardenPath } from '../../../lib/routes'
import { suDengesi } from '../../../lib/sulamaPanel'
import { useCalismaStore } from '../../calismaStore'
import { KararBlogu, PanelKabuk } from '../../panel/parcalar'
import { SulamaSihirbazi } from '../SulamaSihirbazi'
import { BugunSekmesi } from './BugunSekmesi'
import { KpiSatiri } from './KpiSatiri'
import { SimulasyonSekmesi } from './SimulasyonSekmesi'


function ToprakSuyuBlogu({ panel }: { panel: PanelYaniti }) {
  const [ref, w] = useElementWidth<HTMLDivElement>()
  const imlec = useCalismaStore((s) => s.imlecTarih)
  const setImlec = useCalismaStore((s) => s.setImlecTarih)
  const cumle = toprakSuyuCumlesi({ ...panel, sektor_sayisi: panel.sektorler.length })
  return (
    <ChartFrame mesaj="Toprak suyu · vanalara göre" testId="toprak-suyu-karti" ayrinti={<p>Çizgi her vananın kullanılabilir su yüzdesi (100 = tarla kapasitesi, %{panel.stres_pct} altı bitki stresi). Son 14 gün düz, sonraki 7 gün tahmindir (kesikli, taralı). Üçgen: sulama günü (dolu = uyguladığınız, boş = planlanan).</p>}>
      <div ref={ref}>
        <TimeDomainProvider imlec={imlec} setImlec={setImlec}>
          <ToprakSuyuGrafigi vanalar={panel.sektorler.map((s) => ({ ad: s.ad, gunler: s.gunler }))} bugun={panel.bugun} genislik={Math.max(280, w)} stresPct={panel.stres_pct} yakinPct={panel.yakin_pct} yeterliPct={panel.yeterli_pct} tetikPct={panel.tetik_pct} />
        </TimeDomainProvider>
      </div>
      {cumle && <p className="mt-1 text-small text-app-text" data-testid="toprak-suyu-cumlesi">{cumle}</p>}
      {geciciNotu(panel.gecici_gun) && <p className="mt-1 text-caption text-app-text-muted" data-testid="gecici-notu">{geciciNotu(panel.gecici_gun)}</p>}
    </ChartFrame>
  )
}

function SuDengesiBlogu({ panel }: { panel: PanelYaniti }) {
  const [ref, w] = useElementWidth<HTMLDivElement>()
  const o = suDengesi(panel.sektorler, panel.bugun)
  return (
    <ChartFrame mesaj="Su dengesi · son 14 gün" testId="su-dengesi-karti" ayrinti={<p>Vana ortalaması, mm/gün. Çerçeve bitki tüketimi ihtiyacı (ETc); koyu çubuk sulama, mavi çubuk yağmur ({panel.yagis_vurgu_mm} mm üstü okla), kırmızı karşılanmayan (stresle azalan tüketim).</p>}>
      <div ref={ref}>{o.gunler.length ? <SuDengesiGrafigi gunler={o.gunler} genislik={Math.max(280, w)} yagisVurguMm={panel.yagis_vurgu_mm} /> : <ChartState tur="yok" neden="Son 14 gün için hava verisi yok." yukseklik={120} />}</div>
      {o.gunler.length > 0 && <p className="mt-1 text-small text-app-text" data-testid="su-dengesi-cumlesi">{suDengesiCumlesi(o.toplam)}</p>}
      {o.gunler.some((g) => g.olculdu) && <p className="mt-1 text-caption text-app-text-muted" data-testid="olculdu-notu">● işaretli günlerde yağış bahçede ölçüldü; kova bu değeri hava serisinden önce kullandı.</p>}
    </ChartFrame>
  )
}

function KaynakSatiri({ panel }: { panel: PanelYaniti }) {
  const g = panel.guven
  return (
    <section className="rounded-md border border-app-border bg-app-card p-3 text-small text-app-text-muted" data-testid="sulama-kaynak" aria-label="Kaynaklar ve güven">
      <p>
        <b className="text-app-text" data-testid="guven-etiketi" data-guven={g?.etiket ?? ''}>Güven: {g ? GUVEN_AD[g.etiket] : '—'}</b>
        {g ? ` (${g.puan}/${g.toplam})` : ''} · {panel.kaynaklar.map((k) => k.ad).join(' · ')} · katalog sürüm {panel.katalog_surum} · ön değer · mühendis onayı bekliyor
      </p>
      {panel.yagis_yanlilik.length > 0 && (
        <div className="mt-2" data-testid="yagis-yanlilik">
          <p className="font-semibold text-app-text">Bahçe yağış ölçeri ↔ seri</p>
          <ul className="list-disc pl-5">
            {panel.yagis_yanlilik.map((a) => <li key={a.ay} data-testid="yanlilik-ay">{a.ay}: {a.gun} gün · ölçüm {Math.round(a.olculen_mm)} mm, seri {Math.round(a.seri_mm)} mm{a.oran != null ? ` (×${a.oran.toFixed(2).replace('.', ',')})` : ''}{a.oneri_cumle ? <b className="block text-app-text" data-testid="yanlilik-oneri"> {a.oneri_cumle}</b> : ' · öneri için yeterli kanıt yok'}</li>)}
          </ul>
        </div>
      )}
      {g && (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-app-text">Güven nasıl hesaplandı?</summary>
          <ul className="list-disc pl-5" data-testid="guven-kosullari">{g.kosullar.map((k) => <li key={k.ad}>{k.ok ? '✓' : '✗'} {k.ad}{k.not ? ` (${k.not})` : ''}</li>)}</ul>
        </details>
      )}
    </section>
  )
}

const EKSIK_KODLAR = new Set(['agac_sayisi', 'agac_sayisi_yok', 'damlatici_yok', 'tarife_yok'])

/** «Eksik bilgi (3) · Tamamla →»: tek satır; tıklayınca liste açılır ve Sulama bilgileri formuna götürür. */
function EksikBilgi({ uyarilar, tamamla }: { uyarilar: { kod: string; mesaj: string }[]; tamamla: () => void }) {
  const [acik, setAcik] = useState(false)
  const eksik = uyarilar.filter((u) => EKSIK_KODLAR.has(u.kod))
  if (eksik.length === 0) return null
  return (
    <div className="rounded-md border border-app-border bg-app-card" data-testid="eksik-bilgi">
      <button type="button" aria-expanded={acik} onClick={() => setAcik(!acik)} data-testid="eksik-bilgi-satiri" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-small">
        <span><b>Eksik bilgi ({eksik.length})</b> <span className="text-app-text-muted">· hesaplar yine çalışır, bazı değerler gösterilemez</span></span>
        <span className="shrink-0 font-semibold underline">Tamamla {acik ? '↑' : '→'}</span>
      </button>
      {acik && (
        <div className="border-t border-app-border px-3 py-2" data-testid="eksik-bilgi-listesi">
          <ul className="list-disc space-y-1 pl-5 text-small text-app-text-muted">{eksik.map((u) => <li key={u.kod} data-testid={`uyari-${u.kod}`}>{u.mesaj}</li>)}</ul>
          <Button variant="secondary" className="mt-2" onClick={tamamla} data-testid="eksik-bilgi-tamamla">Sulama bilgilerini tamamla</Button>
        </div>
      )}
    </div>
  )
}

/** Su sekmesinin «Sulama» modu (/bahceler/:id/su/sulama): başlık + Bugün | Simülasyon → 3 KPI → [Bugün: karar, eksik bilgi, 7 gün, vanalar, program | Simülasyon] → toprak suyu → su dengesi → kaynak + güven. */
export function SulamaPaneli({ garden }: { garden: Garden }) {
  const q = useSulamaPanel(garden.id)
  const profil = useSulamaProfili(garden.id)
  const sekme = useSulamaHaritaStore((x) => x.sekme)
  const setSekme = useSulamaHaritaStore((x) => x.setSekme)
  const cizim = useSulamaHaritaStore((x) => x.cizim)
  const setCizim = useSulamaHaritaStore((x) => x.setCizim)
  useEffect(() => () => useSulamaHaritaStore.getState().sifirla(), [])
  const [sihirbaz, setSihirbaz] = useState(false)
  const p = q.data
  const girdi = p ? { ...p, sektor_sayisi: p.sektorler.length } : null
  const karar = girdi ? sulamaPanelKarar(girdi) : null
  return (
    <PanelKabuk karar={karar} testId="sulama-paneli">
      <div className="flex items-start justify-between gap-2" data-testid="sulama-baslik-satiri">
        <div className="min-w-0">
          <Link to={gardenPath(garden.id, 'su')} data-testid="sulamadan-cik" className="inline-flex min-h-6 items-center text-caption font-semibold text-app-text-muted hover:text-app-text">← Su</Link>
          <h2 className="text-h1 font-semibold leading-tight text-app-text">Sulama</h2>
          <div className="flex flex-wrap gap-x-4">
          {p?.durum === 'hazir' && <button type="button" onClick={() => setCizim(!cizim)} aria-pressed={cizim} data-testid="vana-ciz-ac" className="min-h-9 text-small font-semibold text-app-text-muted underline">{p.sektor_tanimli ? 'Vanaları düzenle' : 'Vanaları çiz'}</button>}
          <button type="button" onClick={() => setSihirbaz(true)} data-testid="sulama-bilgileri" className="min-h-9 text-small font-semibold text-app-text-muted underline hover:text-app-text">{profil.data?.profil ? 'Sulama bilgileri' : 'Bilgileri gir'}</button>
          </div>
        </div>
        {p?.durum === 'hazir' && (
          <div role="tablist" aria-label="Sulama sekmeleri" className="inline-flex shrink-0 rounded-md bg-app-text/8 p-0.5" data-testid="sulama-sekmeleri">
            {([['bugun', 'Bugün'], ['simulasyon', 'Simülasyon']] as const).map(([id, ad]) => (
              <button key={id} role="tab" type="button" aria-selected={sekme === id} onClick={() => setSekme(id)} data-testid={`sulama-sekme-${id}`} className={`min-h-11 rounded-sm px-3 text-small font-semibold ${sekme === id ? 'bg-app-card text-app-text shadow-e1' : 'text-app-text-muted hover:text-app-text'}`}>{ad}</button>
            ))}
          </div>
        )}
      </div>
      {q.isLoading ? <div className="m-skeleton h-40 rounded-md bg-app-card-hover" role="status" aria-label="Sulama paneli yükleniyor" />
        : q.isError || !p ? <ErrorState title="Sulama paneli alınamadı" error={q.error} retrying={q.isFetching} onRetry={() => void q.refetch()} />
        : p.durum === 'profil_yok' ? (
          <KararBlogu karar={karar ?? ''} testId="sulama-karar-blogu" alt="Sistem, dikim aralığı ve pompa bilgisiyle vana vana program, süre ve maliyet hesaplanır. Bilmediğiniz alanı boş bırakabilirsiniz; boş alan için sayı uydurulmaz.">
            <Button variant="primary" className="mt-3" onClick={() => setSihirbaz(true)} data-testid="sulama-baslat">Sulama bilgilerini gir</Button>
          </KararBlogu>
        )
        : p.durum === 'veri_yok' ? <KararBlogu karar={karar ?? ''} testId="sulama-karar-blogu" alt={p.neden ?? undefined} />
        : (
          <>
            <KpiSatiri panel={p} />
            <VanaOdagi gardenId={garden.id} panel={p} />
            {sekme === 'bugun' && <KararBlogu karar={karar ?? ''} alt={girdi ? sulamaNeden(girdi) : undefined} testId="sulama-karar-blogu" />}
            <EksikBilgi uyarilar={p.uyarilar} tamamla={() => setSihirbaz(true)} />
            {p.uyarilar.some((u) => !EKSIK_KODLAR.has(u.kod)) && <ul className="space-y-1" data-testid="sulama-uyarilar">{p.uyarilar.filter((u) => !EKSIK_KODLAR.has(u.kod)).map((u) => <li key={u.kod} data-testid={`uyari-${u.kod}`} className="rounded-md border border-app-border bg-app-card px-3 py-2 text-small text-app-text-muted"><b className="text-app-text">Not · </b>{u.mesaj}</li>)}</ul>}
            {sekme === 'bugun' ? <BugunSekmesi gardenId={garden.id} panel={p} /> : <SimulasyonSekmesi gardenId={garden.id} mevcutSistem={profil.data?.profil?.sistem ?? 'damla'} />}
            <ToprakSuyuBlogu panel={p} />
            <SuDengesiBlogu panel={p} />
            <KaynakSatiri panel={p} />
          </>
        )}
      {sihirbaz && <SulamaSihirbazi garden={garden} onClose={() => setSihirbaz(false)} />}
    </PanelKabuk>
  )
}
