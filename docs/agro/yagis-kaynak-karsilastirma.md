# Yağış kaynağı karşılaştırması: Meteostat 17340 ↔ weather_daily ↔ era5_daily ↔ IMERG

Üretim: `bahcelab-backend/scripts/yagis_karsilastirma.py` (yalnız okur). Bahçe: jlnnlk. Referans: **Meteostat 17340 Mersin** gerçek gözlem satırları (`station_daily.prcp`, boş olmayan günler). Islak gün: ≥ 1 mm. Son gözlem: **2026-10-20** (bugünden 9+ gün önce; **27–29 Ekim olayı istasyonda yok**, doğrulanamaz).

## Okuma uyarıları (önce bunlar)
- **İstasyon bahçeden 26 km uzakta, 3 m rakımlı kıyı istasyonu.** Yağış, özellikle konvektif/orografik, 26 km'de çok farklı olabilir. Bu karşılaştırma «hangi seri bahçedeki yağışı bilir» değil, «hangi seri bu referansa daha yakın»dır; **mutlak doğruluk kanıtı değildir.**
- Yağış gözlemi olan gün sayısı sınırlı (son 180 günün yalnız 91 günü); kurak mevsimde toplam küçük olduğundan yüzde sapmalar şişer.
- Karşılaştırılan era5_daily satırları (son 180 gün) **hepsi kesinleşmiş `era5_land`** ({'era5_land': 180}); bugünlerin «model» satırları istasyon verisi bitmeden önce olmadığından **hiç sınanamıyor**.
- `weather_daily` toplam 818 gün (≈ 2,2 yıl, kaynak «arşiv»); 2015'e uzanmaz. IMERG günlük değeri gecikmelidir (son gün 27 Ekim) ve bazı günler boştur.

## 1. Son 180 gün (her seri kendi gözlem-ortak günlerinde, n istasyon ∩ seri)
| Seri | Gün | MAE (mm/gün) | RMSE | Gözlem toplamı (mm) | Seri toplamı (mm) | Toplam sapma | Korelasyon | Islak gün isabeti | Yanlış alarm | CSI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| weather_daily (Hava sekmesi) | 91 | 1,20 | 3,40 | 34,4 | 127,5 | +271% | 0,56 | %75 (3/4) | %15 (13) | 0,18 |
| era5_daily (kova, plan, Su) | 91 | 1,46 | 3,39 | 34,4 | 140,1 | +307% | 0,40 | %75 (3/4) | %28 (24) | 0,11 |
| IMERG (doğrulama) | 91 | 1,08 | 3,34 | 34,4 | 96,3 | +180% | 0,33 | %75 (3/4) | %11 (10) | 0,21 |

## 2. Son 365 gün
| Seri | Gün | MAE (mm/gün) | RMSE | Gözlem toplamı (mm) | Seri toplamı (mm) | Toplam sapma | Korelasyon | Islak gün isabeti | Yanlış alarm | CSI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| weather_daily (Hava sekmesi) | 184 | 0,81 | 2,79 | 88,0 | 183,9 | +109% | 0,56 | %88 (7/8) | %10 (18) | 0,27 |
| era5_daily (kova, plan, Su) | 184 | 1,06 | 2,59 | 88,0 | 239,4 | +172% | 0,64 | %88 (7/8) | %23 (41) | 0,14 |
| IMERG (doğrulama) | 184 | 0,89 | 2,72 | 88,0 | 182,8 | +108% | 0,54 | %88 (7/8) | %12 (22) | 0,23 |

## 3. Tüm ortak dönem (her seri için istasyonla örtüşen tüm günler)
| Seri | Gün | MAE (mm/gün) | RMSE | Gözlem toplamı (mm) | Seri toplamı (mm) | Toplam sapma | Korelasyon | Islak gün isabeti | Yanlış alarm | CSI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| weather_daily (Hava sekmesi) | 570 | 0,78 | 2,96 | 294,2 | 462,5 | +57% | 0,52 | %71 (24/34) | %7 (40) | 0,32 |
| era5_daily (kova, plan, Su) | 3497 | 1,43 | 4,87 | 4228,2 | 4103,1 | -3% | 0,59 | %74 (253/342) | %19 (593) | 0,27 |
| IMERG (doğrulama) | 1343 | 1,00 | 4,03 | 1151,2 | 932,4 | -19% | 0,44 | %48 (54/113) | %6 (70) | 0,30 |

## Bulgular
1. **Kısa pencerede üç seri de istasyondan çok fazla yağış gösteriyor** (son 180 günde +%180 … +%307), yani fark serilerden çok istasyonun temsil gücünden geliyor (26 km, kıyı). Uzun dönemde (3497 gün) ERA5 toplamı istasyonla örtüşüyor (**−%3**), IMERG −%19, weather_daily (570 günde) +%57.
2. **Günlük hata (MAE):** IMERG en düşük (1,08 / 0,89 / 1,00 mm), weather_daily 1,20 / 0,81 / 0,78, ERA5 1,46 / 1,06 / 1,43. Fark küçük ve referans zayıf olduğundan belirleyici değil.
3. **Islak gün tespiti:** yanlış alarm oranı ERA5'te en yüksek (%28 / %23 / %19), IMERG'de en düşük (%11 / %12 / %6); CSI weather_daily ve IMERG'de ERA5'ten iyi (0,18–0,32 ↔ 0,11–0,27).
4. **Kapsam:** yalnız `era5_daily` 2015'ten bugüne kesintisiz (sezon tekrarı, kuru/ıslak yıl sınıflaması ve normal bant için zorunlu) ve ET₀ ve toprak nemiyle aynı veri seti.
5. **Gerçek çelişki** (Hava sekmesi 7 gün 138 mm ↔ Su/plan 91 mm): `weather_daily`/`era5_daily` farkı özellikle 28–29 Ekim'de (27,1/89,8 mm ↔ 16,0/52,6 mm). Bu günlerin gerçeği bu verilerle belirlenemez (istasyon ve IMERG yok).

## Daha yakın referans istasyon var mı? (15 km içi: Erdemli / Silifke MGM AWS)
**Yok.** Meteostat istasyon listesi (`bulk.meteostat.net/v2/stations/lite.json.gz`, 2026-11-03'te indirildi, 15.931 istasyon) jlnnlk merkezine (36,664 K · 34,380 D) göre tarandı: **60 km içinde yalnızca 17340 Mersin (25,9 km)** var; Erdemli ve Silifke (MGM otomatik meteoroloji istasyonları) Meteostat listesinde **bulunmuyor**. 15 km içinde istasyon yok; bu belge bu yüzden 17340 ile üretildi. Daha yakın bir referans için kaynak MGM'nin kendi gözlem verisi ya da bahçe yağış ölçeri olabilir (Saha Defteri «Yağış ölçümü», ADR 0026).

## Karar (ADR 0025)
**Tek seri: `era5_daily`** (IMERG yalnız mevcut kuralla: aylık karşılaştırmada sistematik fark varsa geçmiş günlerde). Hava sekmesinin geçmiş yağış/ET₀ değerleri ve toplamları artık bu seriden gelir; `weather_daily` yalnız sıcaklık içindir. Gerekçe: kapsam, iç tutarlılık (aynı ET₀/nem), uzun dönem toplam sapması en küçük; zayıf yanı (yanlış alarm, son günlerin model değeri) **kaynak satırında** söylenir. Seri değişirse karar bu belgenin yeniden üretilmesiyle gözden geçirilir.
