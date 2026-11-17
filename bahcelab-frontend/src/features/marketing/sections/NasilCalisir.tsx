import { DiagonalStripSection } from '../components/DiagonalStripSection'
import { Reveal } from '../components/Reveal'

const ADIMLAR = [
  { baslik: 'Sınırı çizin', govde: 'Haritada bahçenizin sınırını çizin ya da KML, KMZ veya GeoJSON dosyasından alın.' },
  { baslik: 'Haritanızı görün', govde: 'Uydu görüntüleri 10 metrelik piksellerle işlenir. Yılların görüntüsünden bahçenizin güçlü, orta ve zayıf kesimleri çıkarılır.' },
  { baslik: 'Ne yapacağınızı öğrenin', govde: 'Durum ekranı bahçenin hâlini tek cümleyle söyler. Sulama, ilaçlama zamanı ve hava uyarıları aynı yerde; sahada gördüklerinizi Saha Defteri’ne konumuyla yazarsınız.' },
] as const

export function NasilCalisir() {
  return (
    <DiagonalStripSection id="nasil-calisir" tone="sage" topEdge="slant-down">
      <Reveal>
        <p className="mb-3 text-caption font-semibold uppercase tracking-[0.16em] text-mk-accent">Nasıl çalışır</p>
        <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.02em] text-mk-ink sm:text-3xl">Üç adımda bahçenizin haritası</h2>
      </Reveal>
      <ol className="mt-10 grid list-none gap-6 p-0 md:grid-cols-3">
        {ADIMLAR.map((a, i) => (
          <Reveal key={a.baslik} as="li" delayMs={i * 80} className="rounded-mk border border-mk-ink/10 bg-white/60 p-6">
            <span className="font-display text-4xl font-semibold text-mk-accent" aria-hidden>{i + 1}</span>
            <h3 className="mt-3 text-h2 font-semibold text-mk-ink">{a.baslik}</h3>
            <p className="mt-2 text-body leading-relaxed text-mk-body">{a.govde}</p>
          </Reveal>
        ))}
      </ol>
    </DiagonalStripSection>
  )
}
