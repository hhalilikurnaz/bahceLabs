# ADR 0008 — Sürümlü agro kural kataloğu ve bahçe durum skoru

**Durum:** kabul (Adım 8A) — durum skoru bölümü ADR 0018 ile yerini Durum v2'ye bıraktı; `score.py` ve sayısal skor 9G'de kaldırıldı (katalog kısmı geçerli).

**Bağlam.** Fenoloji tarihleri, Kc, GDD tabanı ve (8B'de) zararlı/hastalık eşikleri tarımsal bilgidir; kodda sabit olursa kimin ne zaman, hangi kaynağa dayanarak değiştirdiği izlenemez ve ziraat mühendisi onayı süreci kurulamaz. Durum etiketi (İyi/İzle/Dikkat) ise yalnızca uyarılardan türetiliyordu; bahçenin kendi geçmişini hesaba katmıyordu.

**Karar.**
1. **Kurallar veridir, kod değildir.** `backend/.../domain/agro/rules/*.yaml` sürümlü dosyalardır (`surum`). Her kural bloğu `durum` (`dogrulanmadi` | `muhendis_onayli`) ve `kaynak` taşır; onaylı kuralda `onaylayan` + `onay_tarihi` zorunludur (doğrulayıcı reddeder). Yükleyici (`catalog.py`) pydantic ile doğrular: Kc değerleri evrelerle birebir eşleşmeli, her ürün `diger` çeşidi içermeli. Arayüz doğrulanmamış her değeri "ön değer – ziraat mühendisi onayı bekleniyor" rozetiyle gösterir; çıktılar teşhis/reçete değil "risk tahmini / yaklaşık öneri" dilindedir.
2. **Çeşit:** `gardens.cesit_kodu` (katalog kodu) + serbest metin yalnızca `diger` için. Mevcut serbest metinler migration 011 ile takma adlardan eşlenir (bilinmeyenler `diger`). Bahçe düzeyi fenoloji düzeltmeleri `garden_phenology_overrides` tablosundadır; katalog değeri değişmez.
3. **Sezon** su yılıdır (1 Ekim). Birikmiş yağış ve GDD sunucuda günlük hava geçmişinden hesaplanır (`GET /gardens/{id}/agro/seriler`); GDD = max(0, (Tmax+Tmin)/2 − taban); eksik gün uydurulmaz, birikim önceki değerde kalır ve `eksik_gun` bildirilir. Geçen sezon serisi, kapsama oranı `agro_prev_season_min_coverage` altındaysa gösterilmez. Hava geçmişi 800 güne çıkarıldı.
4. **Durum skoru** (`domain/agro/score.py`, saf): bileşenler canlılık, yaprak suyu (bahçenin kendi normuna göre sapma — aynı dönemin geçen yıl değerleri, yoksa son 60–90 günün kendi tabanı), uydu uyarıları ve hava riskleri. Ağırlıklar ve eşikler `config.py`'dedir; kullanılamayan bileşen dışarıda kalır ve kalan ağırlıklar yeniden normalleştirilir. Yeterli geçmiş/güncel görüntü yoksa skor üretilmez ("veri yetersiz" + neden). Çıktı: skor, etiket, bileşen dökümü (puan + tek cümle neden), güven (geçmiş kaynağı, son görüntü yaşı), şablon tabanlı tek cümle özet (LLM yok).
5. **Tek durum fonksiyonu:** `derive_status(has_data, severities, score)` — liste, harita rengi ve Durum sekmesi bunu kullanır. Etiket skordan türer; kırmızı uyarı en iyi "dikkat", sarı uyarı en iyi "izle" bırakır (güvenlik: yüksek skor öncelikli uyarıyı gizlemez).
6. **«Bugün»** (`today.py`, saf): en fazla 3 madde; öncelik sırası `config.today_priority`: hava uyarısı > zararlı riski > ilaçlama penceresi > indeks düşüşü > sulama > "her şey yolunda". 8B zararlı/sulama girdilerini aynı arayüze bağlar.

**Sonuçlar.** Kural değişikliği kod değişikliği gerektirmez ve izlenebilir (git geçmişi + `durum`/`kaynak`). Mühendis onayı kural bazında verilir. Skor yalnızca bahçenin kendi geçmişine bağlı olduğundan bahçeler arası kıyaslama yapılmaz; geçmişi kısa yeni bahçeler dürüstçe "veri yetersiz" görür.

**Geri dönüş.** Skor/kural katmanı `domain/agro/` içindedir; `overview` yalnızca `assess` ve `derive_status`'u çağırır.
