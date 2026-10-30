import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartFrame, ChartState, KovaGrafigi, TimeDomainProvider } from '@/components/chart'
import { Button, ErrorState } from '@/components/ui'
import { useSulamaPlani, useSulamaProfili, type PlanYaniti } from '../../api/sulamaApi'
import type { Garden } from '../../api/types'
import { useElementWidth } from '../../hooks/useElementWidth'
import { dekar, sayi } from '../../lib/format'
import { sulamaKarar, sureMetni } from '../../lib/karar'
import { gardenPath } from '../../lib/routes'
import { SISTEM_AD } from '../../lib/sulamaForm'
import { useCalismaStore } from '../calismaStore'
import { BuyukSayi } from '../panel/parcalar'
import { MaliyetBolumu } from './MaliyetBolumu'
import { SenaryoBolumu } from './SenaryoBolumu'
import { SezonAnimasyonu } from './SezonAnimasyonu'
import { SulamaSihirbazi } from './SulamaSihirbazi'

type Bolum = 'plan' | 'maliyet' | 'senaryo'
const BOLUMLER: { id: Bolum; ad: string }[] = [{ id: 'plan', ad: 'Plan' }, { id: 'maliyet', ad: 'Maliyet' }, { id: 'senaryo', ad: 'Senaryolar' }]
const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const gunKisa = (iso: string): string => GUN[new Date(`${iso}T12:00:00Z`).getUTCDay()]
const ekle = (iso: string, n: number): string => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

