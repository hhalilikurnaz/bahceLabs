// Site genelindeki ayarlar.
//
// HERO MODU
//  - "sequence": Kaydırmaya bağlı gerçek drone görüntüsü (kare dizisi). Varsayılan: drone videosu + kuşbakışı bahçe yolculuğu (Journey).
//  - "video":    Otomatik oynayan döngü video (kaydırmaya bağlı değil). Daha az dosya, daha basit.
//  - "canvas":   Sadece çizim (dijital ikiz) animasyonu. Görüntü yoksa yedek.
//
// Kare dizisini üretmek için: scripts/extract-frames.sh (bkz. README.md ve docs/VIDEO.md)
export const site = {
  domain: "https://bahcelabs.com",
  email: "merhaba@bahcelabs.com",

  heroMode: (process.env.NEXT_PUBLIC_HERO_MODE ?? "sequence") as "sequence" | "video" | "canvas",

  heroSequence: {
    // public/media/hero-frames/desktop/0001.webp ... şeklinde
    desktop: { path: "/media/hero-frames/desktop/", count: 120, ext: "webp" },
    mobile: { path: "/media/hero-frames/mobile/", count: 80, ext: "webp" },
    pad: 4,
  },

  // Kuşbakışı ana bahçe fotoğrafı (kamera bunun üzerinde gezer). Ağaç koordinatları: src/lib/journey.ts
  orchardMaster: {
    large: "/media/orchard/master-3344.webp",
    small: "/media/orchard/master-1920.webp",
    width: 1672,
    height: 941,
  },

  heroVideo: {
    webm: "/media/hero.webm",
    mp4: "/media/hero.mp4",
    mobileMp4: "/media/hero-720.mp4",
    poster: "/media/hero-poster.jpg",
  },

  // Formspree, Web3Forms, Basin vb. JSON kabul eden bir form uç noktası.
  // .env.local içine NEXT_PUBLIC_FORM_ENDPOINT=... yazın. Boşsa form e-posta istemcisini açar.
  formEndpoint: process.env.NEXT_PUBLIC_FORM_ENDPOINT ?? "",
};
