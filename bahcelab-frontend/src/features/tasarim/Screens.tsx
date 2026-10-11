import { ArrowLeft, Paperclip, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { layerImageUrl } from '../bahcem/api/indeksApi'
import { formatDate, formatDayMonth, todayIstanbul, weekdayName } from '../bahcem/lib/dates'
import { INDEX_DEFS, type IndexId } from '../bahcem/lib/indices'
import { Briefing } from './Briefing'
import type { Proto } from './data'
import { Dock } from './Dock'
import { bestSpray, cappedScore, indexSeries, rainWeek, rangeLast12, seasonRainGdd } from './derive'
import { Delta, Glyph, ScoreRing, Section, Spark, fmt, type Yon } from './parts'
import { ProtoMap, problemPins, ZONE_COLORS, type Pin } from './ProtoMap'
import { CommandBar, GardenListFlyout, GardenStrip, LayerPicker, Rail } from './shell'
import { TimeChart } from './TimeChart'

/** Lejant: bahçenin kendi farkları + narenciye için tipik aralık işareti (ön değer). */
function MapLegend({ d }: { d: Proto }) {
  const s = d.latest?.indeksler.ndvi
  return (
    <div style={{ position: 'absolute', left: 16, bottom: 16, width: 250, padding: '10px 12px', background: 'rgb(12 18 15 / 0.92)', border: '1px solid var(--kc-line2)', borderRadius: 12, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>Canlılık · {d.latest ? formatDayMonth(d.latest.tarih) : ''}</span>
        <span className="label">kendi farkları</span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'linear-gradient(90deg,#edf8dc,#bae496,#5ab464,#1e7846,#004426)' }}>
        <span title="Narenciye için tipik aralık (ön değer)" style={{ position: 'absolute', left: '52%', width: '30%', top: -4, height: 18, border: '1.5px solid var(--kc-lemon)', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="num">
        <span>{fmt(s?.p10 ?? null)} zayıf</span>
        <span style={{ color: 'var(--kc-lemon)' }}>narenciye tipik</span>
        <span>güçlü {fmt(s?.p90 ?? null)}</span>
      </div>
    </div>
  )
}

/** ÇALIŞMA ALANI: ray · bahçe şeridi · harita (tam yükseklik) + zaman dok'u · brifing. */
export function Workspace({ d, yon, flyout = false, layerOpen = false, zones = false }: { d: Proto; yon: Yon; flyout?: boolean; layerOpen?: boolean; zones?: boolean }) {
  const [index, setIndex] = useState<IndexId>('ndvi')
  const [selected, setSelected] = useState<string | null>(d.latest?.tarih ?? null)
  const pins: Pin[] = useMemo(() => problemPins(d), [d])
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Rail active="bahceler" yon={yon} />
      <GardenStrip d={d} yon={yon} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#0b0f0d' }}>
          <ProtoMap d={d} yon={yon} zones={zones} pins={pins} padding={{ top: 90, bottom: 40, left: 90, right: 60 }} />
          <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}><CommandBar yon={yon} /></div>
            <div style={{ pointerEvents: 'auto' }}><LayerPicker d={d} active={index} open={layerOpen} onPick={setIndex} /></div>
          </div>
          {flyout && <div style={{ position: 'absolute', left: 12, top: 66 }}><GardenListFlyout d={d} yon={yon} /></div>}
          <MapLegend d={d} />
        </div>
        <Dock d={d} index={index} onIndex={setIndex} selected={selected} onSelect={setSelected} />
      </div>
      <Briefing d={d} yon={yon} />
    </div>
  )
}

/** Odak görünümü kabuğu: solda içerik, sağda senkron harita; ray kalır. */
function FocusShell({ d, yon, active, title, right, children, mapProps }: { d: Proto; yon: Yon; active: string; title: string; right?: React.ReactNode; children: React.ReactNode; mapProps?: { zones?: boolean; pins?: Pin[] } }) {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Rail active="bahceler" yon={yon} />
      <div style={{ flex: '1 1 58%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', borderBottom: '1px solid var(--kc-line)', flex: 'none' }}>
          <a className="ghost" style={{ height: 30, padding: '0 8px', whiteSpace: 'nowrap' }}><ArrowLeft size={14} />Alan</a>
          <h1 className="title" style={{ margin: 0, fontSize: 20, whiteSpace: 'nowrap' }}>{d.garden?.ad} <span style={{ color: 'var(--kc-ink3)', fontWeight: 400 }}>/</span> {title}</h1>
          <nav aria-label="Odak görünümleri" style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {['Analiz', 'Hava', 'Günlük', 'Rapor', 'Arşiv'].map((n) => <button key={n} className="chip" data-on={n === active}>{n}</button>)}
          </nav>
          <span style={{ flex: 1 }} />
          {right}
        </header>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px', display: 'grid', gap: 18, alignContent: 'start' }}>{children}</div>
      </div>
      <div style={{ flex: '1 1 42%', minWidth: 0, position: 'relative', borderLeft: '1px solid var(--kc-line)' }}>
        <ProtoMap d={d} yon={yon} zones={mapProps?.zones} pins={mapProps?.pins} padding={{ top: 60, bottom: 60, left: 50, right: 50 }} />
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: 6 }}>
          <span className="chip" data-on="true" style={{ background: 'rgb(12 18 15 / .9)' }}>Canlılık</span>
          <span className="chip" style={{ background: 'rgb(12 18 15 / .9)' }}>Gerçek renk</span>
          {mapProps?.zones && <span className="chip" data-on="true" style={{ background: 'rgb(12 18 15 / .9)' }}>Bölgeler %35</span>}
        </div>
      </div>
    </div>
  )
}

