# Olay ön doğrulaması — dağılım raporu (2026-10-29, düzeltilmiş)

Kaynak: Meteostat istasyon **17340 Mersin** (bahçelere ~26 km, 3 m rakım, kıyı). Bu rapor ilk sürümün (bkz. ADR 0021 «Düzeltme») yerine geçer: ilk sürüm eski toplu dosyayı (`bulk.meteostat.net/v2`, Mart 2026'da donmuş) kullanıyor ve değer-bazında kaynak bilgisi olmadığından model dolgu değerlerini gözlem sayıyordu. Şimdi `data.meteostat.net` kullanılır: her değerin kaynağı (`ghcnd` = yerinde ölçüm, `metno_forecast` = tahmin) yazılıdır, yalnız ölçümler sayılır. İstasyon gözlemi **2015-01-09 → 2026-10-20**, 3755 gün (tmin %87, yağış %81). Kamu kayıtları kataloğu: 2 satır, ikisi de **il düzeyi**.

Dört sonuç: **destekleniyor** · **çelişiyor** · **belirsiz** (veri var, eşikler arasında) · **kanıt yok** (pencerede hiç bağımsız veri yok).

| Bahçe | Olay | Destekleniyor | Çelişiyor | Belirsiz | Kanıt yok |
|---|---:|---:|---:|---:|---:|
| jlnnlk | 31 | 8 | 1 | 6 | 16 |
| soğuk hava | 28 | 9 | 1 | 6 | 12 |

Tür kırılımı (jlnnlk; soğuk hava aynı, tek fark aşağıda):

| Tür | Destekleniyor | Çelişiyor | Belirsiz | Kanıt yok | Not |
|---|---:|---:|---:|---:|---|
| Don | 3 | 0 | 5 | 0 | destek: 2015-01, 2016-01-25, 2025-02 (son ikisinde istasyon min 0,0 / 0,7 °C; 2025'te il düzeyi kamu kaydıyla); belirsiz: istasyon min 0,8–2,8 °C |
| Aşırı yağış | 5 | 1 | 1 | 0 | çelişen: 29–30.12.2016, istasyon en çok 1,3 mm; belirsiz: 15–16.01.2019, 9,4 mm; 07.01.2020 olayı istasyon (88,6 mm) + il düzeyi kamu kaydıyla destekleniyor |
| Rüzgâr | 0 | 0 | 0 | 10 | istasyon ölçümü ve kamu kaydı yok |
| Optik, radar | 0 | 0 | 0 | 2 + 4 | soğuk hava'da bir optik olay (28.01–01.02.2025) il düzeyi don kaydıyla desteklenir |

Yorumlar:
- **Yağış çelişkisi gerçek bir sinyaldir** ama tek, kıyıdaki istasyondan gelir (26 km): yerel sağanak istasyona uğramamış olabilir. Üretici listesinde ilk sırada çıkar.
- Don olaylarının çoğu «belirsiz»: kıyı istasyonunda 0–5 °C, bahçede (yüksek) don olması mümkün; eşik (≥ 5 °C = çelişki) bu yüzden muhafazakâr.
- Uzun pencereli olaylarda (`bitis` uzamış) pencere içindeki en düşük/en yüksek değer alınır: destek tarafında cömert, çelişki tarafında muhafazakâr (tüm istasyonlar tüm pencerede ≥ 5 °C / ≤ 5 mm olmalı).
- Eşikler ön değer · mühendis onayı bekliyor.
