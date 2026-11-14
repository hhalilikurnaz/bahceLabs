# Don olayları — yeniden değerlendirme (`don-yd-1`)

Kural: sapma düzeltmesi YOK; model olay en düşüğü ↔ ölçüm kaynaklı istasyon gözlemi (≤ 80 km, ≤ 3); `model_sapmasi_olasi` = istasyon > 0 °C ve model istasyondan ≥ σ (2.4 K) soğuk. Olaylar SİLİNMEDİ/DEĞİŞTİRİLMEDİ; işaret `olay_yeniden_degerlendirme` tablosunda. Kullanıcı doğrulamalı olaylar atlandı: 0.

Değerlendirilen: 16 · eski ön yargıdan farklı etiket: 8.

| Bahçe | Olay | Model en düşük (°C) | İstasyon en düşük (°C) | Eski ön yargı | Yeni sonuç | Etiket değişti |
|---|---|---:|---:|---|---|---|
| jlnnlk | 2015-01-06 → 2015-01-10 | -1.0 | -0.4 | destekleniyor | **istasyon_destekliyor** | hayır |
| jlnnlk | 2016-01-01 → 2016-01-03 | -4.5 | 0.9 | belirsiz | **model_sapmasi_olasi** | evet |
| jlnnlk | 2016-01-25 → 2016-02-09 | -1.5 | 0.0 | destekleniyor | **istasyon_destekliyor** | hayır |
| jlnnlk | 2017-01-31 → 2017-02-01 | -1.1 | 0.8 | belirsiz | **belirsiz** | hayır |
| jlnnlk | 2017-02-15 → 2017-02-15 | -0.1 | 2.8 | belirsiz | **model_sapmasi_olasi** | evet |
| jlnnlk | 2020-02-06 → 2020-03-19 | -2.6 | 1.9 | belirsiz | **model_sapmasi_olasi** | evet |
| jlnnlk | 2022-03-13 → 2022-04-13 | -2.0 | 2.2 | belirsiz | **model_sapmasi_olasi** | evet |
| jlnnlk | 2025-02-17 → 2025-03-13 | -4.9 | 0.7 | destekleniyor | **dis_kayit_destekliyor** | hayır |
| soğuk hava | 2015-01-06 → 2015-01-10 | -1.0 | -0.4 | destekleniyor | **istasyon_destekliyor** | hayır |
| soğuk hava | 2016-01-01 → 2016-01-03 | -4.5 | 0.9 | belirsiz | **model_sapmasi_olasi** | evet |
| soğuk hava | 2016-01-25 → 2016-01-26 | -1.5 | 0.0 | destekleniyor | **istasyon_destekliyor** | hayır |
| soğuk hava | 2017-01-31 → 2017-02-01 | -1.1 | 0.8 | belirsiz | **belirsiz** | hayır |
| soğuk hava | 2017-02-15 → 2017-02-15 | -0.1 | 2.8 | belirsiz | **model_sapmasi_olasi** | evet |
| soğuk hava | 2020-02-06 → 2020-02-11 | -2.6 | 1.9 | belirsiz | **model_sapmasi_olasi** | evet |
| soğuk hava | 2022-03-13 → 2022-04-13 | -2.0 | 2.2 | belirsiz | **model_sapmasi_olasi** | evet |
| soğuk hava | 2025-02-22 → 2025-02-23 | -4.9 | 0.7 | destekleniyor | **dis_kayit_destekliyor** | hayır |
