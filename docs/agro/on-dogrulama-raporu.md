# Olay ön doğrulaması — dağılım raporu (2026-10-29)

Kaynak: Meteostat istasyon **17340 Mersin** (bahçelere ~26 km, günlük gözlem; 2015-01-01 → 2026-02-28 arası 4061 gerçek gözlem günü yazıldı, model/dolgu satırı yok). Kamu kayıtları kataloğu **boş** (doğrulanabilir kaynaklı kayıt bulunamadı). Eşikler: ön değer · mühendis onayı bekliyor (`katalog.yaml › dis_kanit`).

| Bahçe | Olay | Destekleniyor | Çelişiyor | Kanıt yok |
|---|---:|---:|---:|---:|
| jlnnlk | 31 | 9 | 0 | 22 |
| soğuk hava | 28 | 9 | 0 | 19 |

Tür kırılımı (iki bahçede aynı örüntü):

| Tür | Destekleniyor | Çelişiyor | Kanıt yok | Not |
|---|---:|---:|---:|---|
| Aşırı yağış | 7 / 7 | 0 | 0 | günlük 40–107 mm gözlendi |
| Don | 2 / 8 | 0 | 6 | 6 olayda istasyon min 0,7–2,8 °C (kıyı istasyonu, ~26 km): ne destek (≤ 0 °C) ne çelişki (≥ 5 °C) → «kanıt yok» |
| Rüzgâr, optik, radar | 0 | 0 | 10 + 2–4 + 1–2 | istasyon ölçümü yok; kamu kaydı da yok |

Yorum: sonuç «çelişiyor» çıkmadı; don olaylarının çoğu sınırda kaldığı için üreticiye yönlendirilir (**doğrulanacak**: jlnnlk 22, soğuk hava 19). Uzun pencereli olaylarda (`bitis` uzadığında) pencere içindeki en düşük değer alınır; bu destek tarafında cömert, çelişki tarafında muhafazakârdır (tüm istasyonlar tüm pencerede ≥ 5 °C olmalı). Kıyıdaki tek istasyon yüksek rakımlı bahçe donunu temsil etmez: eşik ve istasyon sayısı mühendis onayına bağlıdır.
