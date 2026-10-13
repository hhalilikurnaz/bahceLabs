# 0016 — Radar (Sentinel-1) kaynağı, yörünge tutarlılığı ve değişim hesabı (Adım 9D)

Durum: kabul edildi. Tarih: 2026-10-13.

## Bağlam
Optik uydu (Sentinel-2) bulutta göremez; aylarca eksik kalabilir. Radar bulut geçirmez. 9C veri temeli (ADR 0015) üzerine ikinci bir kaynak ekleniyor: **yeni hat açılmaz**, `data_sources` / `acquisitions` / `backfill_months` / `normal_bands` kullanılır.

## Kararlar
1. **Kaynak:** Planetary Computer `sentinel-1-rtc` (radyometrik arazi düzeltmeli γ⁰, VV + VH, 10 m). SAS imzası `planetary_computer.sign` ile alınır; anahtar gerekmez. `data_sources`'ta `sentinel1-rtc` **aktif** (eski «planlı» `sentinel1-grd` satırı kaldırıldı). Arşiv taraması 2015-01-01'den (`acq_radar_start`); PC arşivi Ekim 2014'te başlar.
2. **Sahne = geçiş.** Aynı göreli yörünge + aynı gün; bahçe iki dilime taşarsa dilimler tek sahnede birleştirilir. Kayıtta `yorunge` (göreli yörünge numarası), `gecis_yonu` (iniş | çıkış), `maskeli_oran`, `isleme_surumu` (= yörünge kaynağı: RESORB/POEORB) ve `formul_surumu` bulunur.
3. **Yörünge tutarlılığı (kritik):** radar yansıması bakış geometrisine bağlıdır; **değişim ve normal bant yalnız AYNI göreli yörünge ve geçiş yönü içinde** hesaplanır. Bahçeyi en sık geçen yörünge **birincil** (`radar_orbits`), diğerleri ayrı seri olarak kalır. Birincil yörüngede gösterge ızgaraları (float16) + istatistik; diğer yörüngelerde **yalnız istatistik** (depolama). Üst sınır yok: bir aydaki tüm geçişler edinilir.
4. **Sıklık gerçeği.** Sentinel-1B Aralık 2021'de arızalandı; 2022–2024 arasında bir yörüngenin tekrarı ~12 gün, Sentinel-1C (ve D) ile tekrar ~6 gün. Edinim sayıları bunu olduğu gibi gösterir (Mersin: yılda ~85 geçiş → 2025'te ~135); boşluk doldurulmaz, uydurulmaz.
5. **Gösterge seti** (çekimde hesaplanır): `vh_db`, `vv_db`, `oran_db` (VH − VV, dB farkı), `rvi` = 4·VH/(VV+VH) **doğrusal ölçekte**. Doğrusal ↔ dB dönüşümü tek modülde (`imagery/radar_math.py`), birim testli.
6. **Kumlanma (speckle):** görüntü ızgarası için **Lee filtresi 5×5** (ENL 4,4; `sar:looks_equivalent_number`), geçersiz piksellere duyarlı. **İstatistikler filtresiz (ham) doğrusal değerlerin bahçe ortalamasından** hesaplanır ve en son dB'ye çevrilir (dB ortalaması değil; filtre istatistiği bozmaz). Yüzdelikler doğrusal değerlerden hesaplanıp dB'ye çevrilir (monoton dönüşüm). Formül sürümü `s1rtc-gamma0-v1+lee5`.
7. **Maske (vekil):** PC RTC varlıklarında gölge/üst üste binme bandı **yoktur**. Geçici vekil (katalogda ön değer): VH < −30 dB gölge, VV > +5 dB üst üste binme/doygunluk; nodata, sıfır ve negatifler geçersiz. Sahne başına maskelenen bahçe payı `maskeli_oran` olarak yazılır; **>%30 maskeli sahne değişim hesabına girmez**. Test bahçelerinde ortalama maske %0, en yüksek %6,6. ➜ **Adım 10:** DEM ile yerel geliş açısından **gerçek gölge/üst üste binme maskesi** (şimdiki vekil bunu yakalayamaz).
8. **Normal bant:** birincil yörünge için ay × gösterge p10/p25/ortanca/p75/p90, ham doğrusal ortalamadan (`ortalama`); asgari yıl kuralı ADR 0015'tekiyle aynı (p25–p75 için ≥5, p10–p90 için ≥8 yıl; yetersizse «yetersiz geçmiş»).
9. **Değişim iki katmanlıdır** (birincil yörünge, `change_events`):
   - **Ani değişim:** sahnenin VH dB ızgarası − aynı yörüngedeki **son 3 sahnenin piksel ortancası** (log-oran = dB farkı; tek sahne gürültüsünü azaltır). Fark ızgarası 3×3 pencerede ortalanır (kumlanma gürültüsü eşiği yanlışlıkla aşmasın). **Anlamlı (varsayılan, 9E-0):** |Δ| ≥ 2 dB piksellerin **en büyük bitişik (8-komşuluk) yaması ≥ min(bahçenin %25'i, 5 da)** (katalog `alan_kurali: bitisik`). Alternatif `alan_kurali: pay`: toplam alan payı ≥ %25 `ve`/`veya` mutlak ≥ 2 da (`alan_birlesim`). Büyüklük = eşiği aşan piksellerin Δ ortancası, alan = piksel × 100 m². **Bahçe poligonu dışındaki pikseller hesaba girmez** (ızgaralar kanonik bbox'ı doldurur; okurken poligon dışı NaN yapılır — 9D'de pay bbox üzerinden hesaplanıyordu, düzeltildi).
   - **Kalıcı sapma:** sahnenin bahçe ortalaması (dB) o ayın normal bandının dışında mı (p10–p90; yoksa p25–p75; band yoksa «bant_yok»).
   - **Olay adayı** = anlamlı ani değişim **VE** (kalıcı sapma bant dışında ve aynı yönde **YA DA** aynı yönde art arda ≥ 2 sahnede). Aksi hâlde **«gürültü»** olarak kaydedilir, aday olmaz. Tek sahnelik sıçrama aday üretmez; iki ardışık düşüş üretir; mevsimsel yavaş düşüş (adım < 2 dB) bant içinde hiçbir şey üretmez (testli).
   - **Güven (9F'de yeniden adlandırıldı):** radar adayı tek başına **orta** güvendir (eski ad «normal»); «ıslaklık olabilir» notlu aday **güven = düşük** işaretlenir (`change_events.guven`); 9F olay motoru düşük güvenli adayı bildirime çevirmez. Yağış verisi yoksa not düşülmez ve güven düşürülmez (bilinmiyor).
- Eşikler katalogda **ön değer** (`radar` bloğu; mühendis/uzaktan algılama uzmanı onayı bekliyor): 2 dB, %10, 3 sahne, 2 ardışık, 3×3, %30 maske.
10. **Yağış notu:** önceki ~48 saatte (günlük çözünürlükle: geçişten 2 gün önce – geçiş günü) önbellekteki yağış ≥ 1 mm ise adaya `islaklik_olabilir` düşülür; radar ıslak yüzeye çok duyarlıdır, yanlış alarmı önlemek için. Yağış verisi yoksa alan **null (bilinmiyor)** kalır, uydurulmaz.
11. **Bu turda yalnız kayıt + API.** Bildirim yok; `change_events` kayıtlarını **9F olay motoru** tüketir.

## API
`GET /gardens/{id}/radar/edinimler` (geçişler, kompakt) · `…/radar/edinimler/{tarih}/{gosterge}/izgara` · `…/radar/degisim/{tarih}/izgara` (Δ dB) · `…/radar/nokta?satir&sutun&tarih` (son 6 sahne VH dB) · `…/radar/degisimler?durum=aday|gurultu` · `…/gecmis-doldurma?kaynak=radar`.

## Arayüz ilkeleri
- Katman menüsü: **«Radar · bulut geçirmez»** grubu: **«Radar (VH)»** (gri-mavi ışık şiddeti; «zayıf yansıma → güçlü yansıma») ve **«Radar değişimi»** (ortası nötr iki yönlü; anlamlı eşiğin altı soluk). Tarih kutusu yörünge ve geçiş yönünü yazar; radar katmanındayken yalnız radar tarihlerinde gezilir.
- Su sekmesi «Bulut altında görüş» şeridi ve Durum üstündeki eski optik satırı. **Kademe radarla DEĞİŞMEZ** (9F'de karar).
- **Adlandırma:** arayüzde hiçbir yerde «radar nemi» denmez.

## Sınırlar (dürüstçe)
- **Ağaçlı bahçede VH taç ve gövde yapısını (hacim saçılımı) görür**; yüzeydeki **mutlak toprak nemi iddiası yoktur**. Yağış sonrası artış ıslaklıktan olabilir; bu yüzden `islaklik_olabilir` notu vardır ve eşikler ön değerdir.
- **Eşik duyarlılığı (gerçek veri, 2015–2026, poligon maskeli, 3×3 yumuşatma; yılda olay adayı):** jlnnlk (15 da) / soğuk hava (25 da): 9D kuralı «%25 VEYA 2 da» 5,0 / 6,0; «%25 VE 2 da» 2,7 / 2,1; **bitişik ≥ min(%25, 5 da) 1,9 / 1,4 (varsayılan)**; bitişik ≥ min(%25, 2 da) 4,3 / 4,2. Sentetik 90 da bahçe (kumlanmalı, 1000 sahne): yalnız gürültüyle sahte anlamlı değişim **0/1000** (hem «VE» hem «bitişik»); −4,6 dB'lik bitişik yama yakalama: 5 da %46, ≥ 8 da %100 (bitişik) — «%25 VE» yalnız 22,5 da üstünü yakalar. Bitişik kural büyük bahçede mutlak 5 da yamayı, küçük bahçede %25'i arar; dağınık gürültü pikselleri yama oluşturmaz.
- **Budama ve yağış örtüşmesi:** Şub–Mar aylarındaki aday payı takvim beklentisiyle (%17) aynıdır (jlnnlk %16, soğuk hava %17; `ve` ile %14 / %5): budama dönemine özgü bir birikme görülmedi. Günlük yağış arşivi yalnız Kasım 2024'ten beri önbellekte olduğundan 2015–Ekim 2024 adaylarının yağış durumu **bilinmiyor** (jlnnlk 152 adayın 118'i); yağış verisi olan dönemde (Kas 2024–Eyl 2026) adayların %47'si (jlnnlk 16/34) ve %41'i (soğuk hava 18/44) «ıslaklık olabilir» notludur. Tarihsel yağış için ERA5-Land arşivi (9E) gerekir.
- Birincil olmayan yörüngelerde ızgara saklanmaz: haritada ve değişimde yalnız birincil yörünge kullanılır.
- Her geçiş bahçe başına bir kez okunur. **Ölçek notu (Adım 26 öncesi yapılacak):** sahne başına **bir kez okuyup o sahnenin kapsadığı tüm bahçeleri işleyen toplu okuma** (şimdiki hat bahçe × geçiş okur; yakın bahçelerde aynı geçiş tekrar tekrar indirilir).

## Sonuçlar
- İki test bahçesi için 1568 geçiş, ~17–18 dk doldurma (8 paralel ay, ~1,6 sn/geçiş), ızgara + istatistik bahçe başına birkaç MB.
- Günlük artımlı çekim ve geçmiş doldurma radar için de çalışır; okunamayan geçiş ayı «hata» bırakır ve kaldığı yerden devam eder.
