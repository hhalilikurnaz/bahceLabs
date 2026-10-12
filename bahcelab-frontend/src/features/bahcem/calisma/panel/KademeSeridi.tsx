import { KADEMELER, KADEME_META, type Kademe } from '../../lib/kademe'

/** 4 parçalı kademe şeridi + işaretçi: işaretçi yalnız bulunduğu kademenin ortasındadır (sayısal konum yok). */
export function KademeSeridi({ kademe }: { kademe: Kademe | null }) {
  return (
    <div role="img" aria-label={kademe ? `Kademe: ${KADEME_META[kademe].ad}` : 'Kademe hesaplanamadı'} data-testid="kademe-seridi">
      <div className="grid grid-cols-4 gap-1">
        {KADEMELER.map((k) => (
          <div key={k} className="relative">
            <div className="h-2 rounded-[2px]" style={{ background: KADEME_META[k].renk, opacity: kademe === k ? 1 : 0.28 }} />
            <span className={`mt-1.5 block text-center text-[11.5px] ${kademe === k ? 'font-bold text-app-text' : 'text-app-text-muted'}`}>{KADEME_META[k].ad}</span>
            {kademe === k && (
              <span aria-hidden className="absolute -top-[9px] left-1/2 -translate-x-1/2 text-[10px] leading-none" style={{ color: KADEME_META[k].renk }}>▼</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
