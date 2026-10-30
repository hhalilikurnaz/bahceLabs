import { useState } from 'react'
import { ChartState } from '@/components/chart'
import { useSulamaSenaryolari, type SenaryoGirdisi, type SulamaSistemi } from '../../api/sulamaApi'
import { sayi } from '../../lib/format'
import { SISTEM_AD } from '../../lib/sulamaForm'

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const isaret = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '')
const fark = (v: number | null, birim: string): string => (v == null ? '—' : `${isaret(v)}${sayi(Math.abs(v), 0)} ${birim}`)

function Fark({ v, birim, iyiEksi = true, testId }: { v: number | null; birim: string; iyiEksi?: boolean; testId?: string }) {
  const iyi = v != null && (iyiEksi ? v < 0 : v > 0)
  const kotu = v != null && v !== 0 && !iyi
  return <b className={`tabular-nums ${iyi ? 'text-app-success' : kotu ? 'text-app-warn' : ''}`} data-testid={testId}>{fark(v, birim)}</b>
}

function Kart({ baslik, testId, children }: { baslik: string; testId: string; children: React.ReactNode }) {
  return <section className="rounded-md border border-app-border bg-app-card p-4" data-testid={testId}><h3 className="text-lead font-semibold">{baslik}</h3><div className="mt-2 space-y-2 text-body">{children}</div></section>
}

