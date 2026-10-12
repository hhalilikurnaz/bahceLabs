import { useMemo, useState } from 'react'
import { layerImageUrl } from '../../bahcem/api/indeksApi'
import { formatDate, formatDayMonth, shiftDays } from '../../bahcem/lib/dates'
import { INDEX_DEFS, type IndexId } from '../../bahcem/lib/indices'
import { stageShortName } from '../../bahcem/lib/phenology'
import type { Proto } from '../data'
import { bestSpray, change14, rainWeek, seasonRainGdd } from '../derive'
import { Icon, type IconName } from './assets'
import { DockChart, GridCanvas, YearWheel, f2 } from './charts'
import { HatchHost } from './HatchHost'
import { Eyebrow, Index, Rail, RampLegend, Sparkline, StatusWord, scoreWhy, seriesPts } from './parts'
import { SahaMap, problemPinsSaha, ringsOf, type MapPin } from './SahaMap'
import type { Saha } from './useSaha'

const GLYPH: Record<string, IconName> = { zararli_riski: 'tuzak', ilaclama: 'ilac', hava_uyarisi: 'don', indeks_dususu: 'yaprak', sulama: 'damla', her_sey_yolunda: 'yaprak' }
/** Madde başına tek uygun eylem. */
const ACTION: Record<string, string> = { zararli_riski: 'Tuzak kontrolü için görev oluştur', ilaclama: 'Saatleri haritada işaretle', hava_uyarisi: 'Haritada göster', indeks_dususu: 'Zayıf alanı haritada göster', sulama: 'Sulama notu ekle', her_sey_yolunda: 'Günlüğe not ekle' }
const SHORT: Record<string, string> = { ndvi: 'Canlılık', msavi: 'Toprak etkili', ndre: 'Klorofil', ndmi: 'Yaprak suyu', cigreen: 'Yoğunluk' }

