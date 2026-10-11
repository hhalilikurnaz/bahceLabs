# ADR 0005 — Performans ve kod bölme

**Durum:** kabul (Adım 7A/7B-1)

**Karar.** Rota bazlı tembel yükleme (landing eager; giriş, harita çalışma alanı, blog ayrı parça). MapLibre ve CSS'i `loadMapLibre()` ile tembel yüklenir; panel ve liste haritayı beklemeden iskeletle görünür. Çizim aracı (terra-draw) ve KML/KMZ kütüphaneleri ihtiyaç anında yüklenir. Yazı tipleri 4 aileden 2'ye (Fraunces + Manrope). Hedef: kısıtlı ağ + 4× CPU'da harita sayfası LCP < 2,5 sn.

**Ölçüm** (üretim derlemesi, yerel; rapora bakın): giriş/landing JS 522 → ≈100 kB gzip.
