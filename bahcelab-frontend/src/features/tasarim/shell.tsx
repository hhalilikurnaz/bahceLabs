import { Bell, Briefcase, ChevronDown, Command, Layers, Search, Settings, Sparkles, Store, Trees, Wrench } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { layerImageUrl } from '../bahcem/api/indeksApi'
import { INDEX_DEFS, INDEX_IDS, type IndexId } from '../bahcem/lib/indices'
import type { Proto } from './data'
import { ScoreRing, Spark, type Yon } from './parts'

const RAIL: { key: string; label: string; icon: typeof Trees }[] = [
  { key: 'bahceler', label: 'Bahçelerim', icon: Trees },
  { key: 'asistan', label: 'Asistan', icon: Sparkles },
  { key: 'islerim', label: 'İşlerim', icon: Briefcase },
  { key: 'hizmetler', label: 'Hizmetler', icon: Wrench },
  { key: 'pazar', label: 'Pazar', icon: Store },
  { key: 'bildirimler', label: 'Bildirimler', icon: Bell },
]

/** Sol ray: koyu yüzey, 56 px. Copilot düğmesi yoktur; Asistan ray'dadır. */
export function Rail({ active, yon, unread = 2 }: { active: string; yon: Yon; unread?: number }) {
  return (
    <nav aria-label="Ana gezinme" style={{ width: 56, background: 'var(--kc-s1)', borderRight: '1px solid var(--kc-line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4, flex: 'none' }}>
      <div style={{ width: 30, height: 30, marginBottom: 14, borderRadius: yon === 'gece' ? 9 : 3, background: 'var(--kc-lemon)', display: 'grid', placeItems: 'center', color: 'var(--kc-on-lemon)', fontWeight: 800, fontSize: 15 }} aria-label="BahçeLab">B</div>
      {RAIL.map((r) => {
        const on = r.key === active
        const Icon = r.icon
        return (
          <a key={r.key} aria-label={r.label} title={r.label} style={{ position: 'relative', width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: yon === 'gece' ? 11 : 3, color: on ? 'var(--kc-ink)' : 'var(--kc-ink3)', background: on ? 'var(--kc-s3)' : 'transparent', cursor: 'pointer' }}>
            {on && <span style={{ position: 'absolute', left: -8, top: 10, bottom: 10, width: 3, borderRadius: 2, background: 'var(--kc-lemon)' }} />}
            <Icon size={20} strokeWidth={1.7} />
            {r.key === 'bildirimler' && unread > 0 && <span className="num" style={{ position: 'absolute', right: 2, top: 2, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--kc-bad)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{unread}</span>}
          </a>
        )
      })}
      <div style={{ flex: 1 }} />
      <a aria-label="Ayarlar" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'var(--kc-ink3)' }}><Settings size={20} strokeWidth={1.7} /></a>
    </nav>
  )
}

/** Birleşik çubuk: konum + bahçe ara + Asistan'a komut. */
export function CommandBar({ yon, compact }: { yon: Yon; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 42, width: compact ? '100%' : 560, maxWidth: '100%', padding: '0 12px', background: 'rgb(12 18 15 / 0.88)', backdropFilter: 'blur(8px)', border: '1px solid var(--kc-line2)', borderRadius: yon === 'gece' ? 12 : 4, color: 'var(--kc-ink2)' }}>
      <Search size={16} />
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--kc-ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{compact ? 'Ara veya sor…' : 'Ara veya sor…  “zayıf bölgeleri göster”'}</span>
      {!compact && <kbd className="num" style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--kc-line2)', display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--kc-ink3)' }}><Command size={11} />K</kbd>}
    </div>
  )
}

