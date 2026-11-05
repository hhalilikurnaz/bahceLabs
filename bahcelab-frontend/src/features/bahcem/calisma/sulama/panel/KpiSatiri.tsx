import type { PanelYaniti } from '../../../api/sulamaPanelApi'
import { sayi } from '../../../lib/format'

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const RENK_AD = { yesil: 'karşılanıyor', sari: 'dikkat', kirmizi: 'yetersiz' } as const
const RENK_STIL = { yesil: 'var(--color-app-success)', sari: 'var(--color-app-warn)', kirmizi: 'var(--color-app-danger)' } as const

/** 3 KPI (prototip): sonraki sulama · ihtiyaç karşılandı (ΣETa/ΣETc, son 7 gün; çubuk) · sezon suyu (çubuk). Renk + yazı. Mobilde yatay kaydırılır. */
export function KpiSatiri({ panel }: { panel: PanelYaniti }) {
  const k = panel.kpi
  if (!k) return null
  const s = k.sonraki
  const uyg = k.sezon_uygulanan_m3
  const plan = k.sezon_plan_m3
  return (
    <div className="flex snap-x gap-2 overflow-x-auto pb-1 max-[560px]:-mx-3 max-[560px]:px-3 min-[561px]:grid min-[561px]:grid-cols-3 [scrollbar-width:none]" data-testid="sulama-kpi" role="list">
      <div role="listitem" className="min-w-[210px] shrink-0 snap-start rounded-md border border-app-border bg-app-card p-3 min-[561px]:min-w-0" data-testid="kpi-sonraki">
        <p className="text-caption text-app-text-muted">Sonraki sulama</p>
        <p className="mt-0.5 text-h2 font-semibold tabular-nums">{s ? (s.gun_sonra === 0 ? 'Bugün' : `${Number(s.tarih.slice(8, 10))} ${AY[Number(s.tarih.slice(5, 7)) - 1]}`) : 'Gerekmiyor'}</p>
        <p className="text-small text-app-text-muted">{s ? `${s.gun_sonra === 0 ? panel.vardiya?.kalemler[0]?.baslangic ? `${panel.vardiya.kalemler[0].baslangic}'te başlar` : 'bugün' : `${s.gun_sonra} gün sonra`} · ${s.vanalar.join(', ')}` : `önümüzdeki ${panel.ufuk_gun} günde`}</p>
      </div>
      <div role="listitem" className="min-w-[210px] shrink-0 snap-start rounded-md border border-app-border bg-app-card p-3 min-[561px]:min-w-0" data-testid="kpi-ihtiyac" data-renk={k.ihtiyac_renk ?? ''}>
        <p className="text-caption text-app-text-muted">İhtiyaç karşılandı</p>
        <p className="mt-0.5 text-h2 font-semibold tabular-nums" style={{ color: k.ihtiyac_renk ? RENK_STIL[k.ihtiyac_renk] : undefined }}>{k.ihtiyac_karsilandi_pct == null ? '—' : `%${Math.round(k.ihtiyac_karsilandi_pct)}`}</p>
        <p className="text-small text-app-text-muted">son 7 gün · {k.ihtiyac_renk ? RENK_AD[k.ihtiyac_renk] : 'veri yok'}</p>
        <div className="mt-1.5 h-1 rounded-full bg-app-border" aria-hidden><div className="h-1 rounded-full" style={{ width: `${Math.min(100, k.ihtiyac_karsilandi_pct ?? 0)}%`, background: k.ihtiyac_renk ? RENK_STIL[k.ihtiyac_renk] : 'var(--color-app-border-strong)' }} /></div>
      </div>
      <div role="listitem" className="min-w-[210px] shrink-0 snap-start rounded-md border border-app-border bg-app-card p-3 min-[561px]:min-w-0" data-testid="kpi-sezon">
        <p className="text-caption text-app-text-muted">Sezon suyu</p>
        <p className="mt-0.5 text-h2 font-semibold tabular-nums">{(uyg ?? plan) == null ? '—' : `${sayi((uyg ?? plan) as number, 0)} m³`}</p>
        <p className="text-small text-app-text-muted" data-testid="kpi-sezon-alt">{uyg != null ? `Uygulanan · plan ${plan == null ? '—' : `${sayi(plan, 0)} m³`}` : `Plan · uygulanan: kayıt yok`}{k.sezon_hedef_pct != null ? ` · %${Math.round(k.sezon_hedef_pct)} tahmin` : ''}</p>
        <div className="mt-1.5 h-1 rounded-full bg-app-border" aria-hidden><div className="h-1 rounded-full" style={{ width: `${Math.min(100, k.sezon_hedef_pct ?? 0)}%`, background: 'var(--color-app-water)' }} /></div>
      </div>
    </div>
  )
}
