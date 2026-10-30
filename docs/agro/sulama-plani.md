# Sulama planı — jlnnlk için gerçek çıktı (9H, tetik düzeltmesinden sonra)

Üretim: `bahcelab-backend/scripts/sulama_raporu.py` (yalnız okur, işlem sonunda geri alır; ham çıktı: [sulama-plani-jlnnlk.json](sulama-plani-jlnnlk.json)). Tarih: **2026-10-30**. Bahçe: **jlnnlk**, 15,149 dekar. Günlük kova tablosu ve tutarsızlık analizi: [sulama-plani-jlnnlk-ekim.md](sulama-plani-jlnnlk-ekim.md).

> **Dürüstlük notu.** jlnnlk için **kayıtlı sulama profili yok** ve **ağaç sayısı beyan edilmemiş**. Sayılar bir **örnek profille** (veritabanına yazılmadı) hesaplandı: damla, ağaç başına 4 damlatıcı × 4 L/sa, 5 × 4 m aralık, pompa 7,5 kW / 40 m³/sa, şebeke. Bu bilgiler sizin değil. **Ağaç başına litre ve süre** ağaç sayısı olmadığından **hesaplanmadı**. **TL yok**: EPDK tarife fiyatı doğrulanamadı, fatura fiyatı girilmedi. Katsayılar «ön değer · mühendis onayı bekliyor» (katalog sürüm 2).

## 1. Girdiler ve kaynakları

| Girdi | Değer | Kaynak |
|---|---|---|
| Toprak (kök bölgesi 80 cm) | **TAW 118,2 mm**, **RAW 59,1 mm** (p = 0,5) | SoilGrids 2.0 + Saxton & Rawls 2006; FAO-56 Denk. 82–83 |
| Taç örtüsü / Kc (Ekim) | **%67** (NDVI 0,669, 9 Eki) → Kc **0,67** | Sentinel-2 L2A; FAO-56 Tablo 12 + aylık evre ağırlıkları |
| ET₀, yağış | günlük (geçmiş ERA5-Land; ileri 10 gün Open-Meteo tahmini) | `era5_daily`; yağış kaynağı seçimi: ERA5 (IMERG 27 Ekim'de bitiyor, kullanılmıyor) |
| Başlangıç kovası | 30 gün önceki ERA5-Land kök bölgesi doluluğu | SMAP kullanılmaz (yalnız doğrulama) |
| Sistem verimi / program | damla **%90**; tetik **0,8 × RAW = 47,3 mm**, tek seferde en çok 8 mm net | katalog (ön değer) |

## 2. Bu haftanın planı

- **Karar cümlesi:** «Bu hafta sulama gerekmiyor.» (Su sekmesi: «Kök bölgesi Ekim normaline göre nemli (%100); önümüzdeki 7 gün sulama gerekmiyor.») — **ikisi aynı kovadan, çelişmiyor.**
- Kova 29 Ekim yağışından sonra tam dolu (tükenme 0 mm); 4 Kasım'da 8,9 mm, 6 Kasım'da 12,0 mm. Tetik 47,3 mm: önümüzdeki 7–10 günde sulama yok.
- Önümüzdeki 7 gün: **0 m³, 0 kWh, 0 TL** (maliyet satırı: «Tarife güncel değil, faturanızdaki birim fiyatı girin.»).
- **Uyarılar:** Alan ve aralığa göre beklenen ≈ 757 ağaç; ağaç sayısı beyan edilmemiş.; Ağaç sayısı beyan edilmediği için ağaç başına litre ve damlatıcı süresi gösterilmiyor.; Tarife güncel değil, faturanızdaki birim fiyatı girin.

*Düzeltme öncesi (hatalı) plan 4 Kasım için ≈ 135 m³ öneriyordu; nedeni ve düzeltmesi [sulama-plani-jlnnlk-ekim.md](sulama-plani-jlnnlk-ekim.md)'de.*

## 3. Sezon projeksiyonu (aralık, tek sayı değil)

2015–2025 sezonlarının (1 Nis–31 Eki) **gerçek havasıyla** aynı plan oynatıldı (kova tarla kapasitesinde başlar, varsayım):

- **Su: 6.868 – 7.945 m³** (p10–p90), ortanca 7.272 m³ → 453–524 m³/dekar.
- **TL: yok** (tarife doğrulanamadı).
- Bu yılın planı (1 Nis → bugün): 4.713 m³; Saha Defteri'nde sulama kaydı yok.

*Düzeltme öncesi aralık 7.810–8.753 m³ idi; tetik %15 RAW iken kova gereğinden sık sulanıyordu (sezon ≈ %12–15 fazla).*

## 4. Kuru yıl ↔ ıslak yıl (gerçek geçmiş hava)

| Yıl | Sezon yağışı (mm) | Sezon ET₀ (mm) | Plan suyu (m³) | m³/dekar |
|---|---|---|---|---|
| 2015 | 224 | 868 | 6.868 | 453 |
| 2016 | 215 | 900 | 7.002 | 462 |
| 2017 | 219 | 924 | 7.406 | 489 |
| 2018 | 249 | 926 | 6.868 | 453 |
| 2019 | 223 | 901 | 6.868 | 453 |
| 2020 | 162 | 933 | 7.945 | 524 |
| 2021 | 156 | 939 | 8.214 | 542 |
| 2022 | 218 | 924 | 7.272 | 480 |
| 2023 | 252 | 905 | 6.733 | 444 |
| 2024 | 247 | 924 | 7.272 | 480 |
| 2025 | 226 | 933 | 7.541 | 498 |

- En çok su **2021** (8.214 m³; yağış 156 mm), en az **2023** (6.733 m³; yağış 252 mm). **Fark 1.481 m³** (≈ %22).
- Toplamlar olay büyüklüğüne (8,9 mm brüt) göre kademelidir; bazı yıllar aynı değerde görünür (2015/2018/2019: 6.868 m³).
- 2021: 61 sulama, 2023: 50, 2025: 56; eşik altı (stres) gün her üçünde 0.

## 5. Diğer senaryolar (2025 havasıyla)

- **Alışkanlık ↔ plan:** hesaplanmadı — ağaç sayısı yok (uydurulmaz).
- **Kısıntılı sulama** (yalnız olgunlaşma, %75): 7.541 → 6.733 m³, **tasarruf 808 m³** (≈ %10,7), **verim riski: düşük**. Çiçeklenme–tutum ve hızlı meyve büyümesi **kilitli** («Bu dönemde önerilmez»). Varsayılan plan değil.
- **Sistem değişikliği (damla → salma):** 7.541 → 13.396 m³ (**+5.855 m³**); TL ve geri ödeme yok.

## 6. Sınırlar

- Katalog ön değerleri, **mühendis onayı yok** (`KURAL-DURUMU.md`). Tetik oranı (0,8) da ön değerdir; mühendis değiştirebilir ama 0,8'in altına katalog izin vermez.
- Taç örtüsü NDVI'ı 21 gün eski (9 Eki).
- **İki yağış serisi** (Hava sekmesi 138 mm / Su ve plan 91 mm, son 7 gün) hâlâ ayrı: bkz. [sulama-plani-jlnnlk-ekim.md](sulama-plani-jlnnlk-ekim.md) §2.
- Bloklar yok → hesap bahçe düzeyinde.
