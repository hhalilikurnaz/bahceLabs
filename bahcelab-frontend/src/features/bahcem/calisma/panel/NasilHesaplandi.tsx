import type { GardenStatus } from '../../api/agroApi'
import { Akordeon } from './parcalar'

/** «Nasıl hesaplandı?»: en fazla 3 kısa cümle: kademeyi en çok düşüren bileşen(ler), veri tarihleri, güven. Sayı yok; eşikler «ön değer · v2». Jargon başlıkta değil, burada. */
export function NasilHesaplandi({ nasil, esikDurumu }: { nasil: GardenStatus['nasil']; esikDurumu: string }) {
  return (
    <Akordeon baslik="Nasıl hesaplandı?" ozet={esikDurumu} testId="nasil-hesaplandi">
      <ol className="list-none space-y-1.5 text-small leading-snug" data-testid="nasil-cumleler">
        {nasil.map((c, i) => <li key={i} data-testid={i === 0 ? 'kademe-nedeni' : undefined}>{c}</li>)}
      </ol>
      <p className="mt-2 text-caption text-app-text-dim">Her bileşen bahçenin kendi dönem normuna göre değerlendirilir. Eşikler ön değerdir, mühendis onayı bekliyor.</p>
    </Akordeon>
  )
}