/** Senaryolar: dört kart yan yana, FARK vurgulu. Hepsi gerçek geçmiş havayla (2015–): sahte sayı yok. Kısıntı varsayılan plan DEĞİLDİR. */
export function SenaryoBolumu({ gardenId, yillar, varsayilanYil, mevcut }: { gardenId: string; yillar: number[]; varsayilanYil: number; mevcut: SulamaSistemi }) {
  const [yil, setYil] = useState(varsayilanYil)
  const [gunler, setGunler] = useState<number[]>([])
  const [saat, setSaat] = useState('')
  const [hedef, setHedef] = useState<SulamaSistemi | ''>('')
  const [yatirim, setYatirim] = useState('')
  const s = Number(saat.replace(',', '.'))
  const y = Number(yatirim.replace(',', '.'))
  const girdi: SenaryoGirdisi = { yil, gunler: gunler.length && s > 0 ? gunler : undefined, saat: gunler.length && s > 0 ? s : undefined, hedef: hedef || undefined, yatirim_tl: yatirim.trim() !== '' && Number.isFinite(y) && y >= 0 ? y : undefined }
  const q = useSulamaSenaryolari(gardenId, girdi)
  const d = q.data
  return (
    <div className="grid gap-3" data-testid="senaryo-bolumu">
      <label className="flex items-center gap-2 text-small font-semibold">Hangi yılın havasıyla?
        <select value={yil} onChange={(e) => setYil(Number(e.target.value))} className="min-h-11 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="senaryo-yil">{yillar.map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </label>
      {q.isLoading ? <ChartState tur="yukleniyor" yukseklik={200} /> : q.isError || !d ? <ChartState tur="hata" error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        : d.durum !== 'hazir' ? <ChartState tur="yok" neden={d.neden ?? 'Senaryolar için veri yok.'} />
        : (
          <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
            <Kart baslik="Alışkanlığınız mı, plan mı?" testId="senaryo-aliskanlik">
              <div className="flex flex-wrap items-end gap-2">
                <div role="group" aria-label="Sulama günleri" className="flex gap-1">{GUNLER.map((g, i) => <button key={g} type="button" aria-pressed={gunler.includes(i)} onClick={() => setGunler(gunler.includes(i) ? gunler.filter((x) => x !== i) : [...gunler, i].sort())} className={`min-h-11 min-w-11 rounded-md border px-1 text-small font-semibold ${gunler.includes(i) ? 'border-app-text bg-app-primary text-app-on-primary' : 'border-app-border-strong'}`}>{g}</button>)}</div>
                <label className="text-small font-semibold">Süre (sa)<input inputMode="decimal" value={saat} onChange={(e) => setSaat(e.target.value)} className="ml-2 min-h-11 w-20 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="aliskanlik-saat" /></label>
              </div>
              {d.aliskanlik ? (
                <>
                  <p data-testid="aliskanlik-ozet">{d.aliskanlik.ozet}</p>
                  <p>Su: <Fark v={d.aliskanlik.fark_m3} birim="m³" testId="aliskanlik-fark-m3" /> · Maliyet: <Fark v={d.aliskanlik.fark_tl} birim="TL" testId="aliskanlik-fark-tl" /></p>
                  <p className="text-caption text-app-text-muted">Plana göre fark; eksi = alışkanlığınız daha az su verir. Stres günü: {d.aliskanlik.aliskanlik.stres_gun} (plan {d.aliskanlik.plan.stres_gun}).</p>
                </>
              ) : <p className="text-small text-app-text-muted" data-testid="aliskanlik-bos">Günleri ve süreyi girin. Süreyi litreye çevirmek için damlatıcı bilgisi ve ağaç sayısı gerekir.</p>}
            </Kart>
            <Kart baslik="Kuru yıl, ıslak yıl" testId="senaryo-kuru-islak">
              {d.kuru_islak && (
                <>
                  <p><b data-testid="kuru-islak-secili">{d.kuru_islak.secili.yil}</b> sezonu: <b>{sayi(d.kuru_islak.secili.m3, 0)} m³</b>{d.kuru_islak.secili.tl != null ? ` · ${sayi(d.kuru_islak.secili.tl, 0)} TL` : ''} · yağış {sayi(d.kuru_islak.secili.yagis_mm, 0)} mm</p>
                  <p>Ortanca yıla göre: <Fark v={d.kuru_islak.fark_m3} birim="m³" testId="kuru-islak-fark" /> {d.kuru_islak.fark_tl != null && <>· <Fark v={d.kuru_islak.fark_tl} birim="TL" /></>}</p>
                  <ul className="flex h-14 items-end gap-1" aria-label="Yıllara göre sezon suyu" data-testid="kuru-islak-yillar">
                    {d.kuru_islak.yillar.map((r) => { const mx = Math.max(...d.kuru_islak!.yillar.map((x) => x.m3)); return <li key={r.yil} className="flex-1" title={`${r.yil}: ${sayi(r.m3, 0)} m³`}><span className="block w-full" style={{ height: Math.max(3, (r.m3 / mx) * 52), background: r.yil === yil ? 'var(--color-app-primary)' : 'var(--color-app-border-strong)', outline: r.yil === yil ? '1px solid var(--color-app-text)' : undefined }} /></li> })}
                  </ul>
                  <p className="text-caption text-app-text-muted">{d.kuru_islak.yillar[0]?.yil}–{d.kuru_islak.yillar.at(-1)?.yil} gerçek hava; her çubuk bir sezonun planı.</p>
                </>
              )}
            </Kart>
            <Kart baslik="Kısıntılı sulama" testId="senaryo-kisinti">
              {d.kisinti && (
                <>
                  <p className="rounded-md border border-app-border bg-app-canvas px-3 py-2 text-small" data-testid="kisinti-uyari">Bu bir öneri değil, bir hesap: varsayılan plan tam sulamadır. {d.kisinti.mesaj}</p>
                  {d.kisinti.uygulanabilir && d.kisinti.kisintili && (
                    <>
                      <p>Tasarruf: <Fark v={d.kisinti.tasarruf_m3 == null ? null : -d.kisinti.tasarruf_m3} birim="m³" testId="kisinti-m3" /> {d.kisinti.tasarruf_tl != null && <>· <Fark v={-d.kisinti.tasarruf_tl} birim="TL" /></>}</p>
                      <p data-testid="kisinti-risk">Verim riski: <b>{{ dusuk: 'düşük', orta: 'orta', yuksek: 'yüksek' }[d.kisinti.verim_riski ?? 'dusuk']}</b> · eşik altı gün: {d.kisinti.kisintili.stres_gun} (tam plan: {d.kisinti.tam.stres_gun})</p>
                    </>
                  )}
                  <ul className="space-y-1 text-small" data-testid="kisinti-kilitli">{d.kisinti.kilitli_donemler.map((k) => <li key={k.kod}><b>{k.ad}</b> <span className="rounded-[4px] border border-app-border px-1.5 py-px text-caption text-app-text-dim">kilitli</span> {k.mesaj}</li>)}</ul>
                </>
              )}
            </Kart>
            <Kart baslik="Sistem değişikliği" testId="senaryo-sistem">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-small font-semibold">Yeni sistem
                  <select value={hedef} onChange={(e) => setHedef(e.target.value as SulamaSistemi | '')} className="ml-2 min-h-11 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="sistem-hedef"><option value="">Seçin</option>{(Object.keys(SISTEM_AD) as SulamaSistemi[]).filter((v) => v !== mevcut).map((v) => <option key={v} value={v}>{SISTEM_AD[v]}</option>)}</select>
                </label>
                <label className="text-small font-semibold">Kurulum bedeli (TL)<input inputMode="decimal" value={yatirim} onChange={(e) => setYatirim(e.target.value)} className="ml-2 min-h-11 w-28 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="sistem-yatirim" /></label>
              </div>
              {d.sistem ? (
                <>
                  <p>{SISTEM_AD[d.sistem.mevcut]} → {SISTEM_AD[d.sistem.hedef]}</p>
                  <p>Su: <Fark v={d.sistem.fark_m3} birim="m³" testId="sistem-fark-m3" /> · Elektrik: <Fark v={d.sistem.fark_kwh} birim="kWh" /> · Maliyet: <Fark v={d.sistem.fark_tl} birim="TL" testId="sistem-fark-tl" /></p>
                  <p data-testid="sistem-geri-odeme">{d.sistem.geri_odeme_sezon != null ? <>Geri ödeme: <b>{sayi(d.sistem.geri_odeme_sezon, 1)} sezon</b> (sizin girdiğiniz bedelle)</> : d.sistem.yatirim_tl == null ? 'Geri ödeme için kurulum bedelinizi girin.' : 'Bu değişiklik maliyeti düşürmediği için geri ödeme hesaplanmaz.'}</p>
                  <p className="text-caption text-app-text-muted">{d.sistem.not}</p>
                </>
              ) : <p className="text-small text-app-text-muted">Karşılaştırmak istediğiniz sistemi seçin.</p>}
            </Kart>
          </div>
        )}
      <p className="text-caption text-app-text-dim">Hepsi {yil} yılının gerçek ERA5-Land havasıyla; katsayılar ön değer · mühendis onayı bekliyor.</p>
    </div>
  )
}
