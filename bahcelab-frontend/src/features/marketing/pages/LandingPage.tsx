import type { ReactNode } from 'react'
import { BarChart3, Brain, Cpu, Leaf, LineChart, Sprout, Target } from 'lucide-react'
import {
  DiagonalStripSection,
  StripTextContent,
  textSideForStripEdge,
} from '../components/DiagonalStripSection'
import { JourneyHero } from '../journey/JourneyHero'
import { MarketingFutureStepsSection } from '../components/MarketingFutureStepsSection'
import { MissionOutcomeCards } from '../components/MissionOutcomeCards'
import { MarketingNavbar } from '../components/MarketingNavbar'
import { Reveal } from '../components/Reveal'

function Emphasis({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[#0c2418]">{children}</strong>
}

const pillars = [
  {
    icon: Brain,
    title: 'Yapay zeka destekli',
    body: 'Karar süreçlerini hızlandıran, tutarlılık sağlayan akıllı katman.',
  },
  {
    icon: LineChart,
    title: 'Veriye dayalı',
    body: 'Saha gözlemini ölçülebilir göstergelere dönüştürme yaklaşımı.',
  },
  {
    icon: Sprout,
    title: 'Sürdürülebilir',
    body: 'Uzun vadeli toprak ve ekosistem dengesini gözeten üretim modeli.',
  },
]

export function LandingPage() {
  return (
    <div className="bg-[#0e1a12] text-[#f3efe4]">
      <MarketingNavbar variant="over-hero" />

      <JourneyHero />

      <main className="relative z-20 -mt-[100dvh] overflow-x-clip text-[#1a241c]">
        <DiagonalStripSection
          id="misyon"
          tone="cream"
          topEdge="flat"
          overlap={false}
          className="rounded-t-[2rem] border-t border-[#e8e4d9]/40 bg-[#f7f4ee] shadow-[0_-32px_100px_rgba(0,0,0,0.55)] sm:rounded-t-[2.75rem]"
          glyph={{ icon: Target, label: 'Misyon' }}
        >
          <StripTextContent
            eyebrow="Misyon"
            title="Sahada kararlar çoğu zaman geç ve dağınık kalıyor"
            textSide="left"
            wide
          >
            <p>
              Notlar farklı yerlerde, ekip içi bilgi sözlü kalıyor. Bitkiye geç bakıldığında{' '}
              <Emphasis>fazla ilaç, su ve işçilik</Emphasis> harcanıyor; verim de düşüyor. Tek bir büyük
              hata değil — her sezon tekrar eden küçük belirsizlikler birikiyor.
            </p>
            <p>
              BahçeLab bu soruna odaklanıyor: bitkiyi daha erken okumak, sizin deneyiminizi{' '}
              <Emphasis>veri ve yapay zeka</Emphasis> ile desteklemek. Abartılı vaatler yerine, sahada
              gerçekten tasarruf edilebilecek alanlara yöneliyoruz.
            </p>
            <MissionOutcomeCards />
            <p className="pt-6 text-[14px] leading-relaxed text-[#5c665d] sm:text-[15px]">
              Önce limon ve bahçe üretiminde deneyip ölçülebilir sonuç topluyoruz. Ürünün tüm detayını
              paylaşmadan önce hangi problemi çözdüğümüzü açıkça söylemek istiyoruz.
            </p>
          </StripTextContent>
        </DiagonalStripSection>

        <DiagonalStripSection
          tone="sage"
          topEdge="slant-down"
          glyph={{ icon: Cpu, label: 'Karar desteği' }}
        >
          <StripTextContent
            eyebrow="Yapay zeka perspektifi"
            title="Yapay zeka destekli karar desteği"
            textSide={textSideForStripEdge('slant-down')}
          >
            <p>
              Yapay zeka; üreticinin deneyimini tamamlayan, karar süreçlerini hızlandıran ve
              tutarlılık sağlayan bir katman olarak konumlanıyor. Amaç, saha verisini anlamlı
              öngörülere dönüştürmek — ürün detayına girmeden ifade ettiğimiz temel yaklaşım budur.
            </p>
          </StripTextContent>
        </DiagonalStripSection>

        <DiagonalStripSection
          tone="cream"
          topEdge="slant-up"
          glyph={{ icon: BarChart3, label: 'Veri disiplini' }}
        >
          <StripTextContent
            eyebrow="Ölçüm ve analitik"
            title="Veri analizi ve ölçülebilirlik"
            textSide={textSideForStripEdge('slant-up')}
          >
            <p>
              Gözlemi ölçülebilir göstergelere indirgemek, performansı karşılaştırılabilir kılmak ve
              yatırım kararlarını şeffaflaştırmak için <Emphasis>veri analizini</Emphasis> merkeze
              alıyoruz. Büyüme stratejimiz teknoloji vaadiyle değil, operasyonel gerçekliğe değer
              katan süreçlerle şekilleniyor.
            </p>
          </StripTextContent>
        </DiagonalStripSection>

        <DiagonalStripSection tone="forest" topEdge="slant-down">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold tracking-[-0.02em] text-[#f3efe4] sm:text-3xl">
              Yaklaşımımızın üç ekseni
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] leading-relaxed text-[#f3efe4]/75 sm:text-[15px]">
              BahçeLab’ın yol haritası; yapay zeka, veri disiplini ve sürdürülebilir üretim taahhüdü
              üzerine kuruludur.
            </p>
          </Reveal>
          <ul className="mt-12 grid gap-0 border border-[#a3e635]/15 sm:grid-cols-3 sm:divide-x sm:divide-[#a3e635]/15">
            {pillars.map((item, index) => (
              <Reveal key={item.title} delayMs={index * 80}>
                <li className="border-b border-[#a3e635]/15 px-6 py-8 last:border-b-0 sm:border-b-0">
                  <item.icon className="h-5 w-5 text-[#a3e635]" strokeWidth={1.25} aria-hidden />
                  <h3 className="mt-4 text-[15px] font-semibold text-[#f3efe4]">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#f3efe4]/70">{item.body}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </DiagonalStripSection>

        <DiagonalStripSection
          tone="paper"
          topEdge="slant-up"
          glyph={{ icon: Leaf, label: 'Sürdürülebilirlik' }}
        >
          <StripTextContent
            eyebrow="Uzun vadeli değer"
            title="Sürdürülebilir üretim"
            textSide={textSideForStripEdge('slant-up')}
          >
            <p>
              Verim artışını tek sezonluk kazanımla sınırlamıyoruz. Toprak, su ve ekosistem dengesini
              koruyan, <Emphasis>uzun vadeli üretim gücünü</Emphasis> destekleyen bir büyüme modelini
              benimsiyoruz.
            </p>
            <p>
              Limon üretiminden başlayan odakımız, ölçülebilir sonuç üreten ve sahada karşılığı olan
              bir üretim kültürünü güçlendirmeyi hedefliyor.
            </p>
          </StripTextContent>
        </DiagonalStripSection>

        <MarketingFutureStepsSection />
      </main>
    </div>
  )
}
