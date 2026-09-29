import { useMessages, useTranslations } from "next-intl";
import DemoForm from "./DemoForm";
import Logo from "./Logo";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

type Item = { title: string; body: string };
type Msgs = {
  how: { steps: Item[] };
  who: { items: Item[] };
  origin: { stats: { value: string; label: string }[] };
};

const HOW_ICONS = [
  // uçuş
  <svg key="0" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" /><circle cx="5" cy="5" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /></svg>,
  // analiz
  <svg key="1" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="12" cy="12" r="3.5" /><path d="M4 9h3M17 15h3M9 20v-3M15 4v3" /></svg>,
  // öneri
  <svg key="2" viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-10a6 6 0 1112 0c0 4.5-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>,
  // uygulama
  <svg key="3" viewBox="0 0 24 24"><path d="M12 3c3 4 5 6.5 5 9.5A5 5 0 017 12.5C7 9.5 9 7 12 3z" /><path d="M9.5 14.5l2 2 3.5-4" /></svg>,
];

export function HowItWorks() {
  const t = useTranslations("how");
  const steps = (useMessages() as unknown as Msgs).how.steps;
  return (
    <section className="section how" id="how">
      <div className="container">
        <p className="kicker">{t("kicker")}</p>
        <h2>{t("title")}</h2>
        <ol className="how-grid">
          {steps.map((s, i) => (
            <li key={i} className="how-card">
              <span className="how-icon" aria-hidden="true">{HOW_ICONS[i]}</span>
              <span className="how-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Audience() {
  const t = useTranslations("who");
  const items = (useMessages() as unknown as Msgs).who.items;
  return (
    <section className="section who" id="who">
      <div className="container">
        <p className="kicker">{t("kicker")}</p>
        <h2>{t("title")}</h2>
        <div className="who-grid">
          {items.map((s, i) => (
            <div key={i} className="who-card">
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Origin() {
  const t = useTranslations("origin");
  const stats = (useMessages() as unknown as Msgs).origin.stats;
  return (
    <section className="section origin" id="story">
      <div className="container origin-grid">
        <div>
          <p className="kicker">{t("kicker")}</p>
          <h2>{t("title")}</h2>
          <p className="lead">{t("body")}</p>
        </div>
        <dl className="stats">
          {stats.map((s, i) => (
            <div key={i}>
              <dt>{s.value}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Demo() {
  const t = useTranslations("demo");
  return (
    <section className="section demo" id="demo">
      <div className="container demo-grid">
        <div>
          <p className="kicker">{t("kicker")}</p>
          <h2>{t("title")}</h2>
          <p className="lead">{t("subtitle")}</p>
          <p className="demo-mail">
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="brand">
          <Logo size={26} />
          <span>
            Bahçe<b>Lab</b>
          </span>
        </div>
        <p>{t("tagline")}</p>
        <p>{t("location")}</p>
        <nav>
          <Link href="/kvkk">{t("privacy")}</Link>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </nav>
        <p className="copy">
          © {new Date().getFullYear()} BahçeLab. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
