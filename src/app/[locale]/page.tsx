import { setRequestLocale } from "next-intl/server";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FeatureStory from "@/components/FeatureStory";
import Journey from "@/components/Journey";
import { site } from "@/lib/site";
import { Audience, Demo, Footer, HowItWorks, Origin } from "@/components/Sections";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Header />
      <main>
        {/* Gerçek görüntüler hazırsa (sequence) tek parça bahçe yolculuğu, değilse çizim tabanlı hero + özellikler */}
        {site.heroMode === "sequence" ? (
          <Journey />
        ) : (
          <>
            <Hero />
            <FeatureStory />
          </>
        )}
        <HowItWorks />
        <Audience />
        <Origin />
        <Demo />
      </main>
      <Footer />
    </>
  );
}
