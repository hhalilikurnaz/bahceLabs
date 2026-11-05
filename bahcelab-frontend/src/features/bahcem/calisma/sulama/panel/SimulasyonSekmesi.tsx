import { useState } from 'react'
import { ChartState } from '@/components/chart'
import { useSulamaSimulasyon, type SimSayac, type SimulasyonYaniti } from '../../../api/sulamaPanelApi'
import type { SulamaSistemi } from '../../../api/sulamaApi'
import { sayi } from '../../../lib/format'
import { VardiyaGantt } from './VardiyaGantt'

const TIP_AD = { kuru: 'kuru', normal: 'normal', islak: 'ıslak' } as const
const TIP_RENK = { kuru: 'var(--color-app-warn)', normal: 'var(--color-app-border-strong)', islak: 'var(--color-app-water)' } as const
const GUN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const gunAy = (iso: string) => `${Number(iso.slice(8, 10))} ${AY[Number(iso.slice(5, 7)) - 1]}`
const tlMetin = (s: SimSayac) => (s.tl == null ? '—' : `${sayi(s.tl, 0)} TL`)

function Sayaclar({ s }: { s: SimSayac }) {
  return (
    <dl className="grid grid-cols-2 gap-2 min-[561px]:grid-cols-4" data-testid="sim-sayaclar">
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">su</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-m3">{sayi(s.m3, 0)} m³</dd><dd className="text-caption text-app-text-muted">sezon</dd></div>
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">elektrik</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-tl">{tlMetin(s)}</dd><dd className="text-caption text-app-text-muted" data-testid="sayac-kwh">{s.kwh == null ? 'pompa bilgisi yok' : `${sayi(s.kwh, 0)} kWh`}</dd></div>
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">stres</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-stres">{s.stres_gun}</dd><dd className="text-caption text-app-text-muted">gün</dd></div>
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">boşa giden</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-bosa">{sayi(s.bosa_m3, 0)} m³</dd><dd className="text-caption text-app-text-muted">sızıntı + sistem kaybı</dd></div>
    </dl>
  )
}

/** Yıl seçici: 2015–2025 hepsi; sezon yağışıyla BOYLU küçük sütunlar (renk kuru/normal/ıslak, seçili koyu), altta yıl. Her sütunun title'ı ve erişilebilir adı var. */
function YilSutunlari({ yillar, secili, sec }: { yillar: SimulasyonYaniti['yillar']; secili: number | null; sec: (y: number) => void }) {
  const mak = Math.max(1, ...yillar.map((y) => y.yagis_mm))
  return (
    <div role="group" aria-label="Yıl (sezon yağışına göre)" className="flex items-end gap-1" data-testid="sim-yillar">
      {yillar.map((y) => {
        const ad = `${y.yil}${y.tip ? `, ${TIP_AD[y.tip]} yıl` : ''}, sezon yağışı ${Math.round(y.yagis_mm)} mm`
        const sel = secili === y.yil
        return (
          <button key={y.yil} type="button" aria-pressed={sel} aria-label={ad} title={ad} onClick={() => sec(y.yil)} data-testid={`sim-yil-${y.yil}`} data-tip={y.tip ?? ''} className="group flex min-h-11 min-w-0 flex-1 flex-col items-center justify-end gap-0.5 rounded-md px-0.5 pb-0.5 focus-visible:outline focus-visible:outline-2">
            <span className="flex h-12 w-full items-end" aria-hidden><span className="block w-full rounded-t-sm" style={{ height: `${Math.max(8, (y.yagis_mm / mak) * 100)}%`, background: sel ? 'var(--color-app-text)' : y.tip ? TIP_RENK[y.tip] : 'var(--color-app-border-strong)', opacity: sel ? 1 : 0.8 }} /></span>
            <span className={`text-caption tabular-nums ${sel ? 'font-bold text-app-text' : 'text-app-text-muted'}`} aria-hidden>{String(y.yil).slice(2)}</span>
          </button>
        )
      })}
    </div>
  )
}