/** Brifing: sayfa gibi, ince çizgilerle bölünmüş; kaydırma yok. Yıl çarkı + skor + Bugün + metrik tablosu. */
export function Briefing({ d, s, width = 392, mobile = false }: { d: Proto; s: Saha; width?: number; mobile?: boolean }) {
  const g = d.garden
  const st = d.status
  if (!g || !st) return null
  const ndvi = seriesPts(d, 'ndvi')
  const ndmi = seriesPts(d, 'ndmi')
  const rain = rainWeek(d)
  const spray = bestSpray(d)
  const { rain: rainDaily, bands } = seasonRainGdd(d)
  const why = scoreWhy(d)
  const items = (d.today ?? []).slice(0, 3)
  const dn = change14(ndvi)
  const dw = change14(ndmi)
  const mrow = (label: string, value: string, unit: string, extra: React.ReactNode, spark?: React.ReactNode) => (
    <div className="rule-t" style={{ display: 'grid', gridTemplateColumns: '1fr auto 84px', alignItems: 'center', gap: 10, padding: '7px 0' }}>
      <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{extra}</div></div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.04em', textAlign: 'right' }}>{value}<span className="unit">{unit}</span></div>
      <div style={{ justifySelf: 'end' }}>{spark}</div>
    </div>
  )
  const dlt = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}%${Math.abs(v).toFixed(1).replace('.', ',')} / 14 gün`)
  return (
    <aside aria-label="Brifing" className={mobile ? '' : 'rule-l'} style={{ width: mobile ? '100%' : width, flex: 'none', background: 'var(--paper)', padding: mobile ? '0 16px 16px' : '18px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      <header>
        <Eyebrow>Brifing · {formatDate(s.today)}</Eyebrow>
        <h2 className="serif" style={{ margin: '3px 0 0', fontSize: 30, lineHeight: 1.05 }}>{g.ad}</h2>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>Limon{g.cesit ? ` · ${g.cesit}` : ''} · <span className="mono">{f2(g.alanDekar, 1)}</span> da · {[g.ilce, g.il].filter(Boolean).join(', ')}</div>
      </header>

      <section className="rule-t" style={{ paddingTop: 12, display: 'grid', gridTemplateColumns: '176px 1fr', gap: 12, alignItems: 'center' }}>
        <YearWheel size={176} today={s.today} ndvi={ndvi} rain={rainDaily} stages={bands} center={{ value: String(why.score ?? '—'), unit: '/ 100', note: 'son 12 ay' }} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}><StatusWord status={st.durum} size={17} /></div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.4 }}>{st.ozet}{why.note && <span className="note-n">1</span>}</div>
          <div className="eyebrow" style={{ marginTop: 6 }}>Güven: {st.guven.seviye === 'yuksek' ? 'yüksek' : st.guven.seviye === 'orta' ? 'orta' : 'düşük'}</div>
        </div>
      </section>
      {why.note && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: -6 }}><span className="mono">1</span> {why.note}</div>}

      <section className="rule-t" style={{ paddingTop: 10 }}>
        <Eyebrow>Bugün</Eyebrow>
        <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 9 }}>
          {items.map((it, i) => (
            <li key={it.baslik} style={{ display: 'grid', gridTemplateColumns: '18px 22px 1fr', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', paddingTop: 2 }}>{i + 1}</span>
              <Icon name={GLYPH[it.tur] ?? 'yaprak'} size={20} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 650, lineHeight: 1.25 }}>{it.baslik}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.metin}</div>
                <a style={{ display: 'inline-block', marginTop: 3, fontSize: 12, fontWeight: 650, borderBottom: '1px solid var(--ink)', cursor: 'pointer' }}>{ACTION[it.tur] ?? 'Ayrıntı'} →</a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: 'auto' }}>
        <Eyebrow>Anahtar metrikler</Eyebrow>
        <div style={{ marginTop: 4 }}>
          {mrow('Canlılık', f2(ndvi[ndvi.length - 1]?.value), '', dlt(dn), <Sparkline values={ndvi.slice(-16).map((p) => p.value)} />)}
          {mrow('Yaprak suyu', f2(ndmi[ndmi.length - 1]?.value), '', dlt(dw), <Sparkline values={ndmi.slice(-16).map((p) => p.value)} />)}
          {mrow('Önümüzdeki 7 gün yağış', rain ? f2(rain.mm, 1) : '—', 'mm', rain ? `en yağışlı gün ${f2(Math.max(...rain.days.map((x) => x.mm)), 1)} mm` : '', <svg width={84} height={22}>{rain?.days.map((x, i) => <rect key={x.date} x={i * 12} width={8} y={22 - Math.min(21, x.mm * 2)} height={Math.min(21, x.mm * 2)} fill="#2a78d6" />)}</svg>)}
          {mrow('İlaçlama penceresi', spray ? spray.aralik[0] : '—', spray ? `–${spray.aralik[1]}` : '', spray ? `${spray.gun} · gün doğumu–batımı arası` : 'uygun saat yok')}
        </div>
      </section>

      <nav aria-label="Odak görünümleri" className="rule-t" style={{ paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 650 }}>
        {['Analiz', 'Hava', 'Günlük', 'Rapor', 'Arşiv'].map((n) => <a key={n} style={{ borderBottom: '1px solid var(--ink)', cursor: 'pointer' }}>{n} →</a>)}
      </nav>
      {void stageShortName}
    </aside>
  )
}

/** Zaman dok'u: ince çizgi + fenoloji şeridi; seçili tarih limon işaretçi. */
export function Dock({ d, s, index, onIndex, selected, onSelect, height = 232 }: { d: Proto; s: Saha; index: IndexId; onIndex: (i: IndexId) => void; selected: string | null; onSelect: (x: string) => void; height?: number }) {
  const { rain, bands } = seasonRainGdd(d)
  const line = seriesPts(d, index)
  const sel = line.find((p) => p.date === selected) ?? line[line.length - 1]
  return (
    <section aria-label="Zaman" className="rule-t" style={{ height, flex: 'none', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '8px 16px 0' }}>
        {(['ndvi', 'ndmi', 'ndre', 'msavi'] as IndexId[]).map((id) => <button key={id} className="tab" data-on={id === index} onClick={() => onIndex(id)}>{SHORT[id]}</button>)}
        <span style={{ flex: 1 }} />
        <div className="seg"><button data-on="true">Son 12 ay</button><button>Bu sezon</button><button>Çok yıllık</button></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginLeft: 14 }}>
          <span className="eyebrow">{sel ? formatDate(sel.date) : ''}</span>
          <span className="num-big" style={{ fontSize: 26 }}>{f2(sel?.value)}</span>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: '0 8px' }}>
        <DockChart height={height - 46} range={{ from: shiftDays(s.today, -365), to: s.today }} line={line} stages={bands} rain={rain} netDates={d.scenes.map((x) => x.tarih)} selected={selected} onSelect={onSelect} label={SHORT[index]} />
      </div>
    </section>
  )
}

/** Katman seçici: her indeks için küçük resim (aynı skala) + bir cümle. */
export function LayerPicker({ d, s, active, open }: { d: Proto; s: Saha; active: IndexId; open: boolean }) {
  const [on, setOn] = useState(open)
  return (
    <div style={{ width: on ? 300 : 'auto', minWidth: 190, background: 'var(--paper)', border: '1px solid var(--ink)', whiteSpace: 'nowrap' }}>
      <button onClick={() => setOn(!on)} style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <Icon name="kontur" size={18} />
        <span style={{ fontWeight: 650, fontSize: 13, flex: 1 }}>{SHORT[active]} <span className="eyebrow" style={{ marginLeft: 4 }}>{INDEX_DEFS[active].teknik}</span></span>
        <span className="mono" style={{ fontSize: 10 }}>{on ? '▲' : '▼'}</span>
      </button>
      {on && (['ndvi', 'msavi', 'ndre', 'ndmi', 'cigreen'] as IndexId[]).map((id) => {
        const g = s.layerGrids[id]
        return (
          <div key={id} className="rule-t" style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 10, padding: 8, background: id === active ? 'var(--paper-2)' : undefined }}>
            <div style={{ width: 54 }}>{g ? <GridCanvas ring={ringsOf(d)} grid={g} domain={domainFor(g)} scale={2} marked={id === active} /> : <div style={{ aspectRatio: '1/1.1', background: 'var(--paper-3)' }} />}</div>
            <div><div style={{ fontSize: 12.5, fontWeight: 650 }}>{SHORT[id]} <span className="eyebrow">{INDEX_DEFS[id].teknik}</span></div><div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.3 }}>{INDEX_DEFS[id].kisa}</div></div>
          </div>
        )
      })}
      {void d}
    </div>
  )
}
const domainFor = (g: { values: Float32Array }): [number, number] => {
  const v = Array.from(g.values).filter(Number.isFinite).sort((a, b) => a - b)
  return v.length ? [v[Math.floor(v.length * 0.02)], v[Math.floor(v.length * 0.98)]] : [0, 1]
}

export function CommandBox({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, width: compact ? '100%' : 520, padding: '0 12px', background: 'var(--paper)', border: '1px solid var(--ink)' }}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeLinecap="round"><circle cx={10.5} cy={10.5} r={6.5} /><path d="M15.5 15.5L21 21" /></svg>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink-3)' }}>{compact ? 'Ara veya sor…' : 'Ara veya sor…   “zayıf bölgeleri göster”'}</span>
      {!compact && <kbd className="mono" style={{ fontSize: 11, border: '1px solid var(--ink)', padding: '1px 6px' }}>⌘K</kbd>}
    </div>
  )
}

export function Workspace({ d, s, layerOpen = false, narrow = false }: { d: Proto; s: Saha; layerOpen?: boolean; narrow?: boolean }) {
  const [index, setIndex] = useState<IndexId>('ndvi')
  const [selected, setSelected] = useState<string | null>(d.latest?.tarih ?? null)
  const pins: MapPin[] = useMemo(() => problemPinsSaha(d), [d])
  const [mode, setMode] = useState<'piksel' | 'kontur'>('piksel')
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Rail active="bahceler" />
      {!narrow && <Index d={d} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <SahaMap d={d} grid={s.layerGrids[index] ?? s.latestGrid} domain={s.domain} contours={mode === 'kontur'} weakHatch pins={pins} padding={{ top: 90, bottom: 60, left: 80, right: 70 }} />
          <div style={{ position: 'absolute', top: 28, left: 28, right: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}><CommandBox compact={narrow} /></div>
            <div style={{ pointerEvents: 'auto' }}><LayerPicker d={d} s={s} active={index} open={layerOpen} /></div>
          </div>
          <div style={{ position: 'absolute', left: 28, top: 76, display: 'flex', gap: 6 }}>
            <div className="seg" style={{ background: 'var(--paper)' }}><button data-on={mode === 'piksel'} onClick={() => setMode('piksel')}>Piksel</button><button data-on={mode === 'kontur'} onClick={() => setMode('kontur')}>Kontur</button></div>
            <span className="mono" style={{ background: 'var(--paper)', border: '1px solid var(--ink)', padding: '5px 9px', fontSize: 11 }}>▨ çok yıllık zayıf bölge</span>
          </div>
          <div style={{ position: 'absolute', right: 28, bottom: 30, background: 'var(--paper)', border: '1px solid var(--ink)', padding: '8px 10px' }}><RampLegend domain={s.domain} width={190} /><div className="mono" style={{ fontSize: 10, marginTop: 3 }}>görüntü: {d.latest ? formatDayMonth(d.latest.tarih) : ''} · 10 m piksel</div></div>
        </div>
        <Dock d={d} s={s} index={index} onIndex={setIndex} selected={selected} onSelect={setSelected} />
      </div>
      <Briefing d={d} s={s} width={narrow ? 340 : 392} />
      <HatchHost />
      {void layerImageUrl}
    </div>
  )
}

/** Mobil (375): harita tam ekran; brifing alt sayfa; zaman alt sayfada sekme; alt gezinme. */
export function Mobile({ d, s, sheet }: { d: Proto; s: Saha; sheet: 'peek' | 'ozet' | 'zaman' }) {
  const [selected, setSelected] = useState<string | null>(d.latest?.tarih ?? null)
  const line = seriesPts(d, 'ndvi')
  const { rain, bands } = seasonRainGdd(d)
  const h = sheet === 'peek' ? 196 : 600
  const why = scoreWhy(d)
  const sel = line.find((p) => p.date === selected) ?? line[line.length - 1]
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      <SahaMap d={d} grid={s.latestGrid} domain={s.domain} weakHatch pins={problemPinsSaha(d).slice(0, 1)} padding={{ top: 70, bottom: h + 70, left: 20, right: 20 }} chrome={false} />
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10 }}><CommandBox compact /></div>
      <section style={{ position: 'absolute', zIndex: 4, left: 0, right: 0, bottom: 56, height: h, background: 'var(--paper)', borderTop: '1px solid var(--ink)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ height: 16, display: 'grid', placeItems: 'center' }}><i style={{ width: 36, height: 3, background: 'var(--ink)', display: 'block' }} /></div>
        {sheet === 'peek' ? (
          <div style={{ padding: '2px 16px', display: 'grid', gridTemplateColumns: '84px 1fr', gap: 12, alignItems: 'center' }}>
            <div className="num-big" style={{ fontSize: 52 }}>{why.score ?? '—'}</div>
            <div><div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>{d.garden?.ad}</div><div style={{ marginTop: 3 }}><StatusWord status={d.status?.durum} /> <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {f2(d.garden?.alanDekar, 1)} da</span></div></div>
            {d.today?.[0] && <div className="rule-t" style={{ gridColumn: '1 / -1', paddingTop: 8, display: 'flex', gap: 8, fontSize: 12.5 }}><Icon name={GLYPH[d.today[0].tur] ?? 'yaprak'} size={20} /><div><b>{d.today[0].baslik}</b><div style={{ color: 'var(--ink-2)' }}>{d.today[0].metin.slice(0, 64)}…</div></div></div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
            <div className="rule-b" style={{ display: 'flex', padding: '0 16px' }}>{['Özet', 'Zaman', 'Katman'].map((t) => <button key={t} className="tab" data-on={(sheet === 'ozet' && t === 'Özet') || (sheet === 'zaman' && t === 'Zaman')}>{t}</button>)}</div>
            {sheet === 'ozet' ? <div style={{ overflow: 'hidden' }}><Briefing d={d} s={s} mobile /></div> : (
              <div style={{ padding: '8px 8px 0' }}>
                <div style={{ padding: '0 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}><span className="eyebrow">Canlılık · {sel ? formatDate(sel.date) : ''}</span><span className="num-big" style={{ fontSize: 26 }}>{f2(sel?.value)}</span></div>
                <DockChart height={270} range={{ from: shiftDays(s.today, -365), to: s.today }} line={line} stages={bands} rain={rain} netDates={d.scenes.map((x) => x.tarih)} selected={selected} onSelect={setSelected} label="Canlılık" />
                <div style={{ padding: '10px 8px' }}><RampLegend domain={s.domain} width={260} /></div>
              </div>
            )}
          </div>
        )}
      </section>
      <nav aria-label="Ana gezinme" className="rule-t" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, bottom: 0, height: 56, background: 'var(--paper-2)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {([['Bahçelerim', 'bahce'], ['Asistan', 'asistan'], ['Pazar', 'hasat'], ['Bildirim', 'uyari'], ['Daha', 'defter']] as [string, IconName][]).map(([n, ic], i) => (
          <a key={n} style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1, fontSize: 9.5, fontWeight: 650, color: i === 0 ? 'var(--ink)' : 'var(--ink-3)', borderTop: i === 0 ? '2px solid var(--ink)' : '2px solid transparent' }}><Icon name={ic} size={20} />{n}</a>
        ))}
      </nav>
      <HatchHost />
    </div>
  )
}
