import { useMemo, useState, type ReactNode } from 'react'
import { formatDate, formatDayMonth, shiftDays, todayIstanbul, weekdayName } from '../../bahcem/lib/dates'
import type { Proto } from '../data'
import { bestSpray, rainWeek, seasonRainGdd } from '../derive'
import { IllLimonDali, Icon, Logo } from './assets'
import { CalendarStrip, DockChart, GridCanvas, Ridgeline, SlopeRows, f2, type DayVal, type SlopeRow } from './charts'
import { HatchHost } from './HatchHost'
import { Fig, Index, Rail, RampLegend, StatusWord, scoreWhy, seriesPts } from './parts'
import { SahaMap, problemPinsSaha, ringsOf, type MapPin } from './SahaMap'
import { CommandBox } from './Workspace'
import { ZONE_HEX } from './palette'
import type { Saha } from './useSaha'

function Shell({ d, s, active, title, right, children, map }: { d: Proto; s: Saha; active: string; title: string; right?: ReactNode; children: ReactNode; map: ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Rail active="bahceler" />
      <div style={{ flex: '1 1 60%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="rule-b" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', height: 58, flex: 'none' }}>
          <a className="btn quiet" style={{ whiteSpace: 'nowrap' }}>← Alan</a>
          <h1 className="serif" style={{ margin: 0, fontSize: 24, whiteSpace: 'nowrap' }}>{d.garden?.ad} <span style={{ color: 'var(--ink-4)' }}>/</span> {title}</h1>
          <nav style={{ display: 'flex', marginLeft: 12 }}>{['Analiz', 'Hava', 'Günlük', 'Rapor', 'Arşiv'].map((n) => <button key={n} className="tab" data-on={n === active}>{n}</button>)}</nav>
          <span style={{ flex: 1 }} />{right}
        </header>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 40px', display: 'grid', gap: 30, alignContent: 'start' }}>{children}</div>
      </div>
      <div className="rule-l" style={{ flex: '1 1 40%', minWidth: 0, position: 'relative' }}>{map}</div>
      <HatchHost />
      {void s}
    </div>
  )
}

function Histogram({ d, s }: { d: Proto; s: Saha }) {
  const vals = useMemo(() => (s.latestGrid ? Array.from(s.latestGrid.values).filter(Number.isFinite) : []), [s.latestGrid])
  const [lo, hi] = s.domain
  const n = 28
  const bins = useMemo(() => { const b = new Array<number>(n).fill(0); vals.forEach((v) => (b[Math.min(n - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * n)))] += 1)); return b.map((c) => c / (vals.length || 1)) }, [vals, lo, hi])
  const max = Math.max(...bins, 0.001)
  const sorted = [...vals].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  const share = vals.length ? Math.round((vals.filter((v) => v >= med * 0.93).length / vals.length) * 100) : 0
  const W = 420
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>Alanın <b className="mono">%{share}</b>’i bahçe medyanının %7’sinden fazla düşmemiş.</div>
      <svg width={W} height={120} role="img" aria-label="Canlılık dağılımı">
        {bins.map((b, i) => <rect key={i} x={i * (W / n) + 1} width={W / n - 2} y={100 - (b / max) * 92} height={(b / max) * 92} fill={`rgb(${[243, 233, 190].join(',')})`} stroke="var(--ink)" strokeWidth={0.6} style={{ fill: rampAt(i / n) }} />)}
        <line x1={0} x2={W} y1={100} y2={100} stroke="var(--ink)" />
        {med != null && <g><line x1={((med - lo) / (hi - lo)) * W} x2={((med - lo) / (hi - lo)) * W} y1={4} y2={100} stroke="var(--ink)" strokeDasharray="2 2" /><text x={((med - lo) / (hi - lo)) * W + 4} y={14} fontSize={10.5} fontFamily="var(--font-mono)">medyan {f2(med)}</text></g>}
        {[lo, (lo + hi) / 2, hi].map((t, i) => <text key={i} x={i === 0 ? 0 : i === 1 ? W / 2 : W} textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'} y={115} fontSize={10} fontFamily="var(--font-mono)" fill="var(--ink-3)">{f2(t)}</text>)}
      </svg>
      {void d}
    </div>
  )
}
import { rampCss } from './palette'
const rampAt = (t: number): string => rampCss(t)