function Cubuk({ ad, plan, alis, birim, testId }: { ad: string; plan: number | null; alis: number | null; birim: string; testId: string }) {
  const mak = Math.max(1, plan ?? 0, alis ?? 0)
  const fark = plan != null && alis != null ? alis - plan : null
  return (
    <div data-testid={testId}>
      <p className="flex justify-between text-small"><b>{ad}</b>{fark != null && <span className={`tabular-nums font-semibold ${fark > 0 ? 'text-app-danger' : fark < 0 ? 'text-app-success' : ''}`}>{fark > 0 ? '+' : fark < 0 ? '−' : ''}{sayi(Math.abs(fark), 0)}</span>}</p>
      <div className="mt-0.5 h-2 rounded-sm bg-app-border" aria-hidden><div className="h-2 rounded-sm bg-app-text" style={{ width: `${((plan ?? 0) / mak) * 100}%` }} /></div>
      <p className="text-caption tabular-nums text-app-text-muted">{plan == null ? '—' : `${sayi(plan, 0)} ${birim}`} <span className="text-app-text-dim">plan</span></p>
      <div className="mt-0.5 h-2 rounded-sm bg-app-border" aria-hidden><div className="h-2 rounded-sm" style={{ width: `${((alis ?? 0) / mak) * 100}%`, background: 'var(--color-app-warn)' }} /></div>
      <p className="text-caption tabular-nums text-app-text-muted">{alis == null ? '—' : `${sayi(alis, 0)} ${birim}`} <span className="text-app-text-dim">alışkanlığınız</span></p>
    </div>
  )
}

