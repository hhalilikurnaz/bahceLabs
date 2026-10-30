import type { PanelYaniti } from '../../../api/sulamaPanelApi'
import { sayi } from '../../../lib/format'

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const RENK_AD = { yesil: 'karşılanıyor', sari: 'dikkat', kirmizi: 'yetersiz' } as const
const RENK_STIL = { yesil: 'var(--color-app-success)', sari: 'var(--color-app-warn)', kirmizi: 'var(--color-app-danger)' } as const

/** 3 KPI: sonraki sulama · ihtiyaç karşılandı (ΣETa/ΣETc, son 7 gün) · sezon suyu. Renk + yazı (renk tek başına değil). Mobilde yatay kaydırılır. */
export function KpiSatiri({ panel }: { panel: PanelYaniti }) {
  const k = panel.kpi
  if (!k) return null
  const s = k.sonraki
  return (
    <div className="flex snap-x gap-2 overflow-x-auto pb-1 max-[560px]:-mx-3 max-[560px]:px-3 min-[561px]:grid min-[561px]:grid-cols-3 [scrollbar-width:none]" data-testid="sulama-kpi" role="list">
      <div role="listitem" className="min-w-[210px] shrink-0 snap-start rounded-md border border-app-border bg-app-card p-3 min-[561px]:min-w-0" data-testid="kpi-sonraki">
        <p className="text-caption text-app-text-muted">Sonraki sulama</p>
        <p className="mt-0.5 text-h2 font-semibold tabular-nums">{s ? `${Number(s.tarih.slice(8, 10))} ${AY[Number(s.tarih.slice(5, 7)) - 1]}` : 'Gerekmiyor'}</p>
        <p className="text-small text-app-text-muted">{s ? `${s.gun_sonra === 0 ? 'bugün' : `${s.gun_sonra} gün sonra`} · ${s.vanalar.join(', ')}` : 'önümüzdeki 10 günde'}</p>
      </div>
      <div role="listitem" className="min-w-[210px] shrink-0 snap-start rounded-md border border-app-border bg-app-card p-3 min-[561px]:min-w-0" data-testid="kpi-ihtiyac" data-renk={k.ihtiyac_renk ?? ''}>
        <p className="text-caption text-app-text-muted">İhtiyaç karşılandı · son 7 gün</p>
        <p className="mt-0.5 text-h2 font-semibold tabular-nums" style={{ color: k.ihtiyac_renk ? RENK_STIL[k.ihtiyac_renk] : undefined }}>{k.ihtiyac_karsilandi_pct == null ? '—' : `%${Math.round(k.ihtiyac_karsilandi_pct)}`}</p>
        <p className="text-small text-app-text-muted">{k.ihtiyac_renk ? RENK_AD[k.ihtiyac_renk] : 'veri yok'} · gerçek tüketim ÷ ihtiyaç</p>
      </div>
      <div role="listitem" className="min-w-[210px] shrink-0 snap-start rounded-md border border-app-border bg-app-card p-3 min-[561px]:min-w-0" data-testid="kpi-sezon">
        <p className="text-caption text-app-text-muted">Sezon suyu</p>
        <p className="mt-0.5 text-h2 font-semibold tabular-nums">{k.sezon_m3 == null ? '—' : `${sayi(k.sezon_m3, 0)} m³`}</p>
        <p className="text-small text-app-text-muted">{k.sezon_hedef_pct == null ? 'sezon tahmini yok' : `sezon tahmininin %${Math.round(k.sezon_hedef_pct)}'i`}{k.sezon_kaynak ? ` · ${k.sezon_kaynak}` : ''}</p>
      </div>
    </div>
  )
}
