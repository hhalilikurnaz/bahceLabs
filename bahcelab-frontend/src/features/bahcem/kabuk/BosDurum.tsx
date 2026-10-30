import type { ReactNode } from 'react'
import { IllAgac, IllCicek, IllKesit, IllLimonDali, IllYaprak } from '../varliklar/varliklar'

const GRAVUR = { dal: IllLimonDali, cicek: IllCicek, kesit: IllKesit, agac: IllAgac, yaprak: IllYaprak } as const
export type Gravur = keyof typeof GRAVUR

/** Tasarlanmış boş durum: özgün gravür + tek cümle fayda + adım rozeti. Gravürler YALNIZ burada kullanılır. */
export function BosDurum({ gravur, baslik, fayda, adim, children, testId }: { gravur: Gravur; baslik: string; fayda: string; adim?: string; children?: ReactNode; testId?: string }) {
  const G = GRAVUR[gravur]
  return (
    <section className="mx-auto grid max-w-[640px] grid-cols-[auto_minmax(0,1fr)] items-center gap-6 px-6 py-10 max-[560px]:grid-cols-1 max-[560px]:justify-items-center max-[560px]:text-center" data-testid={testId}>
      <div className="text-app-text opacity-80"><G size={150} /></div>
      <div>
        {adim && <span className="mb-2 inline-block rounded-[2px] border border-app-border px-1.5 py-0.5 text-caption font-semibold text-app-text-muted">{adim}</span>}
        <h2 className="text-[19px] font-bold leading-tight">{baslik}</h2>
        <p className="mt-1.5 text-[14px] text-app-text-muted">{fayda}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  )
}
