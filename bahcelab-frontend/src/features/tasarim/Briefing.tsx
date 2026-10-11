import { ArrowUpRight, X } from 'lucide-react'
import type { Proto } from './data'
import { bestSpray, cappedScore, change14, indexSeries, rainWeek, scoreRange } from './derive'
import { Delta, Glyph, ScoreRing, Section, Spark, fmt, type Yon } from './parts'

const GLYPH_FOR: Record<string, string> = { zararli_riski: 'tuzak', ilaclama: 'ilac', hava_uyarisi: 'don', indeks_dususu: 'yaprak', sulama: 'damla', her_sey_yolunda: 'yaprak' }

function Metric({ label, value, unit, delta, spark, children }: { label: string; value: string; unit?: string; delta?: number | null; spark?: number[]; children?: React.ReactNode }) {
  return (
    <div className="raised" style={{ padding: '10px 12px', display: 'grid', gap: 4, minWidth: 0 }}>
      <span className="label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="num" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--kc-ink2)' }}>{unit}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 26 }}>
        {delta !== undefined ? <Delta value={delta} /> : <span />}
        {spark && <Spark values={spark} width={64} height={22} />}
        {children}
      </div>
    </div>
  )
}

/** Brifing: dar, yoğun, tek ekrana sığar. Başlık · skor halkası · Bugün (≤3 eylemli) · 4 anahtar metrik · odak görünümü bağlantıları. */
export function Briefing({ d, yon, width = 408, mobile = false }: { d: Proto; yon: Yon; width?: number; mobile?: boolean }) {
  const g = d.garden
  const st = d.status
  if (!g || !st) return null
  const ndvi = indexSeries(d, 'ndvi')
  const ndmi = indexSeries(d, 'ndmi')
  const rain = rainWeek(d)
  const spray = bestSpray(d)
  const range = scoreRange(d)
  const score = cappedScore(d)
  const items = (d.today ?? []).slice(0, 3)
  return (
    <aside aria-label="Brifing" style={{ width: mobile ? '100%' : width, flex: 'none', background: 'var(--kc-s1)', borderLeft: mobile ? 'none' : '1px solid var(--kc-line)', display: 'flex', flexDirection: 'column', gap: 14, padding: mobile ? '4px 16px 16px' : '16px 16px 14px', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title" style={{ margin: 0, fontSize: 24, lineHeight: 1.1 }}>{g.ad}</h2>
          <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--kc-ink2)' }}>
            Limon{g.cesit ? ` · ${g.cesit}` : ''} · <span className="num">{fmt(g.alanDekar, 1)}</span> da · {[g.ilce, g.il].filter(Boolean).join(', ')}
          </div>
        </div>
        {!mobile && <button aria-label="Kapat" style={{ all: 'unset', cursor: 'pointer', color: 'var(--kc-ink3)', padding: 4 }}><X size={18} /></button>}
      </header>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <ScoreRing score={score} status={st.durum} size={92} yon={yon} range={range} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{st.etiket}</div>
          <div style={{ fontSize: 12.5, color: 'var(--kc-ink2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{st.ozet}</div>
          <div className="label" style={{ marginTop: 5 }}>Güven: {st.guven.seviye === 'yuksek' ? 'yüksek' : st.guven.seviye === 'orta' ? 'orta' : 'düşük'}</div>
        </div>
      </div>

      <Section label="Bugün">
        <div style={{ display: 'grid', gap: 7 }}>
          {items.map((it) => (
            <div key={it.baslik} className="raised" style={{ padding: '9px 10px', display: 'flex', gap: 10 }}>
              <div style={{ color: it.oncelik === 'bilgi' ? 'var(--kc-ink2)' : 'var(--kc-warn)', paddingTop: 1 }}><Glyph name={GLYPH_FOR[it.tur] ?? 'yaprak'} size={20} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{it.baslik}</div>
                <div style={{ fontSize: 12, color: 'var(--kc-ink2)', lineHeight: 1.35, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.metin}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                  <button className="primary" style={{ height: 26, fontSize: 11.5 }}>Haritada göster</button>
                  <button className="ghost" style={{ height: 26, fontSize: 11.5 }}>Görev oluştur</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Anahtar metrikler">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <Metric label="Canlılık" value={fmt(ndvi[ndvi.length - 1]?.value ?? null, 2)} delta={change14(ndvi)} spark={ndvi.slice(-14).map((p) => p.value)} />
          <Metric label="Yaprak suyu" value={fmt(ndmi[ndmi.length - 1]?.value ?? null, 2)} delta={change14(ndmi)} spark={ndmi.slice(-14).map((p) => p.value)} />
          <Metric label="7 gün yağış" value={rain ? fmt(rain.mm, 1) : '—'} unit="mm">
            <svg width={64} height={22} aria-hidden>{rain?.days.map((r, i) => <rect key={r.date} x={i * 9.4} width={6.4} y={22 - Math.min(22, r.mm * 2.5)} height={Math.min(22, r.mm * 2.5)} fill="var(--kc-water)" />)}</svg>
          </Metric>
          <Metric label="İlaçlama penceresi" value={spray ? spray.aralik[0] : '—'} unit={spray ? `${spray.gun}` : ''}>
            <span className="num" style={{ fontSize: 11.5, color: 'var(--kc-ink2)' }}>{spray ? `→ ${spray.aralik[1]}` : 'uygun saat yok'}</span>
          </Metric>
        </div>
      </Section>

      <nav aria-label="Odak görünümleri" style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(5, auto)', gap: 6 }}>
        {['Analiz', 'Hava', 'Günlük', 'Rapor', 'Arşiv'].map((n) => (
          <a key={n} className="ghost" style={{ height: 34, justifyContent: 'center', padding: '0 6px', textDecoration: 'none' }}>{n}<ArrowUpRight size={12} /></a>
        ))}
      </nav>
    </aside>
  )
}