/** Görsel katman seçici: her indeks için küçük resim önizleme + bir cümle anlam. */
export function LayerPicker({ d, active, open, onPick }: { d: Proto; active: IndexId; open: boolean; onPick?: (id: IndexId) => void }) {
  const [isOpen, setOpen] = useState(open)
  const def = INDEX_DEFS[active]
  return (
    <div style={{ width: isOpen ? 300 : 'auto', background: 'rgb(12 18 15 / 0.92)', backdropFilter: 'blur(8px)', border: '1px solid var(--kc-line2)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!isOpen)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', height: 42, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', color: 'var(--kc-ink)' }}>
        <Layers size={16} />
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{def.ad} <span className="label" style={{ marginLeft: 4 }}>{def.teknik}</span></span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} />
      </button>
      {isOpen &&
        INDEX_IDS.map((id) => {
          const v = INDEX_DEFS[id]
          const on = id === active
          return (
            <div key={id} onClick={() => onPick?.(id)} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderTop: '1px solid var(--kc-line)', background: on ? 'var(--kc-s2)' : 'transparent', cursor: 'pointer', alignItems: 'center' }}>
              <div style={{ width: 52, height: 40, borderRadius: 6, overflow: 'hidden', background: '#10170f', flex: 'none', border: on ? '2px solid var(--kc-lemon)' : '1px solid var(--kc-line2)' }}>
                {d.latest?.indeksler[id]?.pngVar && <img alt="" src={layerImageUrl(d.id!, d.latest, id)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{v.ad} <span className="label">{v.teknik}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--kc-ink2)', lineHeight: 1.3 }}>{v.kisa}</div>
              </div>
            </div>
          )
        })}
    </div>
  )
}

/** Daraltılmış bahçe listesi: küçük resim + skor halkası; seçili olan limon çizgisiyle işaretlenir. */
export function GardenStrip({ d, yon }: { d: Proto; yon: Yon }) {
  return (
    <aside aria-label="Bahçelerim" style={{ width: 76, background: 'var(--kc-s1)', borderRight: '1px solid var(--kc-line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0', flex: 'none' }}>
      {d.overview?.bahceler.map((g) => {
        const on = g.id === d.id
        return (
          <div key={g.id} title={g.ad} style={{ position: 'relative', width: 54, display: 'grid', justifyItems: 'center', gap: 4 }}>
            {on && <span style={{ position: 'absolute', left: -11, top: 8, bottom: 8, width: 3, borderRadius: 2, background: 'var(--kc-lemon)' }} />}
            <div style={{ width: 48, height: 48, borderRadius: yon === 'gece' ? 12 : 3, overflow: 'hidden', background: '#10170f', border: `1px solid ${on ? 'var(--kc-ink2)' : 'var(--kc-line2)'}` }}>
              {g.sonGoruntu && <img alt="" src={g.sonGoruntu.kucukResimUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </div>
            <span className="num" style={{ fontSize: 11, fontWeight: 800, color: g.durum === 'iyi' ? 'var(--kc-ok)' : g.durum === 'izle' ? 'var(--kc-warn)' : 'var(--kc-bad)' }}>{g.skor ?? '—'}</span>
          </div>
        )
      })}
    </aside>
  )
}

/** Açılmış liste kartı (flyout): küçük resim, ad, skor halkası, sparkline, tek satır durum. */
export function GardenListFlyout({ d, yon }: { d: Proto; yon: Yon }) {
  return (
    <div style={{ width: 316, background: 'var(--kc-s1)', border: '1px solid var(--kc-line2)', borderRadius: 'var(--kc-r)', padding: 10, display: 'grid', gap: 8, boxShadow: '0 12px 40px rgb(0 0 0 / 0.5)' }}>
      <div className="label" style={{ padding: '4px 4px 0' }}>Bahçelerim · {d.overview?.toplamlar.bahceSayisi} · {d.overview?.toplamlar.toplamDekar.toFixed(0)} da</div>
      {d.overview?.bahceler.map((g) => (
        <div key={g.id} className="raised" style={{ display: 'flex', gap: 10, padding: 8, alignItems: 'center', borderColor: g.id === d.id ? 'var(--kc-ink3)' : undefined }}>
          <div style={{ width: 52, height: 52, borderRadius: 'var(--kc-r-sm)', overflow: 'hidden', background: '#10170f', flex: 'none' }}>
            {g.sonGoruntu && <img alt="" src={g.sonGoruntu.kucukResimUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title" style={{ fontSize: 15 }}>{g.ad}</div>
            <div style={{ fontSize: 11.5, color: 'var(--kc-ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.durumNedeni ?? ({ iyi: 'İyi', izle: 'İzle', dikkat: 'Dikkat', veri_yok: 'Veri yok' } as Record<string, string>)[g.durum]}</div>
            <Spark values={g.seri.map((s) => s.deger)} width={110} height={18} />
          </div>
          <ScoreRing score={g.skor} status={g.durum} size={46} yon={yon} />
        </div>
      ))}
    </div>
  )
}

export function MapChrome({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div>
}
