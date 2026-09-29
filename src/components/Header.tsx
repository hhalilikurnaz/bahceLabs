"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import Logo from "./Logo";

export default function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    ["#features", t("features")],
    ["#how", t("how")],
    ["#who", t("who")],
    ["#story", t("story")],
  ];

  return (
    <header className={`site-header${solid ? " is-solid" : ""}${open ? " is-open" : ""}`}>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="BahçeLab">
          <Logo />
          <span>
            Bahçe<b>Lab</b>
          </span>
        </Link>
        <nav className="nav" aria-label="Ana menü">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <div className="lang" role="group" aria-label={t("language")}>
            {routing.locales.map((l) => (
              <Link key={l} href={pathname} locale={l} className={l === locale ? "is-current" : undefined} aria-current={l === locale ? "true" : undefined}>
                {l.toUpperCase()}
              </Link>
            ))}
          </div>
          <a className="btn btn-primary btn-sm" href="#demo">
            {t("demo")}
          </a>
          <button className="menu-toggle" aria-expanded={open} aria-label="Menü" onClick={() => setOpen(!open)}>
            <i />
            <i />
          </button>
        </div>
      </div>
    </header>
  );
}
