# Değişim anomalisi raporu (yalnız rapor — kural değişmedi)

Üretim: 18.10.2026. Soru: dona bağlanan S2 aday düşüşü, **diğer yılların aynı takvim penceresindeki** (±15 gün) Δ dağılımının p10'unun altında mı? Δ = ardışık iki net S2 görüntüsü arasında bahçe piksellerinin ortanca ΔNDVI'si. Karşılaştırma örneği: diğer yıllarda son tarihi aynı pencereye düşen çiftler.

### jlnnlk

Net S2 çifti: 241; don olayı: 9.

| Don (bitiş) | Bağlanan S2 çifti | Δ NDVI (bahçe ortancası) | Diğer yıllar aynı pencere: n | p10 | medyan | Δ ≤ p10? |
|---|---|---|---|---|---|---|
| 10.01.2015 | çift yok (pencerede net görüntü yok) | — | — | — | — | — |
| 03.01.2016 | 21.12.2015 → 10.01.2016 | -0,007 | 15 | -0,039 | 0,007 | hayır |
| 26.01.2016 | 10.01.2016 → 30.01.2016 | 0,008 | 16 | -0,068 | -0,021 | hayır |
| 01.02.2017 | 03.02.2017 → 23.02.2017 | 0,001 | 15 | -0,076 | -0,024 | hayır |
| 15.02.2017 | 03.02.2017 → 23.02.2017 | 0,001 | 15 | -0,076 | -0,024 | hayır |
| 11.02.2020 | 24.01.2020 → 18.02.2020 | -0,051 | 15 | -0,076 | -0,005 | hayır |
| 14.03.2022 | 12.02.2022 → 14.03.2022 | -0,032 | 15 | -0,088 | -0,019 | hayır |
| 16.03.2022 | 14.03.2022 → 13.04.2022 | -0,127 | 21 | -0,065 | 0,005 | evet |
| 23.02.2025 | 16.02.2025 → 13.03.2025 | -0,103 | 12 | -0,053 | -0,013 | evet |

### soğuk hava

Net S2 çifti: 240; don olayı: 9.

| Don (bitiş) | Bağlanan S2 çifti | Δ NDVI (bahçe ortancası) | Diğer yıllar aynı pencere: n | p10 | medyan | Δ ≤ p10? |
|---|---|---|---|---|---|---|
| 10.01.2015 | çift yok (pencerede net görüntü yok) | — | — | — | — | — |
| 03.01.2016 | 21.12.2015 → 10.01.2016 | -0,013 | 15 | -0,035 | 0,012 | hayır |
| 26.01.2016 | 10.01.2016 → 30.01.2016 | -0,016 | 16 | -0,055 | -0,013 | hayır |
| 01.02.2017 | 03.02.2017 → 23.02.2017 | -0,035 | 15 | -0,060 | -0,029 | hayır |
| 15.02.2017 | 03.02.2017 → 23.02.2017 | -0,035 | 15 | -0,060 | -0,029 | hayır |
| 11.02.2020 | 24.01.2020 → 18.02.2020 | -0,029 | 15 | -0,059 | -0,019 | hayır |
| 14.03.2022 | 12.02.2022 → 14.03.2022 | -0,000 | 15 | -0,109 | -0,036 | hayır |
| 16.03.2022 | 14.03.2022 → 13.04.2022 | -0,262 | 20 | -0,131 | -0,008 | evet |
| 23.02.2025 | 16.02.2025 → 13.03.2025 | -0,069 | 12 | -0,077 | -0,026 | hayır |
## Yorum (kural değişikliği DEĞİL — yalnız gözlem)

- **Mart 2022 (16.03 donu → 14.03–13.04 çifti):** her iki bahçede de Δ, diğer yılların aynı pencere p10'unun belirgin altında (jlnnlk −0,127 / p10 −0,065; soğuk hava −0,262 / p10 −0,131). Bu pencerede değişim anomalisi testi, mevcut piksel tabanlı kuralın sonucunu destekliyor.
- **Şubat 2025 (23.02 donu → 16.02–13.03 çifti):** jlnnlk'ta Δ p10'un altında (−0,103 / −0,053), soğuk havada değil (−0,069 / −0,077). Yani anomali yalnız jlnnlk'ta var; piksel kuralı bu çift için olay üretmemişti (optik iz yok) — pencere/örnek sayısı n=12.
- **Ocak 2016:** bahçe ortancası Δ'sı sıra dışı DEĞİL (jlnnlk −0,007 ve +0,008; p10 −0,039 / −0,068). Piksel kuralıyla bulunan «don + optik hasar izi» bahçe geneline değil yerel bir yamaya dayanır; bahçe ortancası bu yamayı seyreltir. Bu test tek başına bu olayı doğrulayamaz — yama düzeyinde (patch medyan Δ) karşılaştırma ayrı bir ölçüm olurdu.
- Bu rapor eşik/kural değiştirmez; test, ileride «ikinci bağımsız doğrulama» olarak değerlendirilebilir (mühendis onayı bekliyor).