/** Simülasyon: yıl sütunları · Plan | Alışkanlığım · sistem · kısıntı anahtarı · kWh adımlayıcı · vana çizelgesi (Gantt) · 4 sayaç · plan–alışkanlık çubukları. */
export function SimulasyonSekmesi({ gardenId, mevcutSistem }: { gardenId: string; mevcutSistem: SulamaSistemi }) {
  const [yil, setYil] = useState<number | undefined>()
  const [mod, setMod] = useState<'plan' | 'aliskanlik'>('plan')
  const [sistem, setSistem] = useState<SulamaSistemi>(mevcutSistem)
  const [kisinti, setKisinti] = useState(false)
  const [fiyat, setFiyat] = useState('')
  const [elleGun, setElleGun] = useState<number[]>([])
  const [elleSaat, setElleSaat] = useState('')
  const [gunIdx, setGunIdx] = useState(0)
  const f = Number(fiyat.replace(',', '.'))
  const s = Number(elleSaat.replace(',', '.'))
  const q = useSulamaSimulasyon(gardenId, { yil, mod, sistem, kisinti, kwh_fiyat: fiyat.trim() !== '' && Number.isFinite(f) && f >= 0 ? f : undefined, gunler: elleGun.length && s > 0 ? elleGun : undefined, saat: elleGun.length && s > 0 ? s : undefined })
  const d: SimulasyonYaniti | undefined = q.data
  const adim = (yon: number) => setFiyat((Math.max(0, Math.round(((Number.isFinite(f) ? f : 0) + yon * 0.1) * 100) / 100)).toFixed(2).replace('.', ','))
  if (q.isLoading) return <ChartState tur="yukleniyor" yukseklik={240} />
  if (q.isError || !d) return <ChartState tur="hata" error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
  if (d.durum !== 'hazir') return <ChartState tur="yok" neden={d.neden ?? 'Simülasyon için veri yok.'} />
  const sulamaGunleri = d.vardiyalar
  const secili = sulamaGunleri[Math.min(gunIdx, Math.max(0, sulamaGunleri.length - 1))]
  return (
    <div className="grid gap-3" data-testid="sulama-simulasyon">
      <section className="rounded-md border border-app-border bg-app-card p-3" aria-label="Simülasyon ayarları">
        <YilSutunlari yillar={d.yillar} secili={d.yil} sec={(y) => { setYil(y); setGunIdx(0) }} />
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div role="radiogroup" aria-label="Mod" className="inline-flex rounded-md bg-app-text/8 p-0.5">
            {(['plan', 'aliskanlik'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mod === m} onClick={() => setMod(m)} data-testid={`sim-mod-${m}`} className={`min-h-11 rounded-sm px-3 text-small font-semibold ${mod === m ? 'bg-app-card shadow-e1' : 'text-app-text-muted'}`}>{m === 'plan' ? 'Plan' : 'Alışkanlığım'}</button>)}
          </div>
          <div role="radiogroup" aria-label="Sulama sistemi" className="inline-flex rounded-md bg-app-text/8 p-0.5">
            {(['damla', 'mini_yagmurlama', 'salma'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={sistem === m} onClick={() => setSistem(m)} data-testid={`sim-sistem-${m}`} className={`min-h-11 rounded-sm px-3 text-small font-semibold ${sistem === m ? 'bg-app-card shadow-e1' : 'text-app-text-muted'}`}>{m === 'damla' ? 'Damla' : m === 'mini_yagmurlama' ? 'Mini' : 'Salma'}</button>)}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <button type="button" role="switch" aria-checked={kisinti} onClick={() => setKisinti(!kisinti)} data-testid="sim-kisinti" className="flex min-h-11 items-center gap-2 text-left text-small">
            <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${kisinti ? 'bg-app-text' : 'bg-app-border-strong'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-app-card transition-all ${kisinti ? 'left-[18px]' : 'left-0.5'}`} /></span>
            <span><b>Kısıntı</b> olgunlaşmada %75 · çiçek/tutumda kilitli</span>
          </button>
          <div className="flex items-center gap-1" role="group" aria-label="kWh fiyatı">
            <button type="button" onClick={() => adim(-1)} aria-label="kWh fiyatını düşür" className="min-h-11 min-w-11 rounded-md border border-app-border-strong text-body">−</button>
            <label className="text-center text-small"><input inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} placeholder={d.sayac?.fiyat_kaynagi === 'katalog' ? 'tarife' : 'faturanız'} aria-label="kWh fiyatı (TL)" className="min-h-11 w-20 rounded-md border border-app-border-strong bg-app-card px-1 text-center text-body font-semibold" data-testid="sim-kwh" /> <span className="text-caption text-app-text-muted">TL/kWh</span></label>
            <button type="button" onClick={() => adim(1)} aria-label="kWh fiyatını artır" className="min-h-11 min-w-11 rounded-md border border-app-border-strong text-body">+</button>
          </div>
        </div>
        {kisinti && (
          <p className="mt-2 rounded-md border border-app-border bg-app-canvas px-3 py-2 text-small" data-testid="sim-kisinti-notu">
            Kısıntı yalnız onaylı dönemde uygulanır (olgunlaşma). Kilitli: {d.kilitli_donemler.map((k) => k.ad).join(', ')} — «Bu dönemde önerilmez». Varsayılan plan değildir.
            {d.kisinti && <b className="mt-1 block" data-testid="sim-kisinti-ozet" data-risk={d.kisinti.verim_riski ?? ''}>{d.kisinti.cumle}</b>}
          </p>
        )}
        {mod === 'aliskanlik' && d.aliskanlik_neden && (
          <div className="mt-2 text-small" data-testid="sim-aliskanlik-neden">
            <p className="text-app-text-muted">{d.aliskanlik_neden}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="Elle sulama günleri">
              {GUN.map((g, i) => <button key={g} type="button" aria-pressed={elleGun.includes(i)} onClick={() => setElleGun(elleGun.includes(i) ? elleGun.filter((x) => x !== i) : [...elleGun, i].sort())} className={`min-h-11 min-w-11 rounded-md border px-1 text-small font-semibold ${elleGun.includes(i) ? 'border-app-text bg-app-primary text-app-on-primary' : 'border-app-border-strong'}`}>{g}</button>)}
              <label className="ml-2 text-small font-semibold">Süre (sa)<input inputMode="decimal" value={elleSaat} onChange={(e) => setElleSaat(e.target.value)} className="ml-2 min-h-11 w-16 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="sim-elle-saat" /></label>
            </div>
          </div>
        )}
        {d.aliskanlik && <p className="mt-2 text-caption text-app-text-dim" data-testid="sim-aliskanlik-kaynak">Alışkanlık: {d.aliskanlik.kaynak === 'kayit' ? `Saha Defteri'ndeki ${d.aliskanlik.kayit_sayisi} sulama gününden öğrenildi` : 'elle girdiğiniz gün ve süre'} · haftada {d.aliskanlik.gunler.map((g) => GUN[g]).join(', ')} · her seferde ≈ {sayi(d.aliskanlik.brut_mm, 1)} mm.</p>}
      </section>
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Vana çizelgesi" data-testid="sim-cizelge">
        <h3 className="text-lead font-semibold">Vana programı{secili ? ` · ${gunAy(secili.tarih)} ${d.yil}` : ''} <span className="text-small font-normal text-app-text-dim">{sulamaGunleri.length} sulama günü</span></h3>
        {secili ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => setGunIdx(Math.max(0, gunIdx - 1))} disabled={gunIdx <= 0} className="min-h-11 min-w-11 rounded-md border border-app-border-strong disabled:opacity-40" aria-label="Önceki sulama" data-testid="sim-onceki">←</button>
              <input type="range" min={0} max={sulamaGunleri.length - 1} value={Math.min(gunIdx, sulamaGunleri.length - 1)} onChange={(e) => setGunIdx(Number(e.target.value))} aria-label="Sulama günü" className="min-h-11 flex-1" data-testid="sim-gun-slider" />
              <button type="button" onClick={() => setGunIdx(Math.min(sulamaGunleri.length - 1, gunIdx + 1))} disabled={gunIdx >= sulamaGunleri.length - 1} className="min-h-11 min-w-11 rounded-md border border-app-border-strong disabled:opacity-40" aria-label="Sonraki sulama" data-testid="sim-sonraki">→</button>
            </div>
            <p className="mt-1 text-body font-semibold" data-testid="sim-gun">{gunAy(secili.tarih)} {d.yil} · {gunIdx + 1}/{sulamaGunleri.length}</p>
            <div className="mt-1"><VardiyaGantt v={secili} testId="sim-vardiya" />{secili.zaman_notu && <p className="mt-1 text-caption text-app-text-dim" data-testid="vardiya-notu">{secili.zaman_notu}</p>}</div>
          </>
        ) : <p className="mt-2 text-small text-app-text-muted" data-testid="sim-cizelge-bos">{d.mod === 'aliskanlik' ? 'Alışkanlık modunda vardiya çizelgesi yok (saatler plana özgü).' : 'Bu yıl plan sulama önermedi.'}</p>}
      </section>
      {d.sayac && <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Sezon sayaçları"><Sayaclar s={d.sayac} />{d.sayac.eksik && <p className="mt-2 text-small text-app-warn" data-testid="sim-tl-eksik">{d.sayac.eksik}</p>}</section>}
      {d.karsilastirma ? (
        <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Plan ve alışkanlık karşılaştırması" data-testid="sim-karsilastirma">
          <h3 className="text-lead font-semibold">Plan mı, alışkanlık mı? <span className="text-small font-normal text-app-text-dim">tüm sezon</span></h3>
          <p className="mt-1 text-body" data-testid="sim-karsilastirma-cumle">{d.karsilastirma_cumle}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
            <Cubuk ad="Su" plan={d.karsilastirma.plan.m3} alis={d.karsilastirma.aliskanlik.m3} birim="m³" testId="kars-su" />
            <Cubuk ad="Maliyet" plan={d.karsilastirma.plan.tl} alis={d.karsilastirma.aliskanlik.tl} birim="TL" testId="kars-tl" />
            <Cubuk ad="Stres günü" plan={d.karsilastirma.plan.stres_gun} alis={d.karsilastirma.aliskanlik.stres_gun} birim="gün" testId="kars-stres" />
            <Cubuk ad="Boşa giden" plan={d.karsilastirma.plan.bosa_m3} alis={d.karsilastirma.aliskanlik.bosa_m3} birim="m³" testId="kars-bosa" />
          </div>
        </section>
      ) : null}
    </div>
  )
}