function Hafta({ plan }: { plan: PlanYaniti }) {
  const gunler = Array.from({ length: 7 }, (_, i) => ekle(plan.bugun, i))
  return (
    <ol className="grid grid-cols-7 gap-1.5 max-[560px]:grid-cols-4" data-testid="sulama-hafta" aria-label="Bu haftanın sulama takvimi">
      {gunler.map((t) => {
        const s = plan.sulamalar.find((x) => x.tarih === t)
        return (
          <li key={t} data-testid={s ? 'hafta-sulama-gunu' : 'hafta-gun'} className={`min-h-[84px] rounded-md border p-2 text-small ${s ? 'border-app-text bg-app-primary text-app-on-primary' : 'border-app-border bg-app-card text-app-text-muted'}`}>
            <b className="block text-caption">{t === plan.bugun ? 'Bugün' : gunKisa(t)} {Number(t.slice(8, 10))}</b>
            {s ? (
              <>
                <b className="mt-1 block text-body leading-tight" data-testid="hafta-sure">{s.emitor_dakika ? sureMetni(s.emitor_dakika) : `${sayi(s.m3_bahce, 0)} m³`}</b>
                <span className="block text-caption">{sayi(s.m3_dekar, 1)} m³/da{s.litre_agac != null ? ` · ${sayi(s.litre_agac, 0)} L/ağaç` : ''}</span>
              </>
            ) : <span className="mt-1 block text-caption">—</span>}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Sulama planı (tam sayfa, Su sekmesinden açılır): üç bölüm — Plan (bu haftanın takvimi, süre, toprak kovası, sezon animasyonu) · Maliyet · Senaryolar.
 * Karar cümlesi lib/karar.ts'ten. Ağaç başına litre YALNIZ beyan edilen ağaç sayısı varsa ve «beyan edilen ağaç sayısına göre» etiketiyle gösterilir.
 */
export function SulamaPlaniSayfasi({ garden }: { garden: Garden }) {
  const plan = useSulamaPlani(garden.id)
  const profil = useSulamaProfili(garden.id)
  const [bolum, setBolum] = useState<Bolum>('plan')
  const [sihirbaz, setSihirbaz] = useState(false)
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const imlec = useCalismaStore((s) => s.imlecTarih)
  const setImlec = useCalismaStore((s) => s.setImlecTarih)
  const p = plan.data
  const karar = p ? sulamaKarar(p) : null
  const simdi = new Date().getFullYear()
  const yillar = p?.projeksiyon ? Array.from({ length: p.projeksiyon.son_yil - p.projeksiyon.ilk_yil + 1 }, (_, i) => p.projeksiyon!.son_yil - i) : []
  const sonYil = p?.projeksiyon?.son_yil ?? simdi - 1
  const sonraki = p?.sonraki
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-app-canvas" data-testid="sulama-plani-sayfasi">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-3 px-5 py-4 max-[560px]:px-3">
        <Link to={gardenPath(garden.id, 'su')} data-testid="calisma-alanina-don" className="inline-flex min-h-11 w-fit items-center text-small font-semibold text-app-text-muted hover:text-app-text">← Su</Link>
        <section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-md border border-app-border bg-app-card p-5" data-testid="sulama-karar">
          <div>
            <h1 className="text-h1 font-semibold text-app-text" data-testid="sulama-baslik">{plan.isLoading ? 'Sulama planı yükleniyor' : karar ?? 'Sulama planı alınamadı.'}</h1>
            <p className="mt-1 text-small text-app-text-dim">{garden.ad} · {dekar(garden.alanDekar)}{profil.data?.profil ? ` · ${SISTEM_AD[profil.data.profil.sistem]}` : ''} · ön değer · mühendis onayı bekliyor</p>
          </div>
          {sonraki && (
            <div className="flex items-end gap-3">
              <span className="text-metric font-semibold leading-none"><BuyukSayi metin={sonraki.emitor_dakika ? sureMetni(sonraki.emitor_dakika) : `${sayi(sonraki.m3_bahce, 0)} m³`} className="text-metric" /></span>
              <div className="pb-1"><b className="block text-body">{sayi(sonraki.m3_dekar, 1)} m³/dekar</b><span className="text-small text-app-text-muted" data-testid="sulama-litre">{sonraki.litre_agac != null ? `ağaç başına ${sayi(sonraki.litre_agac, 0)} L · beyan edilen ağaç sayısına göre` : 'ağaç başına litre için ağaç sayısı gerekir'}</span></div>
            </div>
          )}
        </section>
        <div className="flex gap-1" data-testid="sulama-bolumleri">
          <div role="tablist" aria-label="Sulama planı bölümleri" className="flex gap-1">
            {BOLUMLER.map((b) => <button key={b.id} role="tab" type="button" aria-selected={bolum === b.id} onClick={() => setBolum(b.id)} data-testid={`sulama-bolum-${b.id}`} className={`min-h-11 rounded-md px-4 text-body font-semibold ${bolum === b.id ? 'bg-app-primary text-app-on-primary' : 'text-app-text-muted hover:bg-app-card-hover'}`}>{b.ad}</button>)}
          </div>
          <span className="flex-1" />
          <Button variant="secondary" onClick={() => setSihirbaz(true)} data-testid="sulama-bilgileri">{profil.data?.profil ? 'Sulama bilgileri' : 'Bilgileri gir'}</Button>
        </div>
        {plan.isLoading ? <ChartState tur="yukleniyor" yukseklik={240} />
          : plan.isError || !p ? <ErrorState title="Sulama planı alınamadı" error={plan.error} retrying={plan.isFetching} onRetry={() => void plan.refetch()} />
          : p.durum === 'profil_yok' ? (
            <section className="rounded-md border border-dashed border-app-border bg-app-card p-6 text-center" data-testid="sulama-profil-yok">
              <h2 className="text-h2 font-semibold">Önce sulama bilgilerinizi girin</h2>
              <p className="mx-auto mt-1 max-w-[52ch] text-body text-app-text-muted">Sistem (damla, mini yağmurlama, salma), dikim aralığı ve pompa bilgisiyle haftalık plan, süre ve maliyet hesaplanır. Bilmediğiniz alanı boş bırakabilirsiniz; boş alan için sayı uydurulmaz.</p>
              <Button variant="primary" className="mt-3" onClick={() => setSihirbaz(true)} data-testid="sulama-baslat">Sulama bilgilerini gir</Button>
            </section>
          ) : p.durum === 'veri_yok' ? (
            <ChartState tur="yok" neden={p.neden ?? 'Plan için veri yok.'} nezaman="Veri gelince plan kendiliğinden oluşur." yukseklik={200} />
          ) : (
            <>
              {p.uyarilar.length > 0 && <ul className="space-y-1" data-testid="sulama-uyarilar">{p.uyarilar.map((u) => <li key={u.kod} data-testid={`uyari-${u.kod}`} className="rounded-md border border-app-border bg-app-card px-3 py-2 text-small text-app-text-muted"><b className="text-app-text">Not · </b>{u.mesaj}</li>)}</ul>}
              {bolum === 'plan' && (
                <>
                  <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Bu hafta">
                    <h2 className="mb-2 text-lead font-semibold">Bu hafta</h2>
                    <Hafta plan={p} />
                    <p className="mt-2 text-caption text-app-text-dim">Brüt su = net ihtiyaç ÷ sistem verimi (%{Math.round((p.sistem_verimi ?? 0) * 100)}). Taç örtüsü %{Math.round(p.orten_yuzde ?? 0)} (uydu), bugünkü Kc {sayi(p.kc_bugun, 2)}.</p>
                  </section>
                  <ChartFrame mesaj="Toprakta su" testId="kova-karti" ayrinti={<p>Çizgi köklerin ulaşabildiği su ({sayi(p.taw_mm, 0)} mm dolu kova). Eşik ({sayi((p.taw_mm ?? 0) - (p.raw_mm ?? 0), 0)} mm) altına inince bitki zorlanmaya başlar; plan eşiğe ulaşmadan sulamayı önerir. Taralı bölge hava tahminidir.</p>}>
                    <div ref={ref}>
                      <TimeDomainProvider imlec={imlec} setImlec={setImlec}>
                        <KovaGrafigi gunler={p.gunler} tawMm={p.taw_mm ?? 0} rawMm={p.raw_mm ?? 0} bugun={p.bugun} genislik={Math.max(300, genislik)} />
                      </TimeDomainProvider>
                    </div>
                  </ChartFrame>
                  <SezonAnimasyonu gardenId={garden.id} yillar={yillar.length ? yillar : [sonYil]} varsayilanYil={sonYil} />
                </>
              )}
              {bolum === 'maliyet' && <MaliyetBolumu plan={p} onProfil={() => setSihirbaz(true)} />}
              {bolum === 'senaryo' && profil.data?.profil && <SenaryoBolumu gardenId={garden.id} yillar={yillar.length ? yillar : [sonYil]} varsayilanYil={sonYil} mevcut={profil.data.profil.sistem} />}
            </>
          )}
      </div>
      {sihirbaz && <SulamaSihirbazi garden={garden} onClose={() => setSihirbaz(false)} />}
    </div>
  )
}
