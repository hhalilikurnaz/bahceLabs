import { useState } from 'react'
import { ChartState } from '@/components/chart'
import { useSulamaSimulasyon, type SimSayac, type SimulasyonYaniti } from '../../../api/sulamaPanelApi'
import type { SulamaSistemi } from '../../../api/sulamaApi'
import { sayi } from '../../../lib/format'
import { SISTEM_AD } from '../../../lib/sulamaForm'
import { VardiyaTablosu } from './BugunSekmesi'

const TIP_AD = { kuru: 'kuru', normal: 'normal', islak: 'ıslak' } as const
const GUN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const gunAy = (iso: string) => `${Number(iso.slice(8, 10))} ${AY[Number(iso.slice(5, 7)) - 1]}`
const tlMetin = (s: SimSayac) => (s.tl == null ? '—' : `${sayi(s.tl, 0)} TL`)

function Sayaclar({ s }: { s: SimSayac }) {
  return (
    <dl className="grid grid-cols-2 gap-2 min-[561px]:grid-cols-4" data-testid="sim-sayaclar">
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">su</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-m3">{sayi(s.m3, 0)} m³</dd></div>
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">maliyet</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-tl">{tlMetin(s)}</dd><dd className="text-caption text-app-text-muted" data-testid="sayac-kwh">{s.kwh == null ? 'pompa bilgisi yok' : `${sayi(s.kwh, 0)} kWh`}</dd></div>
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">stres günü</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-stres">{s.stres_gun}</dd></div>
      <div className="rounded-md border border-app-border bg-app-canvas p-3"><dt className="text-caption text-app-text-muted">boşa giden su</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="sayac-bosa">{sayi(s.bosa_m3, 0)} m³</dd><dd className="text-caption text-app-text-muted">sızıntı + sistem kaybı</dd></div>
    </dl>
  )
}

