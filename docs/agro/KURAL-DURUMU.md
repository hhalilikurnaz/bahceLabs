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

## 8B'de eklenecekler
Akdeniz meyve sineği, kırmızı örümcek, kuruma hastalığı eşikleri; sulama (Kc, etkili yağış tanımı, sistem verimliliği) — aynı dosya düzeninde, hepsi "doğrulanmadı".
