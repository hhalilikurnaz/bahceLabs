# Değişim anomalisi — kural olarak eklendi (yalnız dona bağlı adaylar)

Üretim: 29.10.2026. Soru: dona bağlanan S2 aday düşüşü, **diğer yılların aynı takvim penceresindeki** (±15 gün) Δ dağılımının p10'unun altında mı? Δ = ardışık iki net S2 görüntüsü arasında bahçe piksellerinin ortanca ΔNDVI'si. Karşılaştırma örneği: diğer yıllarda son tarihi aynı pencereye düşen çiftler.

### jlnnlk

Net S2 çifti: 241; don olayı: 9.

| Don (bitiş) | Bağlanan S2 çifti | Δ NDVI (bahçe ortancası) | Diğer yıllar aynı pencere: n | p10 | medyan | Δ < p10? | Motorun kararı (kural) |
|---|---|---|---|---|---|---|---|
| 10.01.2015 | çift yok (pencerede net görüntü yok) | — | — | — | — | — | olay yok |
| 03.01.2016 | 21.12.2015 → 10.01.2016 | -0,007 | 15 | -0,039 | 0,007 | hayır | aday yok |
| 03.01.2016 | 10.01.2016 → 30.01.2016 | 0,008 | 16 | -0,068 | -0,021 | hayır | aday yok |
| 26.01.2016 | 10.01.2016 → 30.01.2016 | 0,008 | 16 | -0,068 | -0,021 | hayır | aday yok |
| 26.01.2016 | 30.01.2016 → 09.02.2016 | -0,193 | 18 | -0,063 | -0,034 | evet | olay (yama yolu) |
| 26.01.2016 | 09.02.2016 → 19.02.2016 | -0,005 | 13 | -0,052 | -0,019 | hayır | aday yok |
| 01.02.2017 | 03.02.2017 → 23.02.2017 | 0,001 | 15 | -0,076 | -0,024 | hayır | aday yok |
| 15.02.2017 | 03.02.2017 → 23.02.2017 | 0,001 | 15 | -0,076 | -0,024 | hayır | aday yok |
| 15.02.2017 | 23.02.2017 → 05.03.2017 | 0,086 | 14 | -0,088 | -0,037 | hayır | aday yok |
| 15.02.2017 | 05.03.2017 → 25.03.2017 | 0,047 | 21 | -0,103 | -0,024 | hayır | aday yok |
| 11.02.2020 | 24.01.2020 → 18.02.2020 | -0,051 | 15 | -0,076 | -0,005 | hayır | aday yok |
| 11.02.2020 | 18.02.2020 → 19.03.2020 | -0,121 | 22 | -0,065 | -0,018 | evet | olay (anomali yolu) |
| 14.03.2022 | 12.02.2022 → 14.03.2022 | -0,032 | 15 | -0,088 | -0,019 | hayır | aday yok |
| 14.03.2022 | 14.03.2022 → 13.04.2022 | -0,127 | 21 | -0,065 | 0,005 | evet | olay (anomali yolu) |
| 16.03.2022 | 14.03.2022 → 13.04.2022 | -0,127 | 21 | -0,065 | 0,005 | evet | olay (anomali yolu) |
| 23.02.2025 | 16.02.2025 → 13.03.2025 | -0,103 | 12 | -0,053 | -0,013 | evet | olay (anomali yolu) |
| 23.02.2025 | 13.03.2025 → 23.03.2025 | 0,026 | 20 | -0,070 | -0,024 | hayır | aday yok |

**Yol tanısı** (dona bağlı ve en az bir yolda aday olan çiftler; kalıcılık her yolda KENDİ ölçüsüyle):

| Çift | Bahçe ortancası Δ | Diğer yıllar p10 (n) | Sonraki sahne | Δ önceki→sonraki | Düşüşün korunan payı | Yama yolu (alan · Δ · kalıcı) | Anomali yolu (anomali · kalıcı) | Seçilen yol |
|---|---|---|---|---|---|---|---|---|
| 30.01.2016 → 09.02.2016 | -0,193 | -0,063 (18) | 19.02.2016 | -0,206 | %107 | 12,1 da · -0,220 · evet | evet · evet | yama |
| 18.02.2020 → 19.03.2020 | -0,121 | -0,065 (22) | 29.03.2020 | -0,184 | %152 | yok | evet · evet | anomali |
| 14.03.2022 → 13.04.2022 | -0,127 | -0,065 (21) | 23.04.2022 | -0,101 | %79 | yok | evet · evet | anomali |
| 16.02.2025 → 13.03.2025 | -0,103 | -0,053 (12) | 23.03.2025 | -0,074 | %72 | 12,6 da · -0,105 · hayır | evet · evet | anomali |

