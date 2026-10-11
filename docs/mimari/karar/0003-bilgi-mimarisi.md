# ADR 0003 — Bilgi mimarisi ve rotalar

**Durum:** kabul (Adım 7A/7B)

**Karar.** Sol menü: Bahçelerim · Pazar & Depo · Bildirimler · Ayarlar. Bahçe sayfası `/bahcem/:id/(durum|analiz|hava|gunluk|rapor)`; seçili bahçe ve sekme URL'de (derin bağlantı, geri tuşu). Üst rota sabit kalır (harita yeniden kurulmaz). Henüz olmayan her yer "Yakında – Adım N" kartıdır; işlevsiz menü ucu bırakılmaz. Ayrıntı: `docs/design/BILGI-MIMARISI.md`.
