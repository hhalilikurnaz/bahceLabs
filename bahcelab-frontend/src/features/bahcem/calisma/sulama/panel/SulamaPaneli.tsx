import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartFrame, ChartState, SuDengesiGrafigi, TimeDomainProvider, ToprakSuyuGrafigi } from '@/components/chart'
import { Button, ErrorState } from '@/components/ui'
import { useSulamaPanel, type PanelYaniti } from '../../../api/sulamaPanelApi'
import { useSulamaProfili } from '../../../api/sulamaApi'
import type { Garden } from '../../../api/types'
import { useElementWidth } from '../../../hooks/useElementWidth'
import { GUVEN_AD, sulamaNeden, sulamaPanelKarar, suDengesiCumlesi, toprakSuyuCumlesi } from '../../../lib/karar'
import { gardenPath } from '../../../lib/routes'
import { suDengesi } from '../../../lib/sulamaPanel'
import { useCalismaStore } from '../../calismaStore'
import { KararBlogu, PanelKabuk } from '../../panel/parcalar'
import { SulamaSihirbazi } from '../SulamaSihirbazi'
import { BugunSekmesi } from './BugunSekmesi'
import { KpiSatiri } from './KpiSatiri'
import { SimulasyonSekmesi } from './SimulasyonSekmesi'

type Sekme = 'bugun' | 'simulasyon'

function ToprakSuyuBlogu({ panel }: { panel: PanelYaniti }) {
  const [ref, w] = useElementWidth<HTMLDivElement>()
  const imlec = useCalismaStore((s) => s.imlecTarih)
  const setImlec = useCalismaStore((s) => s.setImlecTarih)
  const cumle = toprakSuyuCumlesi(panel)
  return (
    <ChartFrame mesaj="Toprak suyu · vanalara göre" testId="toprak-suyu-karti" ayrinti={<p>Çizgi her vananın kullanılabilir su yüzdesi (100 = tarla kapasitesi, %{panel.stres_pct} altı bitki stresi). Son 14 gün düz, sonraki 7 gün tahmindir (kesikli, taralı). Üçgen: sulama günü (dolu = uyguladığınız, boş = planlanan).</p>}>
      <div ref={ref}>
        <TimeDomainProvider imlec={imlec} setImlec={setImlec}>
          <ToprakSuyuGrafigi vanalar={panel.sektorler.map((s) => ({ ad: s.ad, gunler: s.gunler }))} bugun={panel.bugun} genislik={Math.max(280, w)} stresPct={panel.stres_pct} yakinPct={panel.yakin_pct} yeterliPct={panel.yeterli_pct} tetikPct={panel.tetik_pct} />
        </TimeDomainProvider>
      </div>
      {cumle && <p className="mt-1 text-small text-app-text" data-testid="toprak-suyu-cumlesi">{cumle}</p>}
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
      {g && (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-app-text">Güven nasıl hesaplandı?</summary>
          <ul className="list-disc pl-5" data-testid="guven-kosullari">{g.kosullar.map((k) => <li key={k.ad}>{k.ok ? '✓' : '✗'} {k.ad}{k.not ? ` (${k.not})` : ''}</li>)}</ul>
        </details>
      )}
    </section>
  )
}

/** Su sekmesinin «Sulama» modu (/bahceler/:id/su/sulama): karar → 3 KPI → Bugün | Simülasyon → toprak suyu (vanalara göre) → su dengesi → kaynak + güven. */
export function SulamaPaneli({ garden }: { garden: Garden }) {
  const q = useSulamaPanel(garden.id)
  const profil = useSulamaProfili(garden.id)
  const [sekme, setSekme] = useState<Sekme>('bugun')
  const [sihirbaz, setSihirbaz] = useState(false)
  const p = q.data
  const karar = p ? sulamaPanelKarar(p) : null
  return (
    <PanelKabuk karar={karar} testId="sulama-paneli">
      <div className="flex items-center justify-between gap-2">
        <Link to={gardenPath(garden.id, 'su')} data-testid="sulamadan-cik" className="inline-flex min-h-11 items-center text-small font-semibold text-app-text-muted hover:text-app-text">← Su</Link>
        <Button variant="secondary" onClick={() => setSihirbaz(true)} data-testid="sulama-bilgileri">{profil.data?.profil ? 'Sulama bilgileri' : 'Bilgileri gir'}</Button>
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
            <KararBlogu karar={karar ?? ''} alt={sulamaNeden(p)} testId="sulama-karar-blogu" />
            <KpiSatiri panel={p} />
            {p.uyarilar.length > 0 && <ul className="space-y-1" data-testid="sulama-uyarilar">{p.uyarilar.map((u) => <li key={u.kod} data-testid={`uyari-${u.kod}`} className="rounded-md border border-app-border bg-app-card px-3 py-2 text-small text-app-text-muted"><b className="text-app-text">Not · </b>{u.mesaj}</li>)}</ul>}
            <div role="tablist" aria-label="Sulama sekmeleri" className="flex gap-1" data-testid="sulama-sekmeleri">
              {([['bugun', 'Bugün'], ['simulasyon', 'Simülasyon']] as const).map(([id, ad]) => (
                <button key={id} role="tab" type="button" aria-selected={sekme === id} onClick={() => setSekme(id)} data-testid={`sulama-sekme-${id}`} className={`min-h-11 flex-1 rounded-md px-4 text-body font-semibold ${sekme === id ? 'bg-app-primary text-app-on-primary' : 'text-app-text-muted hover:bg-app-card-hover'}`}>{ad}</button>
              ))}
            </div>
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
