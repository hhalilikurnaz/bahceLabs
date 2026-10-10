# BahçeLab — Tasarım sistemi ("Limon Bahçesi" teması, Adım 7A)

Kaynak: `bahcelab-frontend/src/index.css` (token'lar) · `src/components/ui/` (bileşenler). Karar ve gerekçeler: `TASARIM-IYILESTIRME.md`.

## İlkeler
- **Paneller açık** (krem/beyaz kartlar, koyu yeşil metin); **harita ve harita üstü denetimler koyu** (`.surface-dark`).
- Limon sarısı yalnızca **marka ve birincil eylem**; uyarı turuncusu (`warn`) ayrı; renk tek başına anlam taşımaz (simge + metin).
- **Fraunces** (başlık, büyük sayı) + **Manrope** (arayüz). Başka font yok (Inter ve Plus Jakarta kaldırıldı).
- Metin kontrastı ≥ 4,5:1 (AA); yazı ≥ 12 px; dokunma hedefi ≥ 44 px (yeni bileşenlerde).

## Tema mekaniği
`app-*` token'ları varsayılan olarak **açık** değerleri taşır. Bir kapsayıcıya `surface-dark` sınıfı eklenince aynı token'lar koyu değerlere döner; böylece aynı bileşen iki zeminde de doğru görünür. Harita çizimleri (`map/cssColor.ts`) koyu yüzey değerlerini okur.

| Token | Açık (panel) | Koyu (`surface-dark`) |
|---|---|---|
| `app-bg` / `panel` / `card` | `#F5F2E9` / `#FBF9F3` / `#FFFFFF` | `#0C1710` / `#12211A` / `#1A2C22` |
| `app-text` / `muted` / `dim` | `#13241A` / `#46574B` / `#5C6B60` | `#F3F1E7` / `#B9C4B6` / `#93A294` |
| `app-accent` (yeşil) | `#2F6B3F` | `#7FCB6B` |
| `app-primary` (limon) + `on-primary` | `#F2C94C` + `#0C1710` | aynı |
| `app-success` / `warn` / `danger` / `water` | `#2A7A3B` / `#9A4F08` / `#B3382A` / `#1F6FA8` | `#7FCB6B` / `#F2A04A` / `#F0705C` / `#6CB4EE` |

Ölçülen kontrastlar (WCAG): açık panelde metin 15,4 · muted 7,3 · dim 5,4 · accent 6,1 · danger 5,7 · warn 5,7 · success 5,1 · water 5,1; limon düğmede koyu metin 11,6; koyu yüzeyde metin 14,7 · muted 9,2 · dim 6,2.

## Tipografi (px / satır)
`caption 12/16` · `small 13/18` · `body 14/20` · `lead 16/24` · `h2 18/24` · `h1 24/30` · `display 32/36` · `metric 44/48` (Fraunces: h1 ve üstü başlıklar, sayılar; `tabular` sınıfı tabular rakam).

## Boşluk, köşe, gölge, hareket
4 pt ızgara (4·8·12·16·20·24·32) · köşe `sm 8` / `md 12` / `lg 16` · gölge `e1` kart, `e2` yüzen denetim, `e3` panel/çekmece · hareket 120 ms (hover), 240 ms (panel), `prefers-reduced-motion` ile kapanır · odak halkası 2 px + 2 px boşluk (açık zeminde koyu yeşil, koyu zeminde limon).

## Bileşenler (`@/components/ui`)
`Button` (primary/secondary/ghost/danger, md 44 · lg 48) · `IconButton` (44×44, zorunlu `label`) · `Card`, `StatCard` (değer + değişim oku + sparkline) · `Tabs` (rota bağlantılı, ok tuşları) · `Segmented` · `Badge` · `Tooltip` · `Skeleton`/`SkeletonText` · `EmptyState` · `ErrorState` · `Toast` (başarı/bilgi/uyarı/hata, eylemli) · `Drawer` (yan çekmece / alt sayfa) · `Sparkline` · `BrandLogo` (açık/koyu zemin) · `BrandMark`.

## Logo
bahcelabs.com landing logosu (`assets/marketing/bahcelab-logo.png`) kırpılıp iki zemin için üretildi: `assets/brand/logo-on-light.png`, `logo-on-dark.png` (yazı kreme çevrildi, renkli çubuklar aynı) ve yalnızca çubuklar `logo-mark.png` (dar alan: sol menü, yükleme ekranı). Landing dosyalarına dokunulmadı.
