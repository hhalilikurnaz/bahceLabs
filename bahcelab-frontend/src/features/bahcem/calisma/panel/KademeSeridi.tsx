import { KADEMELER, KADEME_META, type Kademe } from '../../lib/kademe'

/** 4 parçalı kademe şeridi: gösterge yeni kademeye KAYARAK geçer (200 ms, ease-out; reduced-motion'da anında). Renk + simge + ad birlikte (renk tek başına anlam taşımaz). */
export function KademeSeridi({ kademe }: { kademe: Kademe | null }) {
  const i = kademe ? KADEMELER.indexOf(kademe) : -1
  return (
    <div role="img" aria-label={kademe ? `Kademe: ${KADEME_META[kademe].ad}` : 'Kademe hesaplanamadı'} data-testid="kademe-seridi" data-kademe={kademe ?? 'yok'}>
      <div className="relative h-1.5 rounded-sm bg-app-border-soft">
        {i >= 0 && <span aria-hidden data-testid="kademe-gosterge" className="absolute inset-y-0 left-0 w-1/4 rounded-sm transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none" style={{ transform: `translateX(${i * 100}%)`, background: KADEME_META[kademe!].renk }} />}
      </div>
      <div className="mt-1.5 grid grid-cols-4">
        {KADEMELER.map((k) => (
          <span key={k} className={`text-center text-small ${kademe === k ? 'font-bold text-app-text' : 'text-app-text-dim'}`}>
            <span aria-hidden className="mr-1" style={{ color: kademe === k ? KADEME_META[k].renk : undefined }}>{KADEME_META[k].isaret}</span>{KADEME_META[k].ad}
          </span>
        ))}
      </div>
    </div>
  )
}
