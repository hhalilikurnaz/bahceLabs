# Sulama planı — jlnnlk için gerçek çıktı (9H)

Üretim: `bahcelab-backend/scripts/sulama_raporu.py` (yalnız okur, işlem sonunda geri alır; ham çıktı: [sulama-plani-jlnnlk.json](sulama-plani-jlnnlk.json)). Tarih: **2026-10-30**. Bahçe: **jlnnlk**, 15,149 dekar.

> **Dürüstlük notu (önce bunu okuyun).** jlnnlk için **kayıtlı sulama profili yok** ve **ağaç sayısı beyan edilmemiş**. Aşağıdaki sayılar bu yüzden bir **örnek profille** hesaplandı (veritabanına yazılmadı): damla, ağaç başına 4 damlatıcı × 4 L/sa, 5 × 4 m dikim aralığı, pompa 7,5 kW / 40 m³/sa, şebeke elektriği. Bu bilgiler sizin değil; sihirbaza gerçeklerini girince sayılar değişir. **Ağaç başına litre ve damlatıcı süresi** ağaç sayısı olmadığı için **hesaplanmadı** (kural gereği uydurulmaz). **TL** yok: EPDK tarife fiyatı doğrulanamadı ve fatura fiyatı girilmedi. Tüm katsayılar «ön değer · mühendis onayı bekliyor» (katalog sürüm 2).

## 1. Girdiler ve kaynakları

| Girdi | Değer | Kaynak |
|---|---|---|
| Toprak (kök bölgesi 80 cm) | tarla kapasitesi 0,323 · solma noktası 0,175 → **TAW 118,2 mm**, **RAW 59,1 mm** (p = 0,5) | SoilGrids 2.0 (ISRIC, 250 m) + Saxton & Rawls 2006; FAO-56 Denk. 82–83 |
| Taç örtüsü | **%67** (NDVI 0,669, 9 Eki 2026) | Sentinel-2 L2A; Carlson & Ripley dönüşümü (katalog) |
| Kc (Ekim) | **0,67** | FAO-56 Tablo 12 (narenciye, yer örtüsüz, %20/50/70 sınıfları arası doğrusal) + aylık evre ağırlıkları |
| ET₀, yağış (geçmiş) | günlük, 2015 – bugün | ERA5-Land (Open-Meteo, FAO-56 Penman-Monteith); yağış kaynağı IMERG/ERA5 seçimi Su sekmesiyle aynı |
| ET₀, yağış (önümüzdeki 10 gün) | günlük | Open-Meteo tahmini (arayüzde taralı) |
| Sistem verimi | damla **%90** → brüt = net ÷ 0,90 | katalog (ön değer) |
| Program | damla: RAW'ın %15'inde tetik, tek seferde en çok 8 mm net | katalog (ön değer) |

## 2. Bu haftanın planı

- **Karar cümlesi:** «Çarşamba yaklaşık 135 metreküp sulayın.» (süre cümlesi için damlatıcı + ağaç sayısı gerekir; yok, bu yüzden m³ söylenir.)
- **Sonraki sulama:** 2026-11-04 · net 8,0 mm → brüt 8,9 mm = **135 m³** (8,9 m³/dekar).
- **Önümüzdeki 7 gün:** 135 m³ · 3,4 pompa saati · **25,2 kWh** · TL: **yok** — «Tarife güncel değil, faturanızdaki birim fiyatı girin.»
- Önceki günler: 27–29 Ekim yağışı kovayı doldurdu (29 Ekim eksik 0 mm); bu yüzden 29 Ekim–3 Kasım sulama önerilmedi.
- **Uyarılar (olduğu gibi):** Alan ve aralığa göre beklenen ≈ 757 ağaç; ağaç sayısı beyan edilmemiş.; Ağaç sayısı beyan edilmediği için ağaç başına litre ve damlatıcı süresi gösterilmiyor.; Kova (1 mm eksik) ile ERA5-Land toprak nemi (19 mm eksik) arasında 18 mm fark var; ölçümünüzle kontrol edin.; Tarife güncel değil, faturanızdaki birim fiyatı girin.

## 3. Sezon projeksiyonu (aralık, tek sayı değil)

