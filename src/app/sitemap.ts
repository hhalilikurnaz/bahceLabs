import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((l) => [
    { url: `https://bahcelabs.com/${l}/`, changeFrequency: "monthly", priority: 1 },
    { url: `https://bahcelabs.com/${l}/kvkk/`, changeFrequency: "yearly", priority: 0.2 },
  ]);
}
