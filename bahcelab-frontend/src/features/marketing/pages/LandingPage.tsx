import type { ReactNode } from 'react'
import { BarChart3, Brain, Cpu, Leaf, LineChart, Sprout, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import heroImage from '@/assets/marketing/hero-orchard-drones.jpg'
import { BahcelabBrandLogo } from '../components/BahcelabBrandLogo'
import {
  DiagonalStripSection,
  StripTextContent,
  textSideForStripEdge,
} from '../components/DiagonalStripSection'
import { HeroScrollCue } from '../components/HeroScrollCue'
import { MarketingFooter } from '../components/MarketingFooter'
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
    <div className="bg-[#06140d] text-[#f3efe4]">
      <MarketingNavbar variant="over-hero" />

      <section
        className="fixed inset-0 z-0 flex min-h-dvh items-center justify-center"
        aria-label="BahçeLab tanıtım hero"
      >
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#06140d]/40" aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#06140d]/75 via-[#06140d]/25 to-[#06140d]/80"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_45%,rgba(6,20,13,0.72),transparent)]"
          aria-hidden
        />
        <HeroScrollCue />
        <div
          className="relative z-10 mx-auto w-full max-w-5xl -translate-y-[clamp(1.5rem,5vh,3.5rem)] px-5 text-center sm:px-10"
        >
          <div className="mb-6 flex justify-center sm:mb-7">
            <BahcelabBrandLogo
              tone="light"
              className="mx-auto w-auto max-w-[min(85vw,20rem)] object-contain object-center sm:max-w-[22rem]"
              style={{ height: 'clamp(3.5rem, 10vw, 5.5rem)' }}
            />
          </div>
          <h1
            className="mx-auto max-w-[18ch] text-balance text-[clamp(2.75rem,7.5vw,5rem)] font-extrabold leading-[1.04] tracking-[-0.045em] text-[#fffef9] [text-shadow:0_6px_40px_rgba(6,20,13,0.7)] sm:max-w-[20ch] lg:text-[5.25rem] lg:leading-[1.02]"
          >
            Üretim verimini yükseltmek, bitkiyi anlamaktan geçer.
          </h1>
          <p
            className="mx-auto mt-7 max-w-2xl text-pretty text-[clamp(1.1rem,2.3vw,1.375rem)] font-semibold leading-[1.55] text-[#faf8f2] [text-shadow:0_3px_24px_rgba(6,20,13,0.55)] sm:mt-8 sm:max-w-xl"
          >
            <span className="font-bold text-[#ecf7b8]">Yapay zeka destekli</span> ve{' '}
            <span className="font-bold text-[#ecf7b8]">veriye dayalı</span> bir yaklaşımla, tarımda
            sürdürülebilir büyümeyi güçlendirmek için çalışıyoruz.
          </p>
        </div>
      </section>

      <div className="relative z-10 h-dvh pointer-events-none" aria-hidden />

      <main className="relative z-20 -mt-2 overflow-x-clip text-[#1a241c]">
        <DiagonalStripSection
          id="misyon"
          tone="cream"
          topEdge="flat"
          overlap={false}
          className="rounded-t-[2rem] border-t border-[#e8e4d9]/40 shadow-[0_-24px_80px_rgba(0,0,0,0.45)] sm:rounded-t-[2.75rem]"
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

        <DiagonalStripSection tone="cream" topEdge="slant-down">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#0c2418] sm:text-3xl">
              Gelecek adımlar
            </h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-[1.75] text-[#4b554c] sm:text-base">
              Platformumuz hazır olduğunda planlama ve gözlem deneyimini bu kanaldan duyuracağız. O
              zamana kadar blogumuzda <Emphasis>sürdürülebilir üretim</Emphasis>, veri okuryazarlığı
              ve sektörel gelişmeler üzerine paylaşımlar yapacağız.
            </p>
            <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-[#5c665d]">
              Erken erişim ve kayıt süreci kısa süre içinde açılacaktır.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-lg border border-[#2d6b45]/30 bg-[#0c2418] px-4 py-3 text-[13px] font-medium text-[#f3efe4]">
                Kayıtlar çok yakında
              </span>
              <Link
                to="/blog"
                className="inline-flex items-center rounded-lg border border-[#0c2418]/15 bg-transparent px-4 py-3 text-[13px] font-medium text-[#0c2418] no-underline transition-colors hover:bg-[#0c2418]/5"
              >
                Bloga git
              </Link>
            </div>
          </Reveal>
        </DiagonalStripSection>

        <MarketingFooter />
      </main>
    </div>
  )
}
