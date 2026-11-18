# ADIM 11 · Dilim 0 — Saha Defteri 390 px ölçümü (jlnnlk gerçek sayfa)

Yöntem: geliştirme sunucusu, jlnnlk bahçesi, 390×844 dokunmatik bağlam, `/bahceler/:id/defter`. Ölçüm DOM'dan (`getBoundingClientRect`), görüntüler `docs/design/adim-11-d0-ekranlar/` (`defter-390-ust`, `defter-390-form`, `defter-390-form-nokta`). jlnnlk'te saha kaydı sıfırdır; sayfadaki 23 «Uydu haklı mıydı?» kartı gerçek olaylardan gelir. Önceki durum belgesinin §4 maddeleri bu ölçümle **doğrulandı, düzeltildi ya da çürütüldü**.

| # | Durum belgesi §4 maddesi | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Tarih alanı 36 px | **Düzeltildi:** 390 px'te 44 px; ≥ 561 px'te 36 px | 390: `kayit-tarih` 110×44; 1440: 110×36 (tür çipleri, konum ve «Kaydı ekle» düğmeleri de aynı) |
| 2 | Harita üstte, form altta; nokta seçmek için iki yöne kaydırma | **Doğrulandı ve daha kötü:** form sayfanın 5.015. pikselinde | Sayfa yüksekliği 5.378 px; harita y=324 (472 px yüksek); `kayit-formu` y=5.015. «Haritada nokta» seçilince haritaya dokunmak için ~4.700 px geri kaydırma gerekir (23 doğrulama kartı arada) |
| 3 | Dokunma hedefleri 36 px kalıyor | **Doğrulandı, farklı yerde:** 32 hedef < 44 px | `on-yargi-rozeti` özeti 366×24 (30 adet), «kaynak» bağlantısı 36×17, `kayit-katmani` onay kutusu 13×13. Giriş formunun kendi düğmeleri 390'da ≥ 44 |
| 4 | Fotoğraf: 6 MB sınırı, 413 riski | **Düzeltildi:** sunucu 413 değil doğrulama hatası döner («Fotoğraf en çok 6 MB olabilir»); istemci küçültmesi yok (doğrulandı) | `fieldbook/service.py` (`_bad`), `KayitBolumu.tsx` (küçültme yok) |
| 5 | Zaman aşımı yok | **Doğrulandı** | `lib/apiClient.ts`: AbortController/zaman aşımı yok; sorgu `retry: 1`, mutasyonda yeniden deneme yok |
| 6 | Kısmi fotoğraf başarısızlığı → kopya riski | **Doğrulandı (kod)** | `useKayitOlustur`: kayıt oluşur, fotoğraflar sıralı yüklenir; hata durumunda form dolu kalır, «Kaydı ekle» yeniden basılırsa İKİNCİ kayıt oluşur (idempotans yok) |
| 7 | «Konumumu kullan» yok | **Doğrulandı** | Konum yalnız haritadan; GPS yalnız saha turu başlangıcında (`TurBolumu`) |
| 8 | Çevrimdışı yok | **Doğrulandı** | service worker/manifest/IndexedDB yok |
| 9 | Yazı boyutu | Sorun yok | Sayfa metinleri 12–28 px (en küçük 12 px) |

**Ölçülemeyenler (bu belgede yapılmadı):** ekran klavyesinin formu örtmesi (başsız tarayıcıda klavye yok), gerçek GPS doğruluğu, güneş altı okunabilirlik, zayıf hat altında yükleme süresi. Dilim 1–2 kabul testlerinde cihaz/hat kısıtlamasıyla ölçülecek.

**Dilim 1 için çıkan zorunlu işler:** (a) yeni kayıt akışı sayfa dibine gömülü kalamaz: sabit «+ Kayıt» eylemi, harita ve form aynı görünümde; (b) 44 px altı hedeflerin giderilmesi (doğrulama rozeti özeti, onay kutusu etiketi); (c) tarih alanı ve çipler ≥ 561 px'te de ≥ 44 px.
