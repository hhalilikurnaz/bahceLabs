import { gunAy } from '../../lib/format'
import type { GardenStatus } from '../../api/agroApi'

const GUVEN = { yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' } as const

/** «Nasıl hesaplandı?»: veri, tarih, güven ve kademeyi hangi bileşenin düşürdüğü. Sayı yok; kural «ön değer · v1». */
export function NasilHesaplandi({ nasil }: { nasil: GardenStatus['nasil'] }) {
  return (
    <details className="group rounded-md border border-app-border bg-app-card" data-testid="nasil-hesaplandi">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[13px] font-semibold">
        Nasıl hesaplandı?
        <span aria-hidden className="text-app-text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-2.5 border-t border-app-border px-3.5 py-3 text-[13px] leading-snug">
        <p data-testid="kademe-nedeni" className="font-medium text-app-text">{nasil.kademeNedeni}</p>
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-app-text-muted">
          <dt>Veri</dt>
          <dd>{nasil.veri.join(' · ')}</dd>
          <dt>Tarih</dt>
          <dd className="num">{nasil.sonGoruntuTarihi ? `son net görüntü ${gunAy(nasil.sonGoruntuTarihi, 'always')}` : 'net görüntü yok'}</dd>
          <dt>Güven</dt>
          <dd>{GUVEN[nasil.guven.seviye]} — {nasil.guven.aciklama}</dd>
          <dt>Eşikler</dt>
          <dd><span className="rounded-[2px] border border-app-border px-1.5 py-0.5 text-[11px] font-medium">{nasil.esikDurumu}</span> · mühendis onayı bekliyor</dd>
        </dl>
        <p className="text-[12px] text-app-text-dim">{nasil.formulNotu}</p>
      </div>
    </details>
  )
}
