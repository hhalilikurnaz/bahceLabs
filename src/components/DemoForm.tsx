"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

type Status = "idle" | "sending" | "ok" | "error" | "invalid";

export default function DemoForm() {
  const t = useTranslations("demo");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setStatus("invalid");
      form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company) return; // bot tuzağı
    delete data.company;
    setStatus("sending");
    try {
      if (!site.formEndpoint) {
        // Uç nokta tanımlı değilse e-posta istemcisini aç
        const body = Object.entries(data)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        window.location.href = `mailto:${site.email}?subject=${encodeURIComponent("Demo talebi")}&body=${encodeURIComponent(body)}`;
        setStatus("ok");
        return;
      }
      const res = await fetch(site.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...data, locale, source: "bahcelabs.com" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="form-success" role="status">
        <p>{t("success")}</p>
      </div>
    );
  }

  return (
    <form className="demo-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="f-name">{t("fields.name")} *</label>
        <input id="f-name" name="name" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="f-phone">{t("fields.phone")} *</label>
        <input id="f-phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" />
      </div>
      <div className="field">
        <label htmlFor="f-email">{t("fields.email")}</label>
        <input id="f-email" name="email" type="email" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="f-role">{t("fields.role")} *</label>
        <select id="f-role" name="role" required defaultValue="">
          <option value="" disabled>
            —
          </option>
          {(["farmer", "coop", "advisor", "other"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`fields.roles.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-region">{t("fields.region")}</label>
        <input id="f-region" name="region" autoComplete="address-level2" />
      </div>
      <div className="field">
        <label htmlFor="f-area">{t("fields.area")}</label>
        <input id="f-area" name="area" type="number" min="0" step="1" inputMode="numeric" />
      </div>
      <div className="field field-wide">
        <label htmlFor="f-msg">{t("fields.message")}</label>
        <textarea id="f-msg" name="message" rows={3} />
      </div>
      <input className="hp" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="consent field-wide">
        <input type="checkbox" name="consent" value="yes" required />
        <span>
          {t("fields.consent")}{" "}
          <Link href="/kvkk" target="_blank">
            {t("fields.consentLink")}
          </Link>
        </span>
      </label>
      <div className="field-wide form-foot">
        <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
          {status === "sending" ? t("sending") : t("submit")}
        </button>
        {status === "invalid" && <p className="form-msg">{t("required")}</p>}
        {status === "error" && <p className="form-msg">{t("error", { email: site.email })}</p>}
      </div>
    </form>
  );
}
