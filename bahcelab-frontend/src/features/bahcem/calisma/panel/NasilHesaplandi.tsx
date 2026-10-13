import type { GardenStatus } from '../../api/agroApi'

/** «Nasıl hesaplandı?»: en fazla 3 kısa cümle — kademeyi en çok düşüren bileşen(ler), veri tarihleri, güven. Sayı yok; eşikler «ön değer · v2». */
export function NasilHesaplandi({ nasil, esikDurumu }: { nasil: GardenStatus['nasil']; esikDurumu: string }) {
  return (
    <details className="group rounded-md border border-app-border bg-app-card" data-testid="nasil-hesaplandi">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[13px] font-semibold">
        Nasıl hesaplandı?
        <span aria-hidden className="text-app-text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-2 border-t border-app-border px-3.5 py-3 text-[13px] leading-snug">
        <ol className="list-none space-y-1.5" data-testid="nasil-cumleler">
          {nasil.map((c, i) => (
            <li key={i} data-testid={i === 0 ? 'kademe-nedeni' : undefined}>{c}</li>
          ))}
        </ol>
        <p className="text-[12px] text-app-text-dim">
          <span className="rounded-[2px] border border-app-border px-1.5 py-0.5 text-[11px] font-medium">{esikDurumu}</span> · Her bileşen bahçenin kendi dönem normuna göre değerlendirilir.
        </p>
      </div>
    </details>
  )
}