function Card({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="card" style={{ padding: 16, display: 'grid', gap: 12, alignContent: 'start', ...style }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="title" style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}

function Histogram({ d }: { d: Proto }) {
  const bins = useMemo(() => {
    const v = d.grid?.values
    if (!v) return []
    const vals = Array.from(v).filter((x) => Number.isFinite(x))
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const n = 24
    const out = new Array<number>(n).fill(0)
    vals.forEach((x) => (out[Math.min(n - 1, Math.floor(((x - lo) / (hi - lo || 1)) * n))] += 1))
    return out.map((c, i) => ({ c: c / vals.length, from: lo + ((hi - lo) * i) / n }))
  }, [d.grid])
  const max = Math.max(...bins.map((b) => b.c), 0.001)
  const s = d.latest?.indeksler.ndvi
  const good = bins.filter((b) => s && b.from >= s.p10).reduce((a, b) => a + b.c, 0)
  return (
    <Card title="Bahçe dağılımı" right={<span className="num" style={{ fontSize: 12, color: 'var(--kc-ink2)' }}>{d.latest ? formatDayMonth(d.latest.tarih) : ''}</span>}>
      <div style={{ fontSize: 13, color: 'var(--kc-ink2)' }}>Alanın <strong className="num" style={{ color: 'var(--kc-ink)' }}>%{Math.round(good * 100)}</strong>’i bahçe ortalamasının yakınında ya da üstünde.</div>
      <svg width="100%" height={92} viewBox="0 0 240 92" preserveAspectRatio="none" role="img" aria-label="Canlılık dağılım histogramı">
        {bins.map((b, i) => <rect key={i} x={i * 10 + 1} width={8} y={86 - (b.c / max) * 80} height={(b.c / max) * 80} rx={1.5} fill={s && b.from < s.p10 ? 'var(--kc-warn)' : 'var(--kc-series)'} opacity={0.9} />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }} className="num"><span className="label">{fmt(s?.min ?? null)}</span><span className="label">medyan {fmt(s?.medyan ?? null)}</span><span className="label">{fmt(s?.max ?? null)}</span></div>
    </Card>
  )
}

function Contributions({ d, yon }: { d: Proto; yon: Yon }) {
  const comps = d.status?.bilesenler ?? []
  return (
    <Card title="Skor neden böyle?" right={<ScoreRing score={cappedScore(d)} status={d.status?.durum ?? 'veri_yok'} size={44} yon={yon} />}>
      <div style={{ display: 'grid', gap: 9 }}>
        {comps.map((c) => (
          <div key={c.kod} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 34px', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.ad}</span>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--kc-line)', overflow: 'hidden' }}><div style={{ width: `${c.puan ?? 0}%`, height: '100%', background: (c.puan ?? 0) >= 75 ? 'var(--kc-ok)' : (c.puan ?? 0) >= 50 ? 'var(--kc-warn)' : 'var(--kc-bad)' }} /></div>
            <span className="num" style={{ fontSize: 12, textAlign: 'right' }}>{c.puan ?? '—'}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function SmallMultiples({ d, index }: { d: Proto; index: IndexId }) {
  const picks = useMemo(() => {
    const n = d.scenes.length
    if (n < 4) return d.scenes
    return [0.12, 0.4, 0.7, 1].map((f) => d.scenes[Math.min(n - 1, Math.floor((n - 1) * f))])
  }, [d.scenes])
  const last = picks[picks.length - 1]?.indeksler[index]?.ortalama
  return (
    <Card title="Aynı bahçe, dört tarih" right={<span className="label">karşılaştırma</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {picks.map((s) => {
          const v = s.indeksler[index]?.ortalama
          return (
            <figure key={s.tarih} style={{ margin: 0, display: 'grid', gap: 5 }}>
              <div style={{ aspectRatio: '1', borderRadius: 'var(--kc-r-sm)', overflow: 'hidden', background: '#0e130f', border: '1px solid var(--kc-line2)' }}>
                <img alt={`${formatDate(s.tarih)} ${INDEX_DEFS[index].ad}`} src={layerImageUrl(d.id!, s, index)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <figcaption style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span style={{ color: 'var(--kc-ink2)' }}>{formatDayMonth(s.tarih)}</span>
                <span className="num" style={{ fontWeight: 700 }}>{fmt(v ?? null)}</span>
              </figcaption>
            </figure>
          )
        })}
      </div>
      <div className="label">Son tarih ortalaması {fmt(last ?? null)} · aynı renk skalası</div>
    </Card>
  )
}

function ZonesBlock({ d }: { d: Proto }) {
  const m = d.multi
  if (!m || m.durum !== 'hazir') return <Card title="Ağaç gücü bölgeleri"><div style={{ color: 'var(--kc-ink2)', fontSize: 13 }}>Çok yıllık analiz henüz çalıştırılmadı.</div></Card>
  return (
    <>
      <Card title={`Ağaç gücü bölgeleri · ${m.yil_araligi}`} right={<span className="chip" data-on="true">3 bölge</span>}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Bölge', 'Alan', 'Pay', 'Bahçe ort. farkı', 'İstikrar'].map((h) => <th key={h} className="label" style={{ textAlign: h === 'Bölge' ? 'left' : 'right', padding: '0 0 8px', fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>
            {[...m.ozet].reverse().map((z) => (
              <tr key={z.sinif} style={{ borderTop: '1px solid var(--kc-line)' }}>
                <td style={{ padding: '9px 0', display: 'flex', alignItems: 'center', gap: 8 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: ZONE_COLORS[z.sinif - 1], display: 'block' }} /> {z.ad}</td>
                <td className="num" style={{ textAlign: 'right' }}>{fmt(z.alan_dekar, 1)} da</td>
                <td className="num" style={{ textAlign: 'right' }}>%{Math.round(z.pay * 100)}</td>
                <td style={{ textAlign: 'right' }}><Delta value={z.fark_yuzde} /></td>
                <td style={{ textAlign: 'right', paddingLeft: 12 }}><span style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3].map((i) => <i key={i} style={{ width: 14, height: 6, borderRadius: 2, background: i <= (z.istikrar_sinifi === 'yuksek' ? 3 : z.istikrar_sinifi === 'orta' ? 2 : 1) ? 'var(--kc-ink)' : 'var(--kc-line2)', display: 'block' }} />)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'grid', gap: 4 }}>{m.yorumlar.map((y) => <div key={y} style={{ fontSize: 13.5, display: 'flex', gap: 8 }}><Glyph name="bolge" size={17} color="var(--kc-ink2)" />{y}</div>)}</div>
        <div className="label" style={{ textTransform: 'none', letterSpacing: 0 }}>Bölgeler ağaç gücünü gösterir; hasat kayıtlarıyla (Adım 11) verim potansiyeli olarak doğrulanacak.</div>
      </Card>
      <Card title="Kullanılan yıllar" right={<span className="label">dahil / hariç</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {m.yillar.map((y) => (
            <figure key={y.yil} style={{ margin: 0, display: 'grid', gap: 4, opacity: y.dahil ? 1 : 0.6 }}>
              <div style={{ aspectRatio: '1', borderRadius: 'var(--kc-r-sm)', overflow: 'hidden', background: '#0e130f', border: `1px solid ${y.uyumsuz ? 'var(--kc-warn)' : 'var(--kc-line2)'}`, position: 'relative' }}>
                <img alt={`${y.yil} kompozit`} src={`/api/gardens/${d.id}/bolgeler/cok-yillik/yillar/${y.yil}/gorsel`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <figcaption style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                <span className="num" style={{ fontWeight: 700 }}>{y.yil}</span>
                <span className="num" style={{ color: y.uyumsuz ? 'var(--kc-warn)' : 'var(--kc-ink2)' }}>r {fmt(y.korelasyon, 2)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        {m.yillar.some((y) => y.uyumsuz) && (
          <div className="raised" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--kc-warn)' }}>
            <Glyph name="uyari" color="var(--kc-warn)" />
            <div style={{ flex: 1, fontSize: 13 }}><strong>{m.yillar.filter((y) => y.uyumsuz).map((y) => y.yil).join(', ')}</strong> diğer yıllarla uyumsuz. Son yıllarda bahçede değişiklik oldu mu (budama, söküm, yeni dikim, sulama)?</div>
            <button className="primary">Evet, kaydet</button><button className="ghost">Hayır</button>
          </div>
        )}
      </Card>
    </>
  )
}

export function AnalizFocus({ d, yon, mod = 'cok' }: { d: Proto; yon: Yon; mod?: 'cok' | 'son12' }) {
  const series = indexSeries(d, 'ndvi')
  const { rain, bands } = seasonRainGdd(d)
  const [sel, setSel] = useState<string | null>(d.latest?.tarih ?? null)
  return (
    <FocusShell d={d} yon={yon} active="Analiz" title="Analiz" mapProps={{ zones: mod === 'cok', pins: mod === 'cok' ? [] : problemPins(d) }}
      right={undefined}>
      <div style={{ display: 'flex', gap: 4 }}><button className="chip" data-on={mod === 'son12'}>Son 12 ay</button><button className="chip" data-on={mod === 'cok'}>Çok yıllık ({d.multi?.yil_araligi ?? '—'})</button></div>
      <Card title="Sezon karşılaştırma" right={<span className="label">Canlılık · son 12 ay</span>}>
        <TimeChart height={250} range={rangeLast12()} domain={[0.4, 0.8]} line={series} bands={bands} rain={rain} netDates={d.scenes.map((s) => s.tarih)} selected={sel} onSelect={setSel} unitLabel="Canlılık" lanes />
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}><Histogram d={d} /><Contributions d={d} yon={yon} /></div>
      <SmallMultiples d={d} index="ndvi" />
      {mod === 'cok' ? <ZonesBlock d={d} /> : <ProblemAreas d={d} />}
    </FocusShell>
  )
}

function ProblemAreas({ d }: { d: Proto }) {
  const pins = problemPins(d)
  return (
    <Card title="Sorunlu alanlar" right={<span className="label">{d.latest ? formatDate(d.latest.tarih) : ''}</span>}>
      {pins.length === 0 ? <div style={{ color: 'var(--kc-ink2)', fontSize: 13 }}>Bu tarihte bahçe ortalamasının belirgin altında alan yok.</div> : pins.map((p) => <div key={p.text} className="raised" style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}><Glyph name="uyari" color="var(--kc-warn)" /><span style={{ flex: 1, fontWeight: 700 }} className="num">{p.text}</span><button className="ghost">Haritada göster</button></div>)}
    </Card>
  )
}

/** Isı haritası: 7 gün × 24 saat; gece düz açık gri + «gece»; desen yalnız sınırda/uygun değil. */
function SprayGrid({ d }: { d: Proto }) {
  const days = d.weather?.gunler.slice(0, 7) ?? []
  const hours = d.weather?.saatlik ?? []
  return (
    <Card title="Saat saat ilaçlama" right={<div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--kc-ink2)' }}>{([['uygun', 'Uygun'], ['sinirda', 'Sınırda'], ['uygun_degil', 'Uygun değil'], ['gece', 'Gece']] as const).map(([k, l]) => <span key={k} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><i className={k === 'sinirda' ? 'spray-edge' : k === 'uygun_degil' ? 'spray-no' : undefined} style={{ width: 12, height: 12, borderRadius: 2, display: 'block', backgroundColor: k === 'uygun' ? 'var(--kc-spray-ok)' : k === 'gece' ? 'var(--kc-night)' : undefined }} />{l}</span>)}</div>}>
      <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 6, alignItems: 'center' }}>
        {days.map((day) => {
          const row = hours.filter((h) => h.zaman.slice(0, 10) === day.tarih)
          return [
            <span key={`l${day.tarih}`} style={{ fontSize: 12, fontWeight: 700 }}>{day.tarih === todayIstanbul() ? 'Bugün' : weekdayName(day.tarih)}</span>,
            <div key={day.tarih} style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 1, height: 26, position: 'relative' }}>
              {Array.from({ length: 24 }, (_, hh) => {
                const h = row.find((r) => Number(r.zaman.slice(11, 13)) === hh)
                if (!h) return <i key={hh} />
                const night = !h.gunduz
                const kind = night ? 'gece' : h.ilaclama
                return <i key={hh} title={`${String(hh).padStart(2, '0')}:00 · ${kind}`} className={kind === 'sinirda' ? 'spray-edge' : kind === 'uygun_degil' ? 'spray-no' : undefined} style={{ display: 'block', borderRadius: 2, backgroundColor: kind === 'gece' ? 'var(--kc-night)' : kind === 'uygun' ? 'var(--kc-spray-ok)' : undefined }} />
              })}
              {row.length > 0 && <><span style={{ position: 'absolute', left: '4%', top: 7, fontSize: 9.5, fontWeight: 700, color: 'var(--kc-night-ink)' }}>gece</span><span style={{ position: 'absolute', right: '3%', top: 7, fontSize: 9.5, fontWeight: 700, color: 'var(--kc-night-ink)' }}>gece</span></>}
            </div>,
          ]
        })}
        <span />
        <div style={{ display: 'flex', justifyContent: 'space-between' }} className="num"><span className="label">00</span><span className="label">06</span><span className="label">12</span><span className="label">18</span><span className="label">24</span></div>
      </div>
    </Card>
  )
}

export function HavaFocus({ d, yon }: { d: Proto; yon: Yon }) {
  const spray = bestSpray(d)
  const rain = rainWeek(d)
  const irr = d.irrigation
  const risks = d.risks?.riskler ?? []
  const w = d.weather
  return (
    <FocusShell d={d} yon={yon} active="Hava" title="Hava" right={w && <span className="num" style={{ fontSize: 13, color: 'var(--kc-ink2)' }}>{Math.round(w.simdi.sicaklik)}° · {w.simdi.aciklama}</span>}>
      <section className="card" style={{ padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'center', background: 'var(--kc-s2)' }}>
        <Glyph name="ilac" size={34} color="var(--kc-spray-ok)" />
        <div>
          <div className="label">Bu hafta ilaçlama için en iyi zaman</div>
          <div className="title" style={{ fontSize: 30, lineHeight: 1.15 }}>{spray ? <>{spray.gun} <span className="num">{spray.aralik[0]}–{spray.aralik[1]}</span></> : 'Uygun zaman görünmüyor'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--kc-ink2)', marginTop: 2 }}>Yalnızca gün doğumu–batımı arası; yaklaşık değerlendirme, ürün etiketi esastır.</div>
        </div>
      </section>
      <SprayGrid d={d} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Card title="Sulama" right={<span className="chip">ön değer</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><div className="label">Son 7 gün açığı</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(irr?.sonGunler?.netMm ?? null, 1)} <span style={{ fontSize: 12, fontWeight: 500 }}>mm</span></div></div>
            <div><div className="label">Önümüzdeki 7 gün</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(irr?.onumuzdekiGunler?.netMm ?? null, 1)} <span style={{ fontSize: 12, fontWeight: 500 }}>mm</span></div></div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--kc-ink2)' }}>{irr?.cumle}</div>
        </Card>
        <Card title="Zararlı ve hastalık" right={<span className="chip">ön değer</span>}>
          {risks.map((r) => (
            <div key={r.kod} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.ad}</span>
              <span style={{ display: 'inline-flex', gap: 2 }} aria-label={r.seviye}>{[1, 2, 3].map((i) => <i key={i} style={{ width: 16, height: 7, borderRadius: 2, display: 'block', background: i <= (r.seviye === 'yuksek' ? 3 : r.seviye === 'orta' ? 2 : 1) ? (r.seviye === 'dusuk' ? 'var(--kc-ok)' : 'var(--kc-warn)') : 'var(--kc-line2)' }} />)}</span>
            </div>
          ))}
        </Card>
      </div>
      <Card title="7 günlük tahmin" right={<span className="num label">{rain ? `${fmt(rain.mm, 1)} mm yağış` : ''}</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {w?.gunler.slice(0, 7).map((g) => (
            <div key={g.tarih} className="raised" style={{ padding: '10px 6px', textAlign: 'center', display: 'grid', gap: 3 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{g.tarih === todayIstanbul() ? 'Bugün' : weekdayName(g.tarih)}</span>
              <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(g.max ?? 0)}°</span>
              <span className="num" style={{ fontSize: 11.5, color: 'var(--kc-ink3)' }}>{Math.round(g.min ?? 0)}°</span>
              <svg height={26} width="100%" aria-hidden><rect x="35%" width="30%" y={26 - Math.min(26, (g.yagisMm ?? 0) * 3)} height={Math.min(26, (g.yagisMm ?? 0) * 3)} fill="var(--kc-water)" /></svg>
              <span className="num" style={{ fontSize: 11 }}>{fmt(g.yagisMm ?? 0, 1)} mm</span>
            </div>
          ))}
        </div>
      </Card>
    </FocusShell>
  )
}

/** ASİSTAN: solda geçmiş, ortada sohbet (zengin bloklar), sağda bağlam. LLM Adım 16'da; burada yalnızca arayüz. */
export function Asistan({ d, yon }: { d: Proto; yon: Yon }) {
  const ndvi = indexSeries(d, 'ndvi')
  const last = ndvi[ndvi.length - 1]
  const prev = ndvi[Math.max(0, ndvi.length - 8)]
  const pins = problemPins(d)
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Rail active="asistan" yon={yon} />
      <aside style={{ width: 264, borderRight: '1px solid var(--kc-line)', background: 'var(--kc-s1)', padding: 14, display: 'grid', gap: 14, alignContent: 'start', flex: 'none' }}>
        <button className="primary" style={{ justifyContent: 'center', height: 36 }}>Yeni sohbet</button>
        <Section label={d.garden?.ad ?? ''}>
          {['Bahçem geçen yıla göre nasıl?', 'Bu hafta ilaçlama için en iyi gün', 'Zayıf bölge neden zayıf?'].map((t, i) => <div key={t} className="raised" style={{ padding: '8px 10px', fontSize: 12.5, borderColor: i === 0 ? 'var(--kc-ink3)' : undefined }}>{t}</div>)}
        </Section>
        <Section label="Genel">
          {['Hibe başvurusu için neler gerekir?'].map((t) => <div key={t} className="raised" style={{ padding: '8px 10px', fontSize: 12.5 }}>{t}</div>)}
        </Section>
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ margin: '14px 24px 0', padding: '8px 12px', borderRadius: 'var(--kc-r-sm)', border: '1px dashed var(--kc-line2)', fontSize: 12.5, color: 'var(--kc-ink2)' }}>Önizleme · Asistan Adım 16’da açılır. Aşağıdaki cevap, bu bahçenin gerçek verisinden bir örnek bloktur.</div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'grid', gap: 16, alignContent: 'start', maxWidth: 820, width: '100%', margin: '0 auto' }}>
          <div style={{ justifySelf: 'end', maxWidth: '70%', padding: '10px 14px', borderRadius: 'var(--kc-r)', background: 'var(--kc-s3)', fontSize: 14 }}>Bahçem son iki haftada nasıl?</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{d.garden?.ad} bahçenizin canlılığı <strong className="num">{fmt(last?.value ?? null)}</strong>; iki hafta öncesine göre <Delta value={prev && last ? ((last.value - prev.value) / prev.value) * 100 : null} />. {d.status?.ozet}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
              <div className="card" style={{ padding: 12, display: 'grid', gap: 6 }}>
                <span className="label">Canlılık · son 12 ay</span>
                <Spark values={ndvi.map((p) => p.value)} width={300} height={70} />
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: 110, background: '#0e130f' }}>
                {d.latest && <img alt="Bahçe haritası" src={layerImageUrl(d.id!, d.latest, 'ndvi')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
                {pins[0] && <span className="pin" style={{ position: 'absolute', left: '50%', top: '62%', transform: 'translate(-50%,-50%)' }}><i />{pins[0].text}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span className="label">Dayandığı kaynaklar</span>{['Sentinel-2 · ' + (d.latest ? formatDayMonth(d.latest.tarih) : ''), 'Open-Meteo', 'Kural: ön değer'].map((s) => <span key={s} className="chip">{s}</span>)}</div>
          </div>
        </div>
        <div style={{ padding: '10px 24px 18px', maxWidth: 820, width: '100%', margin: '0 auto', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['zayıf bölgeleri göster', 'geçen yılla karşılaştır', 'ilaçlama zamanı'].map((c) => <button key={c} className="chip">{c}</button>)}</div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', height: 48, opacity: 0.7 }}><Paperclip size={16} /><span style={{ flex: 1, color: 'var(--kc-ink3)', fontSize: 13.5 }}>Yakında – Adım 16</span><Send size={16} /></div>
        </div>
      </main>
      <aside style={{ width: 320, borderLeft: '1px solid var(--kc-line)', background: 'var(--kc-s1)', padding: 16, display: 'grid', gap: 14, alignContent: 'start', flex: 'none' }}>
        <Section label="Seçili bahçe">
          <div className="raised" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <ScoreRing score={cappedScore(d)} status={d.status?.durum ?? 'veri_yok'} size={56} yon={yon} />
            <div><div className="title" style={{ fontSize: 17 }}>{d.garden?.ad}</div><div style={{ fontSize: 12, color: 'var(--kc-ink2)' }}>Limon · <span className="num">{fmt(d.garden?.alanDekar, 1)}</span> da</div></div>
          </div>
        </Section>
        <Section label="Cevabın dayandığı veri">
          {[['Canlılık serisi', `${d.scenes.length} net görüntü`], ['Hava', 'Open-Meteo · 7 gün'], ['Bahçe kuralları', 'ön değer – onay bekliyor']].map(([a, b]) => <div key={a} className="raised" style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>{a}</span><span style={{ color: 'var(--kc-ink2)' }}>{b}</span></div>)}
        </Section>
      </aside>
    </div>
  )
}

/** MOBİL (375 px): harita tam ekran, brifing alt sayfa, zaman alt sayfada sekme, alt gezinme çubuğu. */
export function Mobile({ d, yon, sheet = 'peek' }: { d: Proto; yon: Yon; sheet?: 'peek' | 'ozet' | 'zaman' }) {
  const [sel, setSel] = useState<string | null>(d.latest?.tarih ?? null)
  const { rain, gdd, bands } = seasonRainGdd(d)
  const series = indexSeries(d, 'ndvi')
  const st = d.status
  const h = sheet === 'peek' ? 210 : 560
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}><ProtoMap d={d} yon={yon} pins={problemPins(d).slice(0, 1)} padding={{ top: 80, bottom: h + 60, left: 20, right: 20 }} /></div>
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 8 }}><div style={{ flex: 1 }}><CommandBar yon={yon} compact /></div></div>
      <section style={{ position: 'absolute', zIndex: 4, left: 0, right: 0, bottom: 58, height: h, background: 'var(--kc-s1)', borderRadius: '18px 18px 0 0', borderTop: '1px solid var(--kc-line2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 22, display: 'grid', placeItems: 'center' }}><i style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--kc-line2)', display: 'block' }} /></div>
        {sheet === 'peek' ? (
          <div style={{ padding: '0 16px', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <ScoreRing score={cappedScore(d)} status={st?.durum ?? 'veri_yok'} size={64} yon={yon} />
              <div style={{ minWidth: 0 }}><div className="title" style={{ fontSize: 20 }}>{d.garden?.ad}</div><div style={{ fontSize: 12.5, color: 'var(--kc-ink2)' }}>{st?.etiket} · <span className="num">{fmt(d.garden?.alanDekar, 1)}</span> da</div></div>
            </div>
            {d.today?.[0] && <div className="raised" style={{ padding: '9px 10px', display: 'flex', gap: 10 }}><Glyph name="tuzak" color="var(--kc-warn)" /><div style={{ fontSize: 12.5 }}><strong>{d.today[0].baslik}</strong><div style={{ color: 'var(--kc-ink2)' }}>{d.today[0].metin.slice(0, 70)}…</div></div></div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px' }}>{['Özet', 'Zaman', 'Katman'].map((t) => <button key={t} className="chip" data-on={(sheet === 'ozet' && t === 'Özet') || (sheet === 'zaman' && t === 'Zaman')}>{t}</button>)}</div>
            {sheet === 'ozet' ? <div style={{ overflow: 'hidden' }}><Briefing d={d} yon={yon} mobile /></div> : (
              <div style={{ padding: '0 8px', display: 'grid', gap: 8 }}>
                <div style={{ padding: '0 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}><span className="label">Canlılık · {sel ? formatDate(sel) : ''}</span><span className="num title" style={{ fontSize: 24, fontWeight: 700 }}>{fmt(series.find((p) => p.date === sel)?.value ?? null)}</span></div>
                <TimeChart height={250} range={rangeLast12()} domain={[0.4, 0.8]} line={series} bands={bands} rain={rain} gdd={gdd} netDates={d.scenes.map((s) => s.tarih)} selected={sel} onSelect={setSel} />
              </div>
            )}
          </div>
        )}
      </section>
      <nav aria-label="Ana gezinme" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, bottom: 0, height: 58, background: 'var(--kc-s1)', borderTop: '1px solid var(--kc-line)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {['Bahçelerim', 'Asistan', 'Pazar', 'Bildirim', 'Daha'].map((n, i) => <a key={n} style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 2, fontSize: 10.5, fontWeight: 700, color: i === 0 ? 'var(--kc-ink)' : 'var(--kc-ink3)' }}><span style={{ width: 20, height: 3, borderRadius: 2, background: i === 0 ? 'var(--kc-lemon)' : 'transparent' }} />{n}</a>)}
      </nav>
    </div>
  )
}
