# Stres yaması: yıl yıl kaç yama? (alarm sağanağı denetimi)

Kural (katalog `saha`, ön değer · mühendis onayı bekliyor): görüntünün KENDİ dağılımının alt %10'unun altında bitişik yama; ≥ 1 da ve alt %10'daki piksellerin ≥ %50'ini içeren küme. «Yamalı görüntü» = kuralın o görüntüde yama bulduğu sahne sayısı; «bölüm» = ardışık (≤ 30 gün, merkezler ≤ 60 m) yamalı görüntüler tek olgu sayılır.

**Önemli:** saha turuna yalnız **en son** net görüntüdeki yama girer (geçmiş yamalar tura düşmez); bu rapor kuralın geçmişte ne kadar sık tetiklendiğini ölçer.

## jlnnlk

| Yıl | Net görüntü | Yamalı görüntü | Pay | Bölüm | Ortanca yama alanı (da) |
|---|---|---|---|---|---|
| 2015 | 7 | 3 | %43 | 1 | 1,3 |
| 2016 | 23 | 2 | %9 | 2 | 1,4 |
| 2017 | 20 | 2 | %10 | 1 | 1,0 |
| 2018 | 21 | 3 | %14 | 2 | 1,0 |
| 2019 | 23 | 3 | %13 | 3 | 1,2 |
| 2020 | 23 | 4 | %17 | 3 | 1,2 |
| 2021 | 21 | 6 | %29 | 2 | 1,4 |
| 2022 | 22 | 2 | %9 | 1 | 1,0 |
| 2023 | 22 | 5 | %23 | 5 | 1,0 |
| 2024 | 24 | 10 | %42 | 3 | 1,3 |
| 2025 | 24 | 13 | %54 | 3 | 1,1 |
| 2026 | 17 | 4 | %24 | 2 | 1,0 |

**Toplam:** 247 net görüntüde 57 yamalı görüntü (%23), 28 bölüm → yılda ortalama 2,3 bölüm.

## soğuk hava

| Yıl | Net görüntü | Yamalı görüntü | Pay | Bölüm | Ortanca yama alanı (da) |
|---|---|---|---|---|---|
| 2015 | 7 | 1 | %14 | 1 | 2,4 |
| 2016 | 23 | 2 | %9 | 2 | 1,5 |
| 2017 | 20 | 3 | %15 | 3 | 1,4 |
| 2018 | 21 | 0 | %0 | 0 | — |
| 2019 | 23 | 4 | %17 | 4 | 1,6 |
| 2020 | 22 | 4 | %18 | 3 | 1,3 |
| 2021 | 21 | 3 | %14 | 2 | 1,8 |
| 2022 | 22 | 2 | %9 | 2 | 1,5 |
| 2023 | 22 | 1 | %5 | 1 | 1,3 |
| 2024 | 24 | 2 | %8 | 2 | 1,3 |
| 2025 | 24 | 2 | %8 | 2 | 1,4 |
| 2026 | 17 | 6 | %35 | 1 | 1,5 |

**Toplam:** 246 net görüntüde 30 yamalı görüntü (%12), 23 bölüm → yılda ortalama 1,9 bölüm.
## Değerlendirme (alarm sağanağı var mı?)

- **Sağanak yok.** İki bahçede 11,8 yılda 28 ve 23 bölüm: yılda ortalama ~2 ayrı olgu. Bir görüntüde yama bulunma payı %12 (soğuk hava) ve %23 (jlnnlk); en kötü yıl jlnnlk 2025 (%54, 13/24 görüntü, 3 bölüm — aynı yerde sürüp giden yamalar).
- Saha turuna **yalnız en son** net görüntüdeki yama girer, geçmiş yamalar girmez; ayrıca ziyaret edilen nokta turdan düşer. Yani çiftçinin önüne bir seferde en çok 1 stres yaması gelir (doğrulama bekleyen olaylar ve zayıf kesimle birlikte en çok 12 nokta).
- jlnnlk 2024–2025'te yamalı görüntü payının yükselmesi (%42, %54) bahçenin o dönemde kendi içinde daha heterojen olduğunu gösteriyor; Saha Defteri doğrulaması bu yamaların gerçek bir sorun mu (sulama, hastalık, eksik ağaç) yoksa sadece normal iç değişkenlik mi olduğunu söyleyecek. Doğrulama gelene kadar eşik (alt %10, ≥ 1 da, küme ≥ %50) ön değerdir.
- Eşik katalogda: `saha.stres_yuzdelik`, `saha.stres_min_da`, `saha.stres_kume_orani` (hepsi ön değer · mühendis onayı bekliyor).
