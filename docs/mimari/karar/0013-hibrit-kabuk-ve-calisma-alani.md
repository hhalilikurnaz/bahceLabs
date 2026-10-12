# 0013 — Hibrit kabuk ve bölünmüş çalışma alanı (Adım 9B)

Durum: kabul edildi (B1). Tarih: 2026-10-12.

## Bağlam
Eski arayüz sol şerit + yüzen panel + alt çubuk + kart ızgarasından oluşuyordu; harita çalışmanın merkezi olmasına rağmen paneller üzerini örtüyordu. Referans: `docs/design/prototip/komuta-merkezi.html`.

## Karar
- Rotalar: `/bahceler/:id[/durum|analiz|su|hava|gunluk|rapor]` (Durum = bahçe kökü), tam sayfalar `/bahceler/:id/gecmis` ve `/bahceler/:id/defter`. Eski `/bahcem/...` adresleri `legacyRedirect` ile yönlenir; arka uç bildirim bağlantıları yeni rotaları üretir.
- Kabuk: üst gezinme (Bahçeler · Asistan · İşlerim · Hizmetler · Pazar · ⌘K · bildirim · tema · hesap) + bahçe çubuğu (seçici, sekmeler, Saha Defteri).
- Çalışma alanı: solda tam harita, sağda sabit panel, sürüklenebilir bölücü (oran `localStorage`). Haritada: gruplu katman menüsü, tarih kutusu, histogram lejantı (skala seçimi), ölçek/kuzey/yakınlaştırma, nokta inceleme. Harita altında zaman şeridi yoktur.
- Harita, histogram ve nokta inceleme tek kaynaktan (`useHaritaGorunumu`) beslenir; ızgara çizimi `lib/izgara.ts` içindedir.
- Editoryal görünüm (Newsreader/IBM Plex, kâğıt) yalnız Saha Defteri sayfasında (`.notebook` kapsamı); ana uygulama açık/koyu tema `app-shell` belirteçleriyle.
- ⌘K komutları kural tabanlıdır (`kabuk/komutlar.ts`); LLM Asistan’da (Adım 16).
- Gece/Toprak tasarım denemeleri, eski sol şerit, yüzen panel, alt çubuk, kart ızgarası ve Copilot düğmesi silindi; `/tasarim-onizleme` yalnız varlık sayfasıdır.

## Sonuçlar
- Konumlu gözlem fotoğrafı, ilaç ve olay kaydı, bildirim kanalı soyutlaması için sağ panel sekmeleri ve Günlük sekmesi yer tutar; 9G’de doldurulur.
- Mobilde (≤ 900 px) harita ve panel alt alta; dokunma hedefleri ≥ 44 px (e2e erişilebilirlik testi).