### soğuk hava

Net S2 çifti: 240; don olayı: 9.

| Don (bitiş) | Bağlanan S2 çifti | Δ NDVI (bahçe ortancası) | Diğer yıllar aynı pencere: n | p10 | medyan | Δ < p10? | Motorun kararı (kural) |
|---|---|---|---|---|---|---|---|
| 10.01.2015 | çift yok (pencerede net görüntü yok) | — | — | — | — | — | olay yok |
| 03.01.2016 | 21.12.2015 → 10.01.2016 | -0,013 | 15 | -0,035 | 0,012 | hayır | aday yok |
| 03.01.2016 | 10.01.2016 → 30.01.2016 | -0,016 | 16 | -0,055 | -0,013 | hayır | aday yok |
| 26.01.2016 | 10.01.2016 → 30.01.2016 | -0,016 | 16 | -0,055 | -0,013 | hayır | aday yok |
| 26.01.2016 | 30.01.2016 → 09.02.2016 | -0,043 | 18 | -0,061 | -0,026 | hayır | aday yok |
| 26.01.2016 | 09.02.2016 → 19.02.2016 | -0,051 | 13 | -0,059 | -0,019 | hayır | aday yok |
| 01.02.2017 | 03.02.2017 → 23.02.2017 | -0,035 | 15 | -0,060 | -0,029 | hayır | aday yok |
| 15.02.2017 | 03.02.2017 → 23.02.2017 | -0,035 | 15 | -0,060 | -0,029 | hayır | aday yok |
| 15.02.2017 | 23.02.2017 → 05.03.2017 | 0,038 | 14 | -0,077 | -0,030 | hayır | aday yok |
| 15.02.2017 | 05.03.2017 → 25.03.2017 | 0,015 | 20 | -0,129 | -0,027 | hayır | aday yok |
| 11.02.2020 | 24.01.2020 → 18.02.2020 | -0,029 | 15 | -0,059 | -0,019 | hayır | aday yok |
| 11.02.2020 | 18.02.2020 → 19.03.2020 | -0,080 | 22 | -0,127 | -0,022 | hayır | aday yok |
| 14.03.2022 | 12.02.2022 → 14.03.2022 | -0,000 | 15 | -0,109 | -0,036 | hayır | aday yok |
| 14.03.2022 | 14.03.2022 → 13.04.2022 | -0,262 | 20 | -0,131 | -0,008 | evet | olay (yama yolu) |
| 16.03.2022 | 14.03.2022 → 13.04.2022 | -0,262 | 20 | -0,131 | -0,008 | evet | olay (yama yolu) |
| 23.02.2025 | 16.02.2025 → 13.03.2025 | -0,069 | 12 | -0,077 | -0,026 | hayır | aday yok |
| 23.02.2025 | 13.03.2025 → 23.03.2025 | 0,031 | 19 | -0,129 | -0,023 | hayır | aday yok |

**Yol tanısı** (dona bağlı ve en az bir yolda aday olan çiftler; kalıcılık her yolda KENDİ ölçüsüyle):

| Çift | Bahçe ortancası Δ | Diğer yıllar p10 (n) | Sonraki sahne | Δ önceki→sonraki | Düşüşün korunan payı | Yama yolu (alan · Δ · kalıcı) | Anomali yolu (anomali · kalıcı) | Seçilen yol |
|---|---|---|---|---|---|---|---|---|
| 14.03.2022 → 13.04.2022 | -0,262 | -0,131 (20) | 23.04.2022 | -0,260 | %99 | 5,7 da · -0,306 · evet | evet · evet | yama |

## Yol tanısı ve çapraz eşleşme denetimi

Her dona bağlı çift için **iki yol ayrı ölçülür ve ayrı kalıcılık ölçüsüyle sınanır** (`events.service.s2_scan`; yukarıdaki «Yol tanısı» tabloları bunun çıktısıdır):