2015–2025 sezonlarının (1 Nis–31 Eki) **gerçek havasıyla** aynı plan oynatıldı:

- **Su: 7.810 – 8.753 m³** (p10–p90), ortanca 8.349 m³ → 516–578 m³/dekar.
- **TL: yok** (tarife doğrulanamadı; fiyat girilince aralık hesaplanır).
- Bu yıl (1 Nis → bugün) aynı kuralın planı: 6.733 m³; Saha Defteri'nde sulama kaydı yok, uygulanan: yok.

## 4. Kuru yıl ↔ ıslak yıl (gerçek geçmiş hava)

| Yıl | Sezon yağışı (mm) | Sezon ET₀ (mm) | Plan suyu (m³) | m³/dekar |
|---|---|---|---|---|
| 2015 | 224 | 868 | 7.675 | 507 |
| 2016 | 215 | 900 | 8.214 | 542 |
| 2017 | 219 | 924 | 8.618 | 569 |
| 2018 | 249 | 926 | 8.349 | 551 |
| 2019 | 223 | 901 | 7.810 | 516 |
| 2020 | 162 | 933 | 8.753 | 578 |
| 2021 | 156 | 939 | 9.022 | 596 |
| 2022 | 218 | 924 | 8.483 | 560 |
| 2023 | 252 | 905 | 7.810 | 516 |
| 2024 | 247 | 924 | 8.214 | 542 |
| 2025 | 226 | 933 | 8.483 | 560 |

- En çok su: **2021** (9.022 m³; yağış 156 mm) · en az su: **2015** (7.675 m³; yağış 224 mm). **Fark 1.347 m³** (≈ %18).
- En kurak sezon yağışı 2021 (156 mm), en yağışlı 2023 (252 mm). Yağış kışa düştüğü için sezon suyu yağışla orantısız değişir; yıllar arası fark ET₀ ve yağışın sezon içi dağılımından gelir.
- Damla sulamada olay sayısı 58–67 arasında; toplamlar olay büyüklüğüne (8,9 mm brüt) göre kademelidir, bu yüzden bazı yıllar aynı değerde görünür (7.810 m³ iki yıl).

## 5. Diğer senaryolar (2025 havasıyla)

- **Alışkanlık ↔ plan:** hesaplanmadı — ağaç sayısı yok, süreyi litreye çevirmek mümkün değil (uydurulmaz).
- **Kısıntılı sulama:** yalnız olgunlaşma döneminde (%75): 8.483 → 8.133 m³, **tasarruf 350 m³** (≈ %4,1), **verim riski: düşük**, eşik altı gün 0. Çiçeklenme–meyve tutumu (15 Mar–15 Haz) ve hızlı meyve büyümesi (16 Haz–15 Eyl) **kilitli**: «Bu dönemde önerilmez.» Varsayılan plan değildir.
- **Sistem değişikliği (damla → salma):** 8.483 → 13.396 m³ (**+4.913 m³**), +921 kWh; TL ve geri ödeme yok (tarife ve kurulum bedeli girilmedi; kötüleşme olduğu için geri ödeme zaten hesaplanmaz).

## 6. Sınırlar

- Sonuçlar katalog ön değerlerine bağlıdır; **mühendis onayı yok** (`docs/agro/KURAL-DURUMU.md`).
- Taç örtüsü NDVI'ı 21 gün eski (son net Sentinel-2: 9 Eki). Evergreen narenciyede taç örtüsü mevsimde hızlı değişmediği için sabit alınır.
- `nem_farki` uyarısı gerçek: kova yağıştan sonra dolu görünüyor, ERA5-Land toprak nemi daha kuru (18 mm fark). İkisi farklı modeldir; ölçümle karşılaştırılmalı. Plan ERA5 nemini otomatik uygulamaz.
- Sezon tekrarı kovayı tarla kapasitesinde başlatır (varsayım). Bloklar yok → hesap bahçe düzeyinde.
- Ağaç başına litre / damlatıcı süresi bu bahçede ancak ağaç sayısı beyan edilince görünür; mantık birim testlerde (`test_agac_basi_litre_ve_damlatici_suresi`) ve e2e'de sınanır.
