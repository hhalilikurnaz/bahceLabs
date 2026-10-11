import { GripHorizontal } from 'lucide-react'
import { useState } from 'react'
import { INDEX_DEFS, INDEX_IDS, type IndexId } from '../bahcem/lib/indices'
import { formatDate } from '../bahcem/lib/dates'
import type { Proto } from './data'
import { indexSeries, rangeLast12, seasonRainGdd } from './derive'
import { fmt } from './parts'
import { TimeChart } from './TimeChart'

const SHORT: Record<string, string> = { ndvi: 'Canlılık', msavi: 'Toprak etkili', ndre: 'Klorofil', ndmi: 'Yaprak suyu', cigreen: 'Yoğunluk' }

/** Zaman dok'u: haritanın altında, tüm genişlikte; yüksekliği sürüklenebilir (kapalı / kompakt / geniş). */
export function Dock({ d, index, onIndex, selected, onSelect, height = 232 }: { d: Proto; index: IndexId; onIndex?: (i: IndexId) => void; selected: string | null; onSelect: (date: string) => void; height?: number }) {
  const [period, setPeriod] = useState<'12' | 'sezon' | 'cok'>('12')
  const series = indexSeries(d, index)
  const { rain, gdd, bands } = seasonRainGdd(d)
  const range = rangeLast12()
  const def = INDEX_DEFS[index]
  const sel = series.find((p) => p.date === selected) ?? series[series.length - 1]
  const values = series.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max(0.03, (hi - lo) * 0.18)
  const domain: [number, number] = [Math.floor((lo - pad) * 50) / 50, Math.ceil((hi + pad) * 50) / 50]  // eksen veriyi asla kesmez
  return (
    <section aria-label="Zaman" style={{ background: 'var(--kc-s1)', borderTop: '1px solid var(--kc-line)', height, flex: 'none', display: 'flex', flexDirection: 'column' }}>
      <div title="Yüksekliği sürükleyin" style={{ height: 14, display: 'grid', placeItems: 'center', color: 'var(--kc-ink3)', cursor: 'ns-resize', marginTop: -1 }}><GripHorizontal size={16} /></div>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 16px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {INDEX_IDS.slice(0, 4).map((id) => (
            <button key={id} className="chip" data-on={id === index} onClick={() => onIndex?.(id)}>{SHORT[id]}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {([['12', 'Son 12 ay'], ['sezon', 'Bu sezon'], ['cok', 'Çok yıllık']] as const).map(([k, l]) => (
            <button key={k} className="chip" data-on={period === k} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 10, borderLeft: '1px solid var(--kc-line)' }}>
          <span className="label">{sel ? formatDate(sel.date) : ''}</span>
          <span className="num title" style={{ fontSize: 22, fontWeight: 700 }}>{fmt(sel?.value ?? null, 2)}</span>
        </div>
      </header>
      <div style={{ flex: 1, padding: '2px 8px 0 8px', minHeight: 0 }}>
        <TimeChart
          height={height - 62}
          range={range}
          domain={domain}
          line={series}
          prev={[]}
          bands={bands}
          rain={rain}
          gdd={gdd}
          netDates={d.scenes.map((s) => s.tarih)}
          selected={selected}
          onSelect={onSelect}
          unitLabel={def.ad}
        />
      </div>
    </section>
  )
}
