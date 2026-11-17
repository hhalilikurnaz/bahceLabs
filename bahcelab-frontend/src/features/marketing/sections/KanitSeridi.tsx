import { DiagonalStripSection } from '../components/DiagonalStripSection'
import { Reveal } from '../components/Reveal'

const KAYNAKLAR = [
  { ad: 'Sentinel-2', kurum: 'ESA Copernicus', ne: 'Bitki canlılığı, 10 metrelik piksellerle' },
  { ad: 'Landsat 8 ve 9', kurum: 'NASA / USGS', ne: 'Yüzey sıcaklığı' },
  { ad: 'ERA5-Land', kurum: 'ECMWF', ne: 'Hava ve su dengesi, 9 km ızgarada' },
  { ad: 'SoilGrids', kurum: 'ISRIC', ne: 'Toprak yapısı, 250 metre çözünürlükte' },
] as const

/** Dürüst kanıt: kurucu hikâyesi + kullanılan veri kaynakları adıyla. Sayı, kurum logosu ya da alıntı yok. */
export function KanitSeridi() {
  return (
    <DiagonalStripSection id="hikaye" tone="cream" topEdge="flat" overlap={false} className="rounded-t-sheet bg-mk-cream shadow-e3 ">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="mb-3 text-caption font-semibold uppercase tracking-[0.16em] text-mk-accent">Nereden geliyoruz</p>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-mk-ink sm:text-3xl">Erdemli’de limon üreticisi bir ailenin bahçelerinden doğdu.</h2>
          <div className="mt-5 space-y-4 text-body leading-[1.75] text-mk-body sm:text-base">
            <p>BahçeLab’ı bugün Mersin’in Erdemli ilçesindeki gerçek limon bahçelerinde, gerçek uydu ve hava verisiyle geliştiriyoruz.</p>
            <p>Bu yüzden her ekranda neyin ölçüldüğünü, neyin tahmin olduğunu ve verinin nereden geldiğini ayrı gösteriyoruz.</p>
          </div>
        </Reveal>
        <Reveal delayMs={80}>
          <h3 className="text-h2 font-semibold text-mk-ink">Kullandığımız veri kaynakları</h3>
          <dl className="mt-4 divide-y divide-mk-ink/10 border-y border-mk-ink/10">
            {KAYNAKLAR.map((k) => (
              <div key={k.ad} className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
                <dt className="font-semibold text-mk-ink">
                  {k.ad} <span className="block text-small font-normal text-mk-muted">{k.kurum}</span>
                </dt>
                <dd className="m-0 text-body text-mk-body sm:self-center">{k.ne}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </DiagonalStripSection>
  )
}
