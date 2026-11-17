import { ErkenErisimSection } from '../components/ErkenErisimSection'
import { MarketingNavbar } from '../components/MarketingNavbar'
import { JourneyHero } from '../journey/JourneyHero'
import { Durustluk } from '../sections/Durustluk'
import { KanitSeridi } from '../sections/KanitSeridi'
import { NasilCalisir } from '../sections/NasilCalisir'

export function LandingPage() {
  return (
    <div className="bg-mk-night text-mk-on-dark">
      <MarketingNavbar variant="over-hero" />

      <JourneyHero />

      <main className="relative z-20 -mt-[100dvh] overflow-x-clip text-mk-text">
        <KanitSeridi />
        <NasilCalisir />
        <Durustluk />
        <ErkenErisimSection />
      </main>
    </div>
  )
}
