import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkline, StaleBadge } from '@/components/chart'
import type { Garden } from '../api/types'
import { useEdinimler } from '../api/edinimApi'
import { useNormalBantlar } from '../api/normalBantApi'
import { dekar } from '../lib/format'
import { KADEME_META, type Kademe } from '../lib/kademe'
import { gardenPath } from '../lib/routes'
import { PRODUCTS } from '../api/types'
import { useKonum } from './useKonum'
const urunAdi = (v: string) => PRODUCTS.find((p) => p.value === v)?.label ?? v

/** Bahçeler listesi satırı: ad · durum · «Normal» (ya da sapma) + küçük gerçek değer · mini çizgi (bahçenin kendi normal bandıyla) · veri yaşı. */
export function BahceSatiri({ garden, tier }: { garden: Garden; tier: Kademe | 'veri_yok' | undefined }) {
  const k = useKonum(garden.id)
  const ed = useEdinimler(garden.id).data
  const bantlar = useNormalBantlar(garden.id).data
  const meta = tier && tier !== 'veri_yok' ? KADEME_META[tier] : null
  const [simdi] = useState(() => Date.now())
  const bas = simdi - 150 * 86_400_000
  const noktalar = (ed?.edinimler ?? []).filter((e) => e.gostergeler.ndvi && Date.parse(e.tarih) >= bas).map((e) => ({ t: Date.parse(e.tarih), v: e.gostergeler.ndvi!.medyan }))
  const bant = Array.from({ length: 31 }, (_, i) => {
    const t = bas + i * 5 * 86_400_000
    const b = bantlar?.gostergeler.ndvi?.find((x) => x.ay === new Date(t).getMonth() + 1)
    return b && b.p25 !== null && b.p75 !== null && b.ceyrek_yeterli ? { t, alt: b.p25, ust: b.p75 } : null
  }).filter((x): x is { t: number; alt: number; ust: number } => x !== null)
  return (
    <li className="rounded-md border border-app-border bg-app-card">
      <Link to={gardenPath(garden.id)} data-testid="bahce-satiri" className="block rounded-md p-4 hover:bg-app-card-hover focus-visible:outline-offset-[-2px]">
        <span className="flex items-center justify-between gap-3">
          <b className="truncate text-h2 font-semibold">{garden.ad}</b>
          <span className="flex shrink-0 items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-small font-semibold" data-testid="bahce-kademe" style={{ color: meta?.renk, background: meta ? 'color-mix(in srgb, currentColor 12%, transparent)' : undefined }}>
            <span aria-hidden>{meta?.isaret ?? '–'}</span>{meta?.ad ?? 'Veri yok'}
          </span>
        </span>
        <span className="mt-0.5 block text-small text-app-text-dim">{[urunAdi(garden.urun), dekar(garden.alanDekar), garden.ilce ?? garden.il].filter(Boolean).join(' · ')}</span>
        <span className="mt-3 flex items-end justify-between gap-3">
          <span className="min-w-0">
            {k.yukleniyor ? <span className="m-skeleton block h-9 w-24 rounded bg-app-card-hover" aria-label="Yükleniyor" /> : k.sayi ? (
              <><span className="block text-[32px] font-semibold leading-none tabular-nums text-app-text" data-testid="liste-konum">{k.sayi.buyuk}</span><span className="mt-1 block text-small text-app-text-muted">{k.sayi.kucuk}</span></>
            ) : <span className="block text-body text-app-text-muted" data-testid="liste-konum-yok">{k.hata ? 'Veri alınamadı' : 'Henüz görüntü yok'}</span>}
          </span>
          {noktalar.length > 1 && <Sparkline noktalar={noktalar} bant={bant} ad={`${garden.ad}: son 150 gün canlılık, normal aralıkla`} />}
        </span>
        {k.yasGun !== null && <span className="mt-2 block"><StaleBadge kaynak="Sentinel-2" gun={k.yasGun} /></span>}
      </Link>
    </li>
  )
}
