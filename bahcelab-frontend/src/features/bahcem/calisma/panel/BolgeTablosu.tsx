import { dekar } from '../../lib/format'
import { ZONE_SHADES } from '../../lib/paletler'
import type { MultiyearZone } from '../../api/multiyearApi'

/** Bahçe ortalamasına göre fark: yuvarlanınca sıfır olan değer «−0%» yazılmaz. */
const farkMetni = (v: number | null): string => {
  if (v === null) return '—'
  const r = Math.round(v)
  return r === 0 ? '0%' : `${r > 0 ? '+' : '−'}${Math.abs(r)}%`
}

const ISTIKRAR = { yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' } as const

/** Bölge örneği: aynı tonun 3 derecesi; zayıf bölge ayrıca taramalı (renk körlüğü ve baskı için). */
function Ornek({ sinif }: { sinif: number }) {
  const hatch = sinif === 1 ? 'repeating-linear-gradient(45deg, rgba(23,32,27,.55) 0 1.5px, transparent 1.5px 5px)' : undefined
  return <span aria-hidden className="block h-4 w-6 shrink-0 rounded-[2px] border border-black/15" style={{ background: hatch ? `${hatch}, ${ZONE_SHADES[sinif]}` : ZONE_SHADES[sinif] }} />
}

/** Bölge tablosu: ad · alan · pay · bahçe ortalamasına göre fark · istikrar; zayıf ve istikrarlı bölgede «yerinde kontrol edin». */
export function BolgeTablosu({ ozet }: { ozet: MultiyearZone[] }) {
  const rows = [...ozet].sort((a, b) => b.sinif - a.sinif)
  return (
    <div className="overflow-x-auto rounded-md border border-app-border bg-app-card" data-testid="bolge-tablosu">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <caption className="sr-only">Çok yıllık ağaç gücü bölgeleri</caption>
        <thead className="text-[11px] uppercase tracking-[.06em] text-app-text-dim">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Bölge</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Alan</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Pay</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Ortalamaya göre</th>
            <th scope="col" className="px-3 py-2 font-semibold">İstikrar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((z) => (
            <tr key={z.sinif} className="border-t border-app-border" data-testid="bolge-satiri" data-sinif={z.sinif}>
              <th scope="row" className="px-3 py-2.5 font-semibold">
                <span className="flex items-center gap-2.5"><Ornek sinif={z.sinif} />{z.ad}</span>
                {z.kontrol_onerisi && <span className="mt-1 block text-[11.5px] font-medium text-app-warn">yerinde kontrol edin</span>}
              </th>
              <td className="num px-2 py-2.5 text-right">{dekar(z.alan_dekar)}</td>
              <td className="num px-2 py-2.5 text-right">%{Math.round(z.pay * 100)}</td>
              <td className="num px-2 py-2.5 text-right">{farkMetni(z.fark_yuzde)}</td>
              <td className="px-3 py-2.5">{z.istikrar_sinifi ? ISTIKRAR[z.istikrar_sinifi] : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
