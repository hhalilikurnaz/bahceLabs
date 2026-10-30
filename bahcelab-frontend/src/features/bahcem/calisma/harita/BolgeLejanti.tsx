import { useMultiyear } from '../../api/multiyearApi'
import { ZONE_LABEL, ZONE_SHADES } from '../../lib/paletler'

const HATCH = 'repeating-linear-gradient(45deg, rgba(23,32,27,.55) 0 1.5px, transparent 1.5px 5px)'

/** Bölgeler katmanının lejantı: üç derece (zayıf taramalı) ve kaynak/yıl aralığı; «ön değer» etiketiyle. */
export function BolgeLejanti({ gardenId }: { gardenId: string }) {
  const data = useMultiyear(gardenId).data
  if (!data || data.durum !== 'hazir') return null
  return (
    <div className="glass w-[286px] max-w-full px-3.5 pb-2.5 pt-3" data-testid="bolge-lejanti">
      <div className="text-small font-bold leading-tight">Bölgeler{data.yil_araligi ? ` · ${data.yil_araligi}` : ''}</div>
      <ul className="mt-2 flex gap-4 text-[12px]">
        {[1, 2, 3].map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden className="block h-3.5 w-5 rounded-[2px] border border-black/15" style={{ background: k === 1 ? `${HATCH}, ${ZONE_SHADES[k]}` : ZONE_SHADES[k] }} />
            {ZONE_LABEL[k]}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-caption leading-snug text-app-text-muted">Yıllardır güçlü ya da zayıf kalan kesimler · ön değer · mühendis onayı bekliyor</p>
    </div>
  )
}
