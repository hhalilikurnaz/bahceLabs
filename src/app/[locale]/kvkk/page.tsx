import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Header from "@/components/Header";
import { Footer } from "@/components/Sections";
import { site } from "@/lib/site";

export default async function Kvkk({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("kvkk");
  const messages = (await getMessages()) as unknown as { kvkk: { items: string[] } };
  return (
    <>
      <Header />
      <main className="legal container">
        <h1>{t("title")}</h1>
        <p className="lead">{t("intro")}</p>
        <ul>
          {messages.kvkk.items.map((item, i) => (
            <li key={i}>{item.replace("{email}", site.email)}</li>
          ))}
        </ul>
        <p>
          <Link href="/">{t("back")}</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