- **Yama yolu:** düşüş = piksel yaması (alan, Δ); kalıcılık = yama piksellerinin sonraki görüntüde de dönem p10'u altında kalması.
- **Anomali yolu:** düşüş = bahçe ortancası Δ'sı; kalıcılık = önceki→SONRAKİ ortanca Δ, düşüşün en az yarısı.
- Seçilen yolun sinyali yalnız KENDİ düşüşünü ve KENDİ kalıcılığını taşır: anomali yolu seçildiğinde yamanın alanı/Δ'sı sinyale taşınmaz (`alan_da` boş), yama yolu seçildiğinde anomali bayrakları taşınmaz. Yama kalıcıysa anomali yolunun kalıcılığına bakılmaz; ikisi de kalıcı değilse yama yolunun sonucu (şüphe: toparlandı) kalır. Üç durum da testlidir (`test_each_path_keeps_its_own_drop_and_its_own_persistence_measure`).

### Şub 2025 ve Şub 2020 (jlnnlk) — sayılar

| Çift | Bahçe Δ | Diğer yıllar p10 (n) | Sonraki sahne | Δ önceki→sonraki | Korunan pay | Yama yolu | Anomali yolu | Karar |
|---|---|---|---|---|---|---|---|---|
| 16.02 → 13.03.2025 | −0,103 | −0,053 (12) | 23.03.2025 | −0,074 | %72 | 12,6 da · Δ −0,105 · **kalıcı değil** (piksel yaması toparlanmış) | anomali · **kalıcı** | anomali yolu |
| 18.02 → 19.03.2020 | −0,121 | −0,065 (22) | 29.03.2020 | −0,184 | %152 | yama yok | anomali · **kalıcı** | anomali yolu |

Şub 2025'te geçen turdaki «toparlandı» kararı yama yolunun pikselli ölçüsünden geliyordu; bahçe ortancası ise 10 gün sonra hâlâ düşüşün %72'sini koruyor. Bu fark gerçek: yama toparlanırken bahçenin geneli düşük kalmış. **Şub 2020 çifti 29 günlük** (azami 30): uzun aralıkta mevsimsel gelişim ile hasar ayrışmayabilir; olayın güveni bu yüzden «orta» ve Saha Defteri doğrulaması özellikle bu iki olay için istenmeli.

## Kural (katalog `olay`, ön değer · mühendis onayı bekliyor)

Dona bağlı bir S2 adayı (don bitişinden sonra 0..+21 günde başlayabilen düşüş) için **iki yoldan biri** yeterlidir:

1. **Piksel yaması** (mevcut kural): Δ ≤ −0,08 ve dönem p10 altı, bitişik alan ≥ min(%25, 5 da); **ya da**
2. **Değişim anomalisi:** bahçe ortancası Δ'sı, diğer yılların aynı ±15 gün penceresindeki ardışık çift Δ dağılımının **p10'unun altında** (en az 5 örnek).

**Kalıcılık şartı her yolda aranır:** yama yolunda yama piksellerinin sonraki net görüntüde de dönem p10 altında kalması; anomali yolunda sonraki net görüntüde bahçe ortancasının düşüşün en az yarısını koruması. Biri sağlıyorsa aday kalıcıdır. Dona bağlı olmayan adaylarda anomali yolu KULLANILMAZ (mevsimsel gürültü olay üretmesin). Sonraki görüntü yoksa «doğrulama bekliyor», 30 günden eskiyse şüphe (mevcut mantık).

## Sonuç (iki bahçe)

- **jlnnlk:** olay 31 · atmosfer şüphesi 6 (önceki tur: 31 · 7). Dona bağlı optik iz: Oca 2016 (yama yolu), Şub 2020 (anomali yolu, yeni), Mar 2022 (anomali yolu — önceki turda mevsimsellik diye elenmişti, şimdi diğer yılların p10'unun belirgin altında: −0,127 / −0,065), Şub 2025 (anomali yolu, yeni; piksel yaması sonraki görüntüde toparlanmış görünüyordu, bahçe ortancası düşüşü koruyor).
- **soğuk hava:** olay 28 · şüphe 7 — **değişmedi**. Mart 2022 yama yoluyla bağlı; Şub 2025'te Δ (−0,069) p10'un (−0,077) altına inmiyor, olay yok.
- Oca 2016: bahçe ortancası Δ'sı anomali değil (−0,007 / +0,008); olay, kayması aynı dona bağlı daha sonraki çiftte (30.01→09.02.2016, Δ −0,193) yama yoluyla bulunuyor.
- Çiftçi doğrulaması (Saha Defteri, 9G-B) bu yeni olayların gerçekten olup olmadığını söyleyecek: Şub 2020, Mar 2022 ve Şub 2025 jlnnlk için özellikle sorulmalı.