/** Simülasyon: seçtiğiniz yılın GERÇEK havasıyla sezon. Yıl · Plan | Alışkanlığım · sistem · kısıntı · kWh fiyatı; çizelge, 4 sayaç, plan–alışkanlık karşılaştırması. */
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
  if (q.isLoading) return <ChartState tur="yukleniyor" yukseklik={240} />
  if (q.isError || !d) return <ChartState tur="hata" error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
  if (d.durum !== 'hazir') return <ChartState tur="yok" neden={d.neden ?? 'Simülasyon için veri yok.'} />
  const sulamaGunleri = d.vardiyalar
  const secili = sulamaGunleri[Math.min(gunIdx, Math.max(0, sulamaGunleri.length - 1))]
  return (
    <div className="grid gap-3" data-testid="sulama-simulasyon">
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Simülasyon ayarları">
        <div role="group" aria-label="Yıl" className="flex flex-wrap gap-1.5" data-testid="sim-yillar">
          {d.yillar.map((y) => (
            <button key={y.yil} type="button" aria-pressed={d.yil === y.yil} onClick={() => { setYil(y.yil); setGunIdx(0) }} data-testid={`sim-yil-${y.yil}`} className={`min-h-11 rounded-md border px-2.5 text-small font-semibold ${d.yil === y.yil ? 'border-app-text bg-app-primary text-app-on-primary' : 'border-app-border-strong'}`}>
              {y.yil}{y.tip ? <span className="ml-1 text-caption font-normal">{TIP_AD[y.tip]} · {Math.round(y.yagis_mm)} mm</span> : null}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="radiogroup" aria-label="Mod" className="inline-flex rounded-md bg-app-text/8 p-0.5">
            {(['plan', 'aliskanlik'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mod === m} onClick={() => setMod(m)} data-testid={`sim-mod-${m}`} className={`min-h-11 rounded-sm px-3 text-small font-semibold ${mod === m ? 'bg-app-card shadow-e1' : 'text-app-text-muted'}`}>{m === 'plan' ? 'Plan' : 'Alışkanlığım'}</button>)}
          </div>
          <div role="radiogroup" aria-label="Sulama sistemi" className="inline-flex rounded-md bg-app-text/8 p-0.5">
            {(['damla', 'mini_yagmurlama', 'salma'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={sistem === m} onClick={() => setSistem(m)} data-testid={`sim-sistem-${m}`} className={`min-h-11 rounded-sm px-3 text-small font-semibold ${sistem === m ? 'bg-app-card shadow-e1' : 'text-app-text-muted'}`}>{m === 'damla' ? 'Damla' : m === 'mini_yagmurlama' ? 'Mini' : 'Salma'}</button>)}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-small font-semibold"><input type="checkbox" className="h-5 w-5" checked={kisinti} onChange={(e) => setKisinti(e.target.checked)} data-testid="sim-kisinti" /> Kısıntılı sulama</label>
          <label className="flex items-center gap-2 text-small font-semibold">kWh fiyatı (TL)<input inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} placeholder={d.sayac?.fiyat_kaynagi === 'katalog' ? 'tarife' : 'faturanız'} className="min-h-11 w-24 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="sim-kwh" /></label>
        </div>
        {kisinti && (
          <p className="mt-2 rounded-md border border-app-border bg-app-canvas px-3 py-2 text-small" data-testid="sim-kisinti-notu">
            Kısıntı yalnız onaylı dönemde uygulanır (olgunlaşma). Kilitli: {d.kilitli_donemler.map((k) => k.ad).join(', ')} — «Bu dönemde önerilmez». Tasarruf ile birlikte stres günü ve verim riski artar; varsayılan plan değildir.
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
      {d.sayac && <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Sezon sayaçları"><h3 className="mb-2 text-lead font-semibold">{d.yil} sezonu · {SISTEM_AD[d.sistem ?? mevcutSistem]} · {d.mod === 'plan' ? 'plan' : 'alışkanlığınız'}</h3><Sayaclar s={d.sayac} />{d.sayac.eksik && <p className="mt-2 text-small text-app-warn" data-testid="sim-tl-eksik">{d.sayac.eksik}</p>}</section>}
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Vana çizelgesi" data-testid="sim-cizelge">
        <h3 className="text-lead font-semibold">Vana çizelgesi <span className="text-small font-normal text-app-text-dim">{sulamaGunleri.length} sulama günü</span></h3>
        {secili ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => setGunIdx(Math.max(0, gunIdx - 1))} disabled={gunIdx <= 0} className="min-h-11 min-w-11 rounded-md border border-app-border-strong disabled:opacity-40" aria-label="Önceki sulama" data-testid="sim-onceki">←</button>
              <input type="range" min={0} max={sulamaGunleri.length - 1} value={Math.min(gunIdx, sulamaGunleri.length - 1)} onChange={(e) => setGunIdx(Number(e.target.value))} aria-label="Sulama günü" className="min-h-11 flex-1" data-testid="sim-gun-slider" />
              <button type="button" onClick={() => setGunIdx(Math.min(sulamaGunleri.length - 1, gunIdx + 1))} disabled={gunIdx >= sulamaGunleri.length - 1} className="min-h-11 min-w-11 rounded-md border border-app-border-strong disabled:opacity-40" aria-label="Sonraki sulama" data-testid="sim-sonraki">→</button>
            </div>
            <p className="mt-1 text-body font-semibold" data-testid="sim-gun">{gunAy(secili.tarih)} {d.yil} · {gunIdx + 1}/{sulamaGunleri.length}</p>
            <div className="mt-1"><VardiyaTablosu v={secili} testId="sim-vardiya" /></div>
          </>
        ) : <p className="mt-2 text-small text-app-text-muted" data-testid="sim-cizelge-bos">{d.mod === 'aliskanlik' ? 'Alışkanlık modunda vardiya çizelgesi yok (saatler plana özgü).' : 'Bu yıl plan sulama önermedi.'}</p>}
      </section>
      {d.karsilastirma ? (
        <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Plan ve alışkanlık karşılaştırması" data-testid="sim-karsilastirma">
          <h3 className="text-lead font-semibold">Plan ↔ alışkanlığım</h3>
          <table className="mt-2 w-full text-small"><thead><tr className="text-left text-app-text-muted"><th className="py-1 font-medium"> </th><th className="font-medium">Plan</th><th className="font-medium">Alışkanlığım</th></tr></thead>
            <tbody className="tabular-nums">
              <tr><th className="py-1 text-left font-medium">Su</th><td>{sayi(d.karsilastirma.plan.m3, 0)} m³</td><td>{sayi(d.karsilastirma.aliskanlik.m3, 0)} m³</td></tr>
              <tr><th className="py-1 text-left font-medium">Maliyet</th><td>{tlMetin(d.karsilastirma.plan)}</td><td>{tlMetin(d.karsilastirma.aliskanlik)}</td></tr>
              <tr><th className="py-1 text-left font-medium">Stres günü</th><td>{d.karsilastirma.plan.stres_gun}</td><td>{d.karsilastirma.aliskanlik.stres_gun}</td></tr>
              <tr><th className="py-1 text-left font-medium">Boşa giden</th><td>{sayi(d.karsilastirma.plan.bosa_m3, 0)} m³</td><td>{sayi(d.karsilastirma.aliskanlik.bosa_m3, 0)} m³</td></tr>
            </tbody></table>
          <p className="mt-2 text-body" data-testid="sim-karsilastirma-cumle">{d.karsilastirma_cumle}</p>
        </section>
      ) : null}
    </div>
  )
}
