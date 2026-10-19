# Olay doğrulama listesi (çiftçi için)

Oluşturma: 2026-10-19 · Kaynak: olay motoru (ADR 0018, formül olay-v2). Eşikler ön değerdir; mühendis onayı bekliyor.

**Nasıl kullanılır:** «Çiftçi doğrulaması» sütununa her olay için **gerçekleşti**, **gerçekleşmedi** ya da **bilinmiyor** yazın. Tarihler uydu geçiş ve ERA5 günlük tarihleridir; gerçek olay birkaç gün önce/sonra olabilir. Don, yağış ve rüzgâr olayları 9–31 km ERA5 ızgarasından gelir (bahçeye birebir ölçüm değildir); rüzgâr hamlesi ERA5'te düşük çıkar, bu yüzden güven düşüktür.

**Güven:** yüksek = birden çok kaynak ailesi (ör. hava + uydu) aynı pencerede; orta = tek güvenilir kaynak; düşük = tek kaynak ve zayıf (geçmiş rüzgâr).

## jlnnlk (15,1 da)

Olay: 31 · atmosfer şüphesi (olay değil): 6

### Olaylar

| # | Tarih | Tür | Güven | Kaynaklar | Çiftçi doğrulaması |
|---|---|---|---|---|---|
| 1 | 06.01.2015 – 10.01.2015 | Don + kuvvetli rüzgâr | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -1,0 °C (2 gün); ERA5 hamle (31 km, düşük güven): en çok 64 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 2 | 01.01.2016 – 03.01.2016 | Don (şiddetli) | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -4,5 °C (3 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 3 | 25.01.2016 – 09.02.2016 | Don + optik hasar izi | yüksek | ERA5-Land saatlik 2 m sıcaklık: en düşük -1,5 °C (2 gün); Sentinel-2 NDVI 30.01.2016 → 09.02.2016, Δ NDVI -0,22 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 4 | 05.03.2016 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 61 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 5 | 14.07.2016 | Radar değişimi | orta | Sentinel-1 yörünge 167 14.07.2016: artış 2,4 dB, 4,2 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 6 | 22.12.2016 – 23.12.2016 | Aşırı yağış + kuvvetli rüzgâr | orta | ERA5 saatlik yağış: 24 saatte en çok 55,3 mm; ERA5 hamle (31 km, düşük güven): en çok 65 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 7 | 29.12.2016 – 30.12.2016 | Aşırı yağış | orta | ERA5 saatlik yağış: 24 saatte en çok 63,3 mm | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 8 | 31.01.2017 – 01.02.2017 | Don | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -1,1 °C (2 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 9 | 15.02.2017 | Don | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -0,1 °C (1 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 10 | 12.09.2017 – 26.09.2017 | Ani düşüş (optik) | orta | Sentinel-2 NDVI 11.09.2017 → 26.09.2017, Δ NDVI -0,16 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 11 | 18.01.2018 – 19.01.2018 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 73 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 12 | 24.03.2018 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 64 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 13 | 17.04.2018 | Radar değişimi | orta | Sentinel-1 yörünge 167 17.04.2018: azalış 2,6 dB, 4,2 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 14 | 06.12.2018 – 12.12.2018 | Aşırı yağış + kuvvetli rüzgâr | orta | ERA5 saatlik yağış: 24 saatte en çok 89,8 mm; ERA5 hamle (31 km, düşük güven): en çok 63 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 15 | 04.01.2019 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 63 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 16 | 15.01.2019 – 16.01.2019 | Aşırı yağış + kuvvetli rüzgâr | orta | ERA5 saatlik yağış: 24 saatte en çok 53,3 mm; ERA5 hamle (31 km, düşük güven): en çok 76 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 17 | 15.10.2019 | Radar değişimi | orta | Sentinel-1 yörünge 167 15.10.2019: artış 2,3 dB, 4,2 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 18 | 24.12.2019 | Aşırı yağış | orta | ERA5 saatlik yağış: 24 saatte en çok 53,9 mm | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 19 | 30.12.2019 – 31.12.2019 | Aşırı yağış | orta | ERA5 saatlik yağış: 24 saatte en çok 52,7 mm | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 20 | 07.01.2020 – 13.01.2020 | Aşırı yağış + radar değişimi | yüksek | ERA5 saatlik yağış: 24 saatte en çok 88,8 mm; Sentinel-1 yörünge 167 13.01.2020: azalış 2,5 dB, 6,1 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 21 | 06.02.2020 – 19.03.2020 | Don + optik hasar izi (şiddetli) | yüksek | ERA5-Land saatlik 2 m sıcaklık: en düşük -2,6 °C (3 gün); ERA5 hamle (31 km, düşük güven): en çok 65 km/s; Sentinel-2 NDVI 18.02.2020 → 19.03.2020, Δ NDVI -0,12 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 22 | 18.02.2020 | Radar değişimi | orta | Sentinel-1 yörünge 167 18.02.2020: azalış 2,6 dB, 5,1 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 23 | 13.03.2020 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 66 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 24 | 20.03.2020 – 29.03.2020 | Ani düşüş (optik) | orta | Sentinel-2 NDVI 19.03.2020 → 29.03.2020, Δ NDVI -0,12 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 25 | 13.01.2021 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 63 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 26 | 17.03.2021 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 65 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 27 | 13.03.2022 – 13.04.2022 | Don + optik hasar izi (şiddetli) | yüksek | ERA5-Land saatlik 2 m sıcaklık: en düşük -2,0 °C (3 gün); Sentinel-2 NDVI 14.03.2022 → 13.04.2022, Δ NDVI -0,13 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 28 | 29.03.2023 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 62 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 29 | 26.11.2023 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 78 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 30 | 17.02.2025 – 13.03.2025 | Don + optik hasar izi (şiddetli) | yüksek | ERA5-Land saatlik 2 m sıcaklık: en düşük -4,9 °C (2 gün); Sentinel-2 NDVI 16.02.2025 → 13.03.2025, Δ NDVI -0,10 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 31 | 13.02.2026 – 18.02.2026 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 71 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |

### Atmosfer şüpheleri (olay sayılmadı; bilgi için)

| # | Tarih | Neden olay sayılmadı | Kaynaklar |
|---|---|---|---|
| 1 | 03.09.2015 – 12.09.2015 | bahçenin >%90'ı düştü, hava/radar/don desteği yok | Sentinel-2 NDVI 02.09.2015 → 12.09.2015, Δ NDVI -0,23 |
| 2 | 20.04.2016 – 29.04.2016 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 19.04.2016 → 29.04.2016, Δ NDVI -0,13 |
| 3 | 24.01.2021 – 12.02.2021 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 23.01.2021 → 12.02.2021, Δ NDVI -0,11 |
| 4 | 10.12.2021 – 24.12.2021 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 09.12.2021 → 24.12.2021, Δ NDVI -0,10 |
| 5 | 19.04.2023 – 18.05.2023 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 18.04.2023 → 18.05.2023, Δ NDVI -0,12 |
| 6 | 08.05.2024 – 22.05.2024 | bahçenin >%90'ı düştü, hava/radar/don desteği yok | Sentinel-2 NDVI 07.05.2024 → 22.05.2024, Δ NDVI -0,14 |

## soğuk hava (25,1 da)

Olay: 28 · atmosfer şüphesi (olay değil): 7

### Olaylar

| # | Tarih | Tür | Güven | Kaynaklar | Çiftçi doğrulaması |
|---|---|---|---|---|---|
| 1 | 06.01.2015 – 10.01.2015 | Don + kuvvetli rüzgâr | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -1,0 °C (2 gün); ERA5 hamle (31 km, düşük güven): en çok 64 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 2 | 01.01.2016 – 03.01.2016 | Don (şiddetli) | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -4,5 °C (3 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 3 | 25.01.2016 – 26.01.2016 | Don | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -1,5 °C (2 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 4 | 05.03.2016 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 61 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 5 | 22.12.2016 – 23.12.2016 | Aşırı yağış + kuvvetli rüzgâr | orta | ERA5 saatlik yağış: 24 saatte en çok 55,3 mm; ERA5 hamle (31 km, düşük güven): en çok 65 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 6 | 29.12.2016 – 30.12.2016 | Aşırı yağış | orta | ERA5 saatlik yağış: 24 saatte en çok 63,3 mm | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 7 | 31.01.2017 – 01.02.2017 | Don | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -1,1 °C (2 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 8 | 15.02.2017 | Don | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -0,1 °C (1 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 9 | 18.01.2018 – 19.01.2018 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 73 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 10 | 24.03.2018 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 64 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 11 | 06.12.2018 – 12.12.2018 | Aşırı yağış + kuvvetli rüzgâr | orta | ERA5 saatlik yağış: 24 saatte en çok 89,8 mm; ERA5 hamle (31 km, düşük güven): en çok 63 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 12 | 04.01.2019 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 63 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 13 | 15.01.2019 – 16.01.2019 | Aşırı yağış + kuvvetli rüzgâr | orta | ERA5 saatlik yağış: 24 saatte en çok 53,3 mm; ERA5 hamle (31 km, düşük güven): en çok 76 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 14 | 08.12.2019 | Radar değişimi | orta | Sentinel-1 yörünge 167 08.12.2019: azalış 2,9 dB, 12,0 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 15 | 20.12.2019 – 24.12.2019 | Aşırı yağış + radar değişimi | yüksek | ERA5 saatlik yağış: 24 saatte en çok 53,9 mm; Sentinel-1 yörünge 167 20.12.2019: azalış 2,6 dB, 6,5 da | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 16 | 30.12.2019 – 31.12.2019 | Aşırı yağış | orta | ERA5 saatlik yağış: 24 saatte en çok 52,7 mm | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 17 | 07.01.2020 – 08.01.2020 | Aşırı yağış | orta | ERA5 saatlik yağış: 24 saatte en çok 88,8 mm | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 18 | 06.02.2020 – 11.02.2020 | Don + kuvvetli rüzgâr (şiddetli) | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -2,6 °C (3 gün); ERA5 hamle (31 km, düşük güven): en çok 65 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 19 | 13.03.2020 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 66 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 20 | 13.01.2021 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 63 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 21 | 17.03.2021 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 65 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 22 | 13.03.2022 – 13.04.2022 | Don + optik hasar izi (şiddetli) | yüksek | ERA5-Land saatlik 2 m sıcaklık: en düşük -2,0 °C (3 gün); Sentinel-2 NDVI 14.03.2022 → 13.04.2022, Δ NDVI -0,31 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 23 | 29.03.2023 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 62 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 24 | 26.11.2023 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 78 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 25 | 28.01.2025 – 01.02.2025 | Ani düşüş (optik) | orta | Sentinel-2 NDVI 27.01.2025 → 01.02.2025, Δ NDVI -0,11 | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 26 | 22.02.2025 – 23.02.2025 | Don (şiddetli) | orta | ERA5-Land saatlik 2 m sıcaklık: en düşük -4,9 °C (2 gün) | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 27 | 13.02.2026 – 18.02.2026 | Kuvvetli rüzgâr | düşük | ERA5 hamle (31 km, düşük güven): en çok 71 km/s | gerçekleşti / gerçekleşmedi / bilinmiyor |
| 28 | 12.03.2026 | Radar değişimi | orta | Sentinel-1 yörünge 167 12.03.2026: azalış 2,7 dB, 5,3 da | gerçekleşti / gerçekleşmedi / bilinmiyor |

### Atmosfer şüpheleri (olay sayılmadı; bilgi için)

| # | Tarih | Neden olay sayılmadı | Kaynaklar |
|---|---|---|---|
| 1 | 03.09.2015 – 12.09.2015 | sonraki net görüntü gelmedi (30 gün içinde teyit yok) | Sentinel-2 NDVI 02.09.2015 → 12.09.2015, Δ NDVI -0,13 |
| 2 | 21.03.2019 – 04.04.2019 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 20.03.2019 → 04.04.2019, Δ NDVI -0,14 |
| 3 | 13.08.2019 – 27.08.2019 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 12.08.2019 → 27.08.2019, Δ NDVI -0,14 |
| 4 | 20.03.2020 – 13.04.2020 | bahçenin >%90'ı düştü, hava/radar/don desteği yok | Sentinel-2 NDVI 19.03.2020 → 13.04.2020, Δ NDVI -0,15 |
| 5 | 02.08.2021 – 21.08.2021 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 01.08.2021 → 21.08.2021, Δ NDVI -0,10 |
| 6 | 19.04.2023 – 18.05.2023 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 18.04.2023 → 18.05.2023, Δ NDVI -0,11 |
| 7 | 08.05.2024 – 22.05.2024 | sonraki görüntüde toparlandı | Sentinel-2 NDVI 07.05.2024 → 22.05.2024, Δ NDVI -0,11 |
