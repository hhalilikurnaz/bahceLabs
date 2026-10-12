import { Bell, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Proto } from '../data'
import { cappedScore } from '../derive'
import { Icon, Logo, type IconName } from './assets'
import { f2, type Pt } from './charts'
import { INDEX_CSS, statusOf } from './palette'

export function Sparkline({ values, width = 84, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)] as const)
  return (
    <svg width={width} height={height} aria-hidden style={{ display: 'block' }}>
      <path d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')} fill="none" stroke="var(--ink)" strokeWidth={1.1} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill="var(--ink)" />
    </svg>
  )
}

export function StatusWord({ status, size = 13 }: { status: string | undefined; size?: number }) {
  const s = statusOf(status)
  return <span style={{ color: s.color, fontWeight: 700, fontSize: size, whiteSpace: 'nowrap' }}><span aria-hidden>{s.mark}</span> {s.label}</span>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

/** Şekil başlığı: «Şekil 3 · …» + sade başlık. */
export function Fig({ n, title, note, right }: { n: number | string; title: string; note?: ReactNode; right?: ReactNode }) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <div>
        <div className="eyebrow">Şekil {n}</div>
        <h3 className="serif" style={{ margin: '2px 0 0', fontSize: 21, lineHeight: 1.15 }}>{title}</h3>
        {note && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, maxWidth: 560 }}>{note}</div>}
      </div>
      {right}
    </header>
  )
}

export function RampLegend({ domain, caption = 'bahçenin kendi farkları · tüm haritalarda aynı skala', width = 200 }: { domain: [number, number]; caption?: string; width?: number }) {
  return (
    <div style={{ width }}>
      <div style={{ height: 8, background: INDEX_CSS, border: '1px solid var(--ink)' }} />
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}><span>{f2(domain[0])}</span><span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>zayıf → güçlü</span><span>{f2(domain[1])}</span></div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{caption}</div>
    </div>
  )
}

const RAIL: { key: string; label: string; icon: IconName }[] = [
  { key: 'bahceler', label: 'Bahçelerim', icon: 'bahce' },
  { key: 'asistan', label: 'Asistan', icon: 'asistan' },
  { key: 'islerim', label: 'İşlerim', icon: 'defter' },
  { key: 'hizmetler', label: 'Hizmetler', icon: 'budama' },
  { key: 'pazar', label: 'Pazar', icon: 'hasat' },
]
export function Rail({ active }: { active: string }) {
  return (
    <nav aria-label="Ana gezinme" className="rule-r" style={{ width: 60, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 2, flex: 'none' }}>
      <div style={{ marginBottom: 14 }}><Logo /></div>
      {RAIL.map((r) => (
        <a key={r.key} title={r.label} aria-label={r.label} style={{ position: 'relative', width: 48, padding: '7px 0 5px', display: 'grid', justifyItems: 'center', gap: 2, color: r.key === active ? 'var(--ink)' : 'var(--ink-3)' }}>
          {r.key === active && <span style={{ position: 'absolute', left: -6, top: 6, bottom: 6, width: 2, background: 'var(--ink)' }} />}
          <Icon name={r.icon} size={22} />
          <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '.04em' }}>{r.label}</span>
        </a>
      ))}
      <a title="Bildirimler" style={{ position: 'relative', width: 48, padding: '7px 0 5px', display: 'grid', justifyItems: 'center', gap: 2, color: 'var(--ink-3)' }}>
        <Bell size={21} strokeWidth={1.5} /><span style={{ fontSize: 8.5, fontWeight: 600 }}>Bildirim</span>
        <span className="mono" style={{ position: 'absolute', right: 6, top: 4, fontSize: 9.5, fontWeight: 700, background: 'var(--ink)', color: 'var(--paper)', padding: '0 4px' }}>2</span>
      </a>
      <div style={{ flex: 1 }} />
      <a title="Ayarlar" style={{ color: 'var(--ink-3)', padding: 10 }}><Settings size={20} strokeWidth={1.5} /></a>
    </nav>
  )
}

/** Bahçe dizini: içindekiler tablosu gibi; ad (serif), skor (mono), durum işareti. */
export function Index({ d, width = 196 }: { d: Proto; width?: number }) {
  return (
    <aside aria-label="Bahçelerim" className="rule-r" style={{ width, flex: 'none', padding: '16px 14px', background: 'var(--paper)' }}>
      <Eyebrow>Bahçelerim · {d.overview?.toplamlar.bahceSayisi}</Eyebrow>
      <div style={{ marginTop: 10 }}>
        {d.overview?.bahceler.map((g) => (
          <div key={g.id} className="rule-t" style={{ padding: '9px 0', position: 'relative', background: g.id === d.id ? 'var(--paper-2)' : undefined }}>
            {g.id === d.id && <span style={{ position: 'absolute', left: -14, top: 0, bottom: 0, width: 3, background: 'var(--ink)' }} />}
            <div className="serif" style={{ fontSize: 16, lineHeight: 1.1 }}>{g.ad}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{g.dekar.toFixed(1).replace('.', ',')} da</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}><span className="mono" style={{ fontWeight: 600 }}>{g.skor ?? '—'}</span><StatusWord status={g.durum} size={10} /></span>
            </div>
          </div>
        ))}
      </div>
      <button className="btn quiet" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>+ Bahçe ekle</button>
    </aside>
  )
}

export function scoreWhy(d: Proto): { score: number | null; note: string | null } {
  const raw = d.status?.skor ?? null
  const score = cappedScore(d)
  if (raw == null || score == null) return { score, note: null }
  const risky = (d.risks?.riskler ?? []).filter((r) => r.veriYeterli && r.seviye !== 'dusuk').map((r) => r.kisa.replace(' riski', '').replace(' enfeksiyon', '').toLowerCase())
  const comps = d.status?.bilesenler ?? []
  const all100 = comps.length > 0 && comps.every((c) => (c.puan ?? 100) >= 100)
  if (score < raw || (all100 && score < 100)) return { score, note: `${all100 ? 'Dört bileşen de 100/100. ' : ''}Skor ${score} ile sınırlı: aktif risk var (${risky.join(', ') || 'zararlı/hastalık'}).` }
  return { score, note: null }
}

export function seriesPts(d: Proto, id: 'ndvi' | 'ndmi' | 'ndre' | 'msavi' | 'cigreen'): Pt[] {
  return d.scenes.flatMap((s) => (s.indeksler[id] ? [{ date: s.tarih, value: s.indeksler[id]!.ortalama }] : []))
}
