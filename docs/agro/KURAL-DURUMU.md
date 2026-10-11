# Agro kuralları — doğrulama durumu

Kaynak dosya: `bahcelab-backend/src/bahcelab_backend/domain/agro/rules/katalog.yaml` (sürüm 1).
Bir kural mühendis tarafından onaylanınca ilgili bloğun `durum` alanı `muhendis_onayli`, `onaylayan` ve `onay_tarihi` doldurulur (doğrulayıcı olmadan yüklemeyi reddeder).

## Adım 8A — doğrulanmamış kurallar (tümü "ön değer – ziraat mühendisi onayı bekleniyor")

| Kural | Kapsam | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|---|
| Fenoloji evreleri | limon, portakal, mandalina, greyfurt (tüm çeşitler ürün değerini miras alır) | Kış dinlenmesi 15 Ara–15 Şub · Tomurcuklanma 16 Şub–14 Mar · Çiçeklenme 15 Mar–30 Nis · Meyve tutumu 1 May–15 Haz · Meyve büyümesi 16 Haz–30 Eyl · Olgunlaşma ve hasat 1 Eki–14 Ara | Akdeniz kuşağı narenciye fenolojisinin genel yaklaşık takvimi; bölge/yıl/çeşide göre ±3 hafta | doğrulanmadı |
| Kc (evre bazlı) | aynı ürünler | 0,65 (kış, tomurcuklanma, büyüme, olgunlaşma) · 0,70 (çiçeklenme, meyve tutumu) | FAO-56 Tablo 12 narenciye (başlangıç 0,70 · orta 0,65 · son 0,70) değerlerinden evrelere dağıtım | doğrulanmadı |
| GDD tabanı | aynı ürünler | 12,5 °C | Narenciyede yayınlarda 10–13 °C arası taban kullanılır; 12,5 ön değer | doğrulanmadı |
| Narenciye dışı ürün ("diger") | — | kural tanımlı değil | Arayüz "veri yetersiz / kural yok" der | — |

Çeşit düzeyinde ayrı değer girilmemiştir (Enterdonat, Kütdiken, Lamas, Meyer, Yediveren, Washington Navel, Valencia, Satsuma, Klemantin, Star Ruby): hepsi ürün değerini kullanır; yapı çeşit bazlı değer (`fenoloji`/`kc`/`gdd`) eklemeye hazırdır. Yediveren için "yıl boyu çiçek verebilir" notu vardır.

## Skor parametreleri (kural değil, ürün ayarı — `config.py`)
Ağırlıklar canlılık %40 · yaprak suyu %20 · uyarılar %20 · hava %20; etiket eşikleri İyi ≥ 75, İzle ≥ 50; tolerans: aralığın %5'i, sıfır puan: %30'u. Bunlar tarımsal eşik değil istatistiksel sezgidir; mühendis onayı gerektirmez ama yayın öncesi gözden geçirilmelidir.

## Adım 8B — doğrulanmamış kurallar (hepsi "ön değer – ziraat mühendisi onayı bekleniyor")

Dosyalar: `rules/sulama.yaml`, `rules/riskler.yaml`.

| Kural | Değer (ön) | Kaynak notu | Durum |
|---|---|---|---|
| Etkili yağış | günlük yağış < 2 mm sayılmaz; eşiği aşanın %80'i etkili; günlük üst sınır 40 mm | Genel yaklaşım; toprak tipi/eğime göre uyarlanmadı | doğrulanmadı |
| Sulama sistemi verimliliği | damla 0,90 · yağmurlama 0,75 · salma 0,60 · sistem yok: verimlilik uygulanmaz | Yaygın literatür aralıkları | doğrulanmadı |
| Sulama hesabı | ETc = ET₀ × Kc − etkili yağış; son 7 gün açığı; önümüzdeki 7 gün ihtiyacı; 1 mm = 1 ton/dekar; ihtiyaç eşiği 5 mm | Kc: katalog (FAO-56 tabanlı ön değer) | doğrulanmadı |
| Akdeniz meyve sineği | GDD tabanı 10 °C, birikim 1 Mart'tan; orta ≥ 350, yüksek ≥ 600 GDD; son 7 gün ortalaması 16–32 °C dışındaysa bir kademe düşer; "yüksek" yalnızca meyve büyümesi/olgunlaşma evresinde | GDD'ye dayalı genel bölgesel uyarı yaklaşımı; eşikler ön değer | doğrulanmadı |
| Kırmızı örümcek | sıcak gün: Tmax ≥ 30 °C; kuru gün: yağış < 1 mm (ve bilinen tahmin günlerinde nem ≤ %50); art arda ≥ 4 gün orta, ≥ 7 gün yüksek | Sıcak-kuru gün serisinin popülasyonu hızlandırdığı yönünde genel gözlem | doğrulanmadı |
| Kuruma hastalığı (mal secco) — yalnız limon | orta: yağış ≥ 5 mm ve rüzgâr ≥ 20 km/s; yüksek: ≥ 10 mm ve ≥ 30 km/s; ortalama sıcaklık 14–28 °C; risk penceresi koşuldan sonra 3 gün | Yağmur + rüzgâr + ılık sıcaklıkta enfeksiyon olasılığı artar (genel bilgi) | doğrulanmadı |
| Tuzak sayımı | arayüz hazır, değer yok (Adım 12) | — | — |

Bu çıktılar teşhis ya da ilaçlama/sulama reçetesi değildir; arayüzde "risk tahmini" / "yaklaşık öneri" dilindedir.
