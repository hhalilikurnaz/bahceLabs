# ADR 0002 — Hazır (örnek/sahte) veri yok

**Durum:** kabul (Adım 7A)

**Karar.** Kodda, seed'de ve varsayılan harita görünümünde belirli bir bahçe/köy/koordinat veya örnek veri bulunmaz. `make db-seed` yalnızca test kullanıcısını oluşturur. Sentetik veri üreticileri yalnızca testlerde (`tests/support/`). Veri yoksa arayüz dürüstçe söyler ("henüz görüntü yok", "işleniyor", "bu dönem bulutlu"). İlk açılış: bahçe varsa bahçelerin sınırına, yoksa Türkiye görünümü. Migration 009 eski `ornek` kayıtlarını siler.

**Sonuç.** Demo için gerçek bahçe çizilir; ağsız demo yoktur.
