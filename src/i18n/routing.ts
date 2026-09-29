import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en", "es"],
  defaultLocale: "tr",
});

export type Locale = (typeof routing.locales)[number];