function monthlyMaps(d: Proto, s: Saha) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {s.months.map((m) => {
          const g = s.monthGrids.get(m.tarih)
          return g ? <GridCanvas ring={ringsOf(d)} key={m.tarih} grid={g} domain={s.domain} scale={3} label={formatDayMonth(m.tarih)} sub={f2(m.indeksler.ndvi?.ortalama)} marked={m.tarih === d.latest?.tarih} /> : <div key={m.tarih} style={{ aspectRatio: '1/1.1', background: 'var(--paper-3)' }} />
        })}
      </div>
      <div style={{ marginTop: 10 }}><RampLegend domain={s.domain} width={260} /></div>
    </div>
  )
}

function dayVals(hist: Saha['history'], pick: (h: Saha['history'][number]) => number | null): DayVal[] {
  return hist.map((h) => ({ date: h.tarih, value: pick(h) }))
}

function AnalizSon12({ d, s }: { d: Proto; s: Saha }) {
  const { rain, bands } = seasonRainGdd(d)
  const line = seriesPts(d, 'ndvi')
  const [sel, setSel] = useState<string | null>(d.latest?.tarih ?? null)
  const avg = (id: 'ndvi' | 'ndmi' | 'ndre', from: string, to: string) => { const v = seriesPts(d, id).filter((p) => p.date >= from && p.date <= to).map((p) => p.value); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const t = s.today
  const rows: SlopeRow[] = [
    { label: 'Canlılık', prev: avg('ndvi', shiftDays(t, -395), shiftDays(t, -335)), now: avg('ndvi', shiftDays(t, -30), t), unit: '' },
    { label: 'Yaprak suyu', prev: avg('ndmi', shiftDays(t, -395), shiftDays(t, -335)), now: avg('ndmi', shiftDays(t, -30), t), unit: '' },
    { label: 'Klorofil', prev: avg('ndre', shiftDays(t, -395), shiftDays(t, -335)), now: avg('ndre', shiftDays(t, -30), t), unit: '' },
    { label: 'Sezon yağışı (mm)', prev: d.series?.ozet.oncekiYagis ?? null, now: d.series?.ozet.yagis ?? null, unit: 'mm', digits: 0 },
    { label: 'Sezon GDD', prev: d.series?.ozet.oncekiGdd ?? null, now: d.series?.ozet.gdd ?? null, unit: '', digits: 0 },
  ]
  const hist = s.history
  const net = d.scenes.map((x) => x.tarih)
  return (
    <>
      <section><Fig n={1} title="Bu sezon, geçen sezonla yan yana" note="Her satır kendi ölçeğinde: içi boş nokta geçen yılın aynı dönemi, dolu nokta bugün. Son 30 gün ortalaması; sezon rakamları 1 Ekim'den bugüne." /><SlopeRows rows={rows} /></section>
      <section><Fig n={2} title="Canlılık: bir yıl, bir bakışta" note="Kare noktalar net uydu günleridir; şerit fenoloji evreleri; altta yağış. İşaretçiyi sürükleyin, harita o tarihe gelir." /><div style={{ marginLeft: -8 }}><DockChart height={250} range={{ from: shiftDays(t, -365), to: t }} line={line} stages={bands} rain={rain} netDates={net} selected={sel} onSelect={setSel} label="Canlılık" /></div></section>
      <section>
        <Fig n={3} title="Takvim: yağış, sıcaklık, uydu günleri" note="Her kare bir gün. Koyu nokta o gün net uydu görüntüsü var demektir. İlaçlama uygunluğu geçmiş için saklanmıyor; önümüzdeki 7 gün Hava sayfasında." />
        <div style={{ display: 'grid', gap: 14 }}>
          <CalendarStrip title="Yağış" unit="mm" days={dayVals(hist, (h) => h.yagisMm)} from={shiftDays(t, -364)} to={shiftDays(t, -1)} domain={[0, 30]} color={(x) => mix([251, 250, 246], [42, 120, 214], Math.min(1, x))} marks={net} />
          <CalendarStrip title="En yüksek sıcaklık" unit="°C" days={dayVals(hist, (h) => h.max)} from={shiftDays(t, -364)} to={shiftDays(t, -1)} domain={[5, 40]} color={(x) => mix([251, 250, 246], [235, 104, 52], Math.min(1, x))} />
        </div>
      </section>
      <section><Fig n={4} title="Bahçenin dağılımı" note="Bugünkü görüntüdeki piksellerin canlılık dağılımı; sütun rengi haritadakiyle aynı skaladır." /><Histogram d={d} s={s} /></section>
      <section><Fig n={5} title="On iki ay, on iki harita" note="Aylara yakın net görüntüler; hepsi aynı renk skalasında, bu yüzden yan yana karşılaştırılabilir." />{monthlyMaps(d, s)}</section>
    </>
  )
}
const mix = (a: number[], b: number[], t: number): string => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`

function AnalizCok({ d, s }: { d: Proto; s: Saha }) {
  const m = d.multi
  const years = (m?.yillar ?? []).filter((y) => s.yearGrids.has(y.yil))
  const dist = years.map((y) => ({ yil: y.yil, values: Array.from(s.yearGrids.get(y.yil)!.values).filter(Number.isFinite), flagged: y.uyumsuz }))
  const flagged = (m?.yillar ?? []).filter((y) => y.uyumsuz)
  return (
    <>
      <section>
        <Fig n={1} title={`Ağaç gücü bölgeleri, ${m?.yil_araligi ?? ''}`} note="Her yılın görüntüsü kendi içinde sıralanır, yıllar ortalanır. Bölge, bahçenin yıllardır güçlü ya da zayıf kalan kesimidir." />
        <table className="tbl"><thead><tr><th>Bölge</th><th style={{ textAlign: 'right' }}>Alan</th><th style={{ textAlign: 'right' }}>Pay</th><th style={{ textAlign: 'right' }}>Bahçe ort. farkı</th><th>İstikrar</th></tr></thead>
          <tbody>{[...(m?.ozet ?? [])].reverse().map((z) => (
            <tr key={z.sinif}>
              <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><i style={{ width: 13, height: 13, background: ZONE_HEX[z.sinif - 1], border: '1px solid var(--ink)', display: 'block' }} /><b>{z.ad}</b>{z.kontrol_onerisi && <span className="mono" style={{ fontSize: 10.5 }}>▨ yerinde kontrol</span>}</span></td>
              <td className="mono" style={{ textAlign: 'right' }}>{f2(z.alan_dekar, 1)} da</td><td className="mono" style={{ textAlign: 'right' }}>%{Math.round(z.pay * 100)}</td>
              <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{z.fark_yuzde == null ? '—' : `${z.fark_yuzde >= 0 ? '+' : '−'}%${Math.abs(z.fark_yuzde).toFixed(1).replace('.', ',')}`}</td>
              <td>{z.istikrar_sinifi === 'yuksek' ? 'Yüksek' : z.istikrar_sinifi === 'orta' ? 'Orta' : 'Düşük'}</td>
            </tr>))}</tbody></table>
        <div style={{ marginTop: 10, display: 'grid', gap: 3, fontSize: 13.5 }}>{m?.yorumlar.map((y) => <div key={y}>{y}</div>)}</div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}><span className="mono">1</span> Bölgeler ağaç gücünü gösterir; hasat kayıtlarıyla (Adım 11) verim potansiyeli olarak doğrulanacak.</div>
      </section>
      <section><Fig n={2} title="Yıl yıl dağılım" note="Her çizgi o yılın bahçe içi canlılık dağılımı; dikey çizgi medyan. Kesikli çizgiler diğer yıllarla uyumsuz yıllar." /><Ridgeline years={dist} domain={s.yearDomain} /></section>
      <section>
        <Fig n={3} title="Kullanılan yıllar" note="Tüm yıllar aynı skalada; uyumsuz olanların kenarı kesikli. Aşağıdan dahil/hariç seçilir." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {years.map((y) => <GridCanvas ring={ringsOf(d)} key={y.yil} grid={s.yearGrids.get(y.yil)!} domain={s.yearDomain} scale={3} label={String(y.yil)} sub={`r ${f2(y.korelasyon)}${y.uyumsuz ? ' ▲' : ''}`} dim={!y.dahil} />)}
        </div>
        <div style={{ marginTop: 8 }}><RampLegend domain={s.yearDomain} width={260} caption="yıllık kompozit · aynı skala" /></div>
        {flagged.length > 0 && (
          <div className="rule-t rule-b" style={{ marginTop: 14, padding: '12px 0', display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ color: 'var(--st-izle)', fontSize: 22 }}>▲</span>
            <div style={{ flex: 1, fontSize: 13.5 }}><b className="mono">{flagged.map((y) => y.yil).join(' ve ')}</b> diğer yıllarla uyumsuz çıktı. Son yıllarda bahçede değişiklik oldu mu: budama, söküm, yeni dikim, sulama?</div>
            <button className="btn primary">Evet, kaydet</button><button className="btn quiet">Hayır</button>
          </div>
        )}
      </section>
    </>
  )
}

export function AnalizFocus({ d, s, mod }: { d: Proto; s: Saha; mod: 'cok' | 'son12' }) {
  const pins: MapPin[] = mod === 'son12' ? problemPinsSaha(d) : []
  return (
    <Shell d={d} s={s} active="Analiz" title="Analiz" right={<div className="seg"><button data-on={mod === 'son12'}>Son 12 ay</button><button data-on={mod === 'cok'}>Çok yıllık {d.multi?.yil_araligi}</button></div>}
      map={<SahaMap d={d} grid={s.latestGrid} domain={s.domain} contours={mod === 'son12'} zones={mod === 'cok'} weakHatch={mod === 'cok'} pins={pins} padding={{ top: 80, bottom: 70, left: 60, right: 60 }} />}>
      {mod === 'son12' ? <AnalizSon12 d={d} s={s} /> : <AnalizCok d={d} s={s} />}
    </Shell>
  )
}

// ----------------------------------------------------------------------------- Hava
function SprayGrid({ d }: { d: Proto }) {
  const days = d.weather?.gunler.slice(0, 7) ?? []
  const hours = d.weather?.saatlik ?? []
  const today = todayIstanbul()
  const cell = (k: string) => (k === 'gece' ? { background: 'var(--paper-3)' } : k === 'uygun' ? { background: '#14808a' } : k === 'sinirda' ? { background: 'repeating-linear-gradient(135deg,#d99a00 0 3px,#f3dca0 3px 6px)' } : { background: '#8d9893 radial-gradient(circle, rgb(255 255 255 / .6) 1.1px, transparent 1.3px) 0 0/5px 5px' })
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11.5, marginBottom: 8, color: 'var(--ink-2)' }}>
        {([['uygun', 'Uygun'], ['sinirda', 'Sınırda'], ['uygun_degil', 'Uygun değil'], ['gece', 'Gece']] as const).map(([k, l]) => <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><i style={{ width: 14, height: 14, display: 'block', border: '1px solid var(--ink)', ...cell(k) }} />{l}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', rowGap: 3, alignItems: 'center' }}>
        {days.map((day) => {
          const row = hours.filter((h) => h.zaman.slice(0, 10) === day.tarih)
          return [
            <span key={`l${day.tarih}`} style={{ fontSize: 12, fontWeight: 650 }}>{day.tarih === today ? 'Bugün' : weekdayName(day.tarih)}</span>,
            <div key={day.tarih} style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 1.5, height: 24 }}>
              {Array.from({ length: 24 }, (_, hh) => { const h = row.find((r) => Number(r.zaman.slice(11, 13)) === hh); return <i key={hh} title={`${String(hh).padStart(2, '0')}:00`} style={{ display: 'block', border: '1px solid var(--rule-2)', ...(h ? cell(h.gunduz ? h.ilaclama : 'gece') : { background: 'transparent' }) }} /> })}
            </div>,
          ]
        })}
        <span />
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}</span>)}</div>
      </div>
    </div>
  )
}

export function HavaFocus({ d, s }: { d: Proto; s: Saha }) {
  const spray = bestSpray(d)
  const rain = rainWeek(d)
  const irr = d.irrigation
  const risks = d.risks?.riskler ?? []
  const w = d.weather
  const t = s.today
  const levelWord = (l: string) => (l === 'yuksek' ? 'Yüksek' : l === 'orta' ? 'Orta' : 'Düşük')
  const notches = (l: string) => (l === 'yuksek' ? 3 : l === 'orta' ? 2 : 1)
  const sentence = irr?.gerekli ? irr.cumle : `Önümüzdeki 7 gün için ek sulama gerekmiyor${irr?.sonGunler && irr.sonGunler.netMm > 0 ? `; son 7 günde yaklaşık ${f2(irr.sonGunler.netMm, 1)} mm su açığı oluştu` : ''}.`
  return (
    <Shell d={d} s={s} active="Hava" title="Hava" right={w && <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{Math.round(w.simdi.sicaklik)}° · {w.simdi.aciklama}</span>}
      map={<SahaMap d={d} grid={s.latestGrid} domain={s.domain} minimal={false} padding={{ top: 80, bottom: 70, left: 60, right: 60 }} />}>
      <section className="rule-b" style={{ paddingBottom: 22, display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center' }}>
        <div><div className="eyebrow">Bu hafta ilaçlama için en iyi zaman</div><div className="serif" style={{ fontSize: 44, lineHeight: 1.05, marginTop: 4 }}>{spray ? <>{spray.gun}, <span className="mono" style={{ fontWeight: 500, letterSpacing: '-0.04em' }}>{spray.aralik[0]}–{spray.aralik[1]}</span></> : 'Uygun zaman görünmüyor'}</div><div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>Yalnızca gün doğumu–batımı arası; yaklaşık değerlendirme, ürün etiketindeki koşullar esastır.</div></div>
        <Icon name="ilac" size={54} weight={1.1} />
      </section>
      <section><Fig n={1} title="Saat saat ilaçlama uygunluğu" note="Rüzgâr 15 km/s altı, yağış yok, sonraki 6 saatte yağış olasılığı %30 altı, 10–28 °C. Desen ve renk birlikte okunur." /><SprayGrid d={d} /></section>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <div><Fig n={2} title="Sulama" right={<span className="eyebrow">ön değer</span>} /><div style={{ fontSize: 15, lineHeight: 1.5 }}>{sentence}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>Yaklaşık öneridir, sulama reçetesi değildir.</div></div>
        <div><Fig n={3} title="Zararlı ve hastalık" right={<span className="eyebrow">ön değer</span>} />
          <table className="tbl"><tbody>{risks.map((r) => <tr key={r.kod}><td style={{ fontWeight: 600 }}>{r.ad}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', marginRight: 8 }}>{[1, 2, 3].map((i) => <i key={i} style={{ width: 14, height: 8, display: 'block', border: '1px solid var(--ink)', background: i <= notches(r.seviye) ? 'var(--ink)' : 'transparent' }} />)}</span><b>{levelWord(r.seviye)}</b></td></tr>)}</tbody></table>
        </div>
      </section>
      <section>
        <Fig n={4} title="Yedi günlük tahmin" note={`Çubuk en düşük–en yüksek sıcaklık; mavi sütun yağış. Toplam ${rain ? f2(rain.mm, 1) : '—'} mm.`} />
        <table className="tbl"><thead><tr><th>Gün</th><th>Sıcaklık aralığı</th><th style={{ textAlign: 'right' }}>Yağış</th><th style={{ textAlign: 'right' }}>Rüzgâr</th></tr></thead>
          <tbody>{w?.gunler.slice(0, 7).map((g) => { const lo = (g.min ?? 0); const hi = (g.max ?? 0); const sx = (v: number) => ((v - 8) / 30) * 240; return (
            <tr key={g.tarih}><td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{g.tarih === t ? 'Bugün' : weekdayName(g.tarih)} <span className="mono" style={{ color: 'var(--ink-3)', fontWeight: 400 }}>{formatDayMonth(g.tarih)}</span></td>
              <td><svg width={300} height={18}><line x1={40} x2={280} y1={9} y2={9} stroke="var(--rule)" /><rect x={40 + sx(lo)} y={5} width={Math.max(2, sx(hi) - sx(lo))} height={8} fill="var(--ink)" /><text x={36 + sx(lo)} y={13} textAnchor="end" fontSize={10.5} fontFamily="var(--font-mono)">{Math.round(lo)}°</text><text x={44 + sx(hi)} y={13} fontSize={10.5} fontFamily="var(--font-mono)">{Math.round(hi)}°</text></svg></td>
              <td className="mono" style={{ textAlign: 'right' }}><span style={{ display: 'inline-block', width: Math.min(60, (g.yagisMm ?? 0) * 5), height: 8, background: '#2a78d6', marginRight: 6 }} />{f2(g.yagisMm ?? 0, 1)} mm</td>
              <td className="mono" style={{ textAlign: 'right' }}>{Math.round(g.ruzgarMax ?? 0)} km/s</td></tr>) })}</tbody></table>
      </section>
    </Shell>
  )
}

// ----------------------------------------------------------------------------- Asistan
const SAMPLES = ['Bahçem geçen yıla göre nasıl?', 'Bu hafta ilaçlama için en iyi gün hangisi?', 'Zayıf görünen kesim neden zayıf?', 'Meyve sineği için bu hafta ne yapmalıyım?']
export function Asistan({ d, s }: { d: Proto; s: Saha }) {
  const why = scoreWhy(d)
  const ndvi = seriesPts(d, 'ndvi')
  const spray = bestSpray(d)
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Rail active="asistan" />
      <aside className="rule-r" style={{ width: 252, flex: 'none', padding: '18px 16px', background: 'var(--paper)' }}>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center', height: 34 }}>Yeni sohbet</button>
        <div style={{ marginTop: 18 }}><div className="eyebrow">{d.garden?.ad}</div>{['Bahçem geçen yıla göre nasıl?', 'Bu hafta ilaçlama zamanı'].map((t) => <div key={t} className="rule-t" style={{ padding: '9px 0', fontSize: 13 }}>{t}</div>)}</div>
        <div style={{ marginTop: 18 }}><div className="eyebrow">Genel</div><div className="rule-t" style={{ padding: '9px 0', fontSize: 13 }}>Hibe başvurusu için neler gerekir?</div></div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '40px 0' }}>
          <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><div className="eyebrow">Asistan · {formatDate(s.today)}</div><h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: '6px 0 0' }}>Merhaba.<br />Bahçeniz bugün şöyle.</h1></div>
              <IllLimonDali size={190} />
            </div>
            <section className="rule-t" style={{ marginTop: 22, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
              <div><div className="eyebrow">{d.garden?.ad}</div><div className="num-big" style={{ marginTop: 6 }}>{why.score ?? '—'}<span className="unit">/ 100</span></div><div style={{ marginTop: 4 }}><StatusWord status={d.status?.durum} /></div></div>
              <div><div className="eyebrow">Canlılık</div><div className="num-big" style={{ marginTop: 6 }}>{f2(ndvi[ndvi.length - 1]?.value)}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{d.latest ? formatDayMonth(d.latest.tarih) : ''} görüntüsü</div></div>
              <div><div className="eyebrow">İlaçlama</div><div className="num-big" style={{ marginTop: 6, fontSize: 26 }}>{spray ? `${spray.gun} ${spray.aralik[0]}` : '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>en iyi pencere</div></div>
            </section>
            <p style={{ fontSize: 15, lineHeight: 1.55, margin: '16px 0 0', maxWidth: 620 }}>{d.status?.ozet}{why.note ? ` ${why.note}` : ''}</p>
            <section style={{ marginTop: 30 }}>
              <div className="eyebrow">Şunları sorabilirsiniz</div>
              <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>{SAMPLES.map((q, i) => <li key={q} className="rule-t" style={{ display: 'grid', gridTemplateColumns: '28px 1fr 24px', padding: '12px 0', alignItems: 'baseline', cursor: 'pointer' }}><span className="mono" style={{ color: 'var(--ink-3)' }}>{i + 1}</span><span className="serif" style={{ fontSize: 19 }}>{q}</span><span>→</span></li>)}</ol>
            </section>
          </div>
        </div>
        <div className="rule-t" style={{ padding: '14px 28px 20px' }}><div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>{['zayıf bölgeleri göster', 'geçen yılla karşılaştır', 'ilaçlama zamanı'].map((c) => <button key={c} className="btn quiet" style={{ height: 24, fontSize: 11.5 }}>{c}</button>)}</div>
          <div style={{ border: '1px solid var(--ink)', height: 46, display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--ink-3)', fontSize: 13.5 }}><span style={{ flex: 1 }}>Yakında – Adım 16 (şimdilik komutlar çalışır)</span><span className="mono">↵</span></div>
        </div></div>
      </main>
      <aside className="rule-l" style={{ width: 300, flex: 'none', padding: '18px 18px' }}>
        <div className="eyebrow">Seçili bahçe</div>
        <div className="serif" style={{ fontSize: 24, marginTop: 4 }}>{d.garden?.ad}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Limon · <span className="mono">{f2(d.garden?.alanDekar, 1)}</span> da</div>
        <div className="eyebrow" style={{ marginTop: 22 }}>Cevaplar neye dayanır</div>
        <table className="tbl" style={{ marginTop: 6 }}><tbody>
          <tr><td>Uydu</td><td className="mono" style={{ textAlign: 'right' }}>{d.scenes.length} net görüntü</td></tr>
          <tr><td>Hava</td><td className="mono" style={{ textAlign: 'right' }}>Open-Meteo</td></tr>
          <tr><td>Çok yıllık</td><td className="mono" style={{ textAlign: 'right' }}>{d.multi?.yil_araligi ?? '—'}</td></tr>
          <tr><td>Kurallar</td><td style={{ textAlign: 'right' }}>ön değer</td></tr>
        </tbody></table>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 14 }}>Asistan teşhis koymaz; risk tahmini ve yaklaşık öneri verir.</div>
      </aside>
      <HatchHost />
      {void Logo}{void CommandBox}{void Index}{void DockChart}
    </div>
  )
}
