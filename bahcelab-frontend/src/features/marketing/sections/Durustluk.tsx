import { Clock3, FlaskConical, Layers } from 'lucide-react'
import { DiagonalStripSection } from '../components/DiagonalStripSection'
import { Reveal } from '../components/Reveal'

const MADDELER = [
  { simge: Clock3, baslik: 'Kaynak ve yaş', govde: 'Her sayının yanında kaynağı ve ne kadar eski olduğu yazar. Örneğin «ERA5-Land · 9 km · 5 gün önce».' },
  { simge: FlaskConical, baslik: 'Ön değer', govde: 'Henüz doğrulanmamış hesaplar «ön değer» diye işaretlenir. Karar yerine geçmez.' },
  { simge: Layers, baslik: 'Gözlem ve tahmin ayrı', govde: 'Uydunun ölçtüğü ile modelin tahmin ettiği farklı çizilir. Veri eskiyse bunu söyler.' },
] as const

export function Durustluk() {
  return (
    <DiagonalStripSection id="durustluk" tone="forest" topEdge="slant-up">
      <Reveal>
        <p className="mb-3 text-caption font-semibold uppercase tracking-[0.16em] text-mk-lemon">Dürüstlük</p>
        <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.02em] text-mk-on-dark sm:text-3xl">Ön değerdir, karar üreticinindir.</h2>
        <p className="mt-4 max-w-3xl text-body leading-[1.75] text-mk-on-dark/80 sm:text-base">Veriyi nereden aldığımızı her ekranda gösteririz.</p>
      </Reveal>
      <ul className="mt-10 grid list-none gap-6 p-0 md:grid-cols-3">
        {MADDELER.map((m, i) => (
          <Reveal key={m.baslik} as="li" delayMs={i * 80} className="rounded-mk border border-mk-lime/20 p-6">
            <m.simge className="h-5 w-5 text-mk-lime" strokeWidth={1.5} aria-hidden />
            <h3 className="mt-4 text-body font-semibold text-mk-on-dark">{m.baslik}</h3>
            <p className="mt-2 text-small leading-relaxed text-mk-on-dark/80">{m.govde}</p>
          </Reveal>
        ))}
      </ul>
    </DiagonalStripSection>
  )
}
