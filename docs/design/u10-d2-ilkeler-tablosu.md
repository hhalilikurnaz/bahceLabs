# ADIM 10 · Dilim 2 · Gece don arayüzü: ilkeler 1–11, ekran bazında

✓ = karşılanıyor · ◐ = kısmen · — = geçerli değil. Kaynak: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar (jlnnlk, geliştirme verisi, 1440/1024/390): `docs/design/u10-d2-ekranlar-jlnnlk/`; örnek PDF: `ornek-don-hasar-raporu-jlnnlk-2025-02.pdf` (gerçek 17.02–13.03.2025 jlnnlk olayından).

**Veri notu (dürüstlük):** «uyarı durumu» ekranları için jlnnlk'in 3 geceliği, **Şubat 2025 altın gün** verisiyle (22–24 Şubat 2025'in 3 modelli saatlik tahmini; `tests/golden/jlnnlk_don_girdi.json.gz`) **gerçek don motoruyla** hesaplanıp tarihleri bugüne kaydırılarak geçici yazıldı; ekran çekiminden sonra silindi. Kritik eşik o günün evresinden (çiçek −2,8 °C). Bu bir canlı tahmin değildir.

| İlke | Önümüzdeki 3 gece kartı | Ne yapmalı | Harita katmanı + menü | Arazi kartı | Olay etiketi + hasar raporu | Not |
|---|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ başlık «Önümüzdeki 3 gece»; her satır cevap: «Bu gece don olasılığı: yüksek» | ✓ «Ne yapmalı?» (yalnız orta/yüksekte) | ✓ «Bahçe içi soğuk nokta» | ✓ «Arazi» | ✓ «Olay etiketi: …» | |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ sözcük → saat/model tahmini/eşik → «Nasıl hesaplandı?» | ✓ önlem adı → ne işe yarar → koşullar → dikkat → kaynak (açılır) | ✓ menü satırı → neden/etiket → lejant | ✓ cümle → eğim/bakı/rakım/SVF → bahçe içi neden | ✓ etiket → açıklama → rapor | ayrıntı `<details>` içinde |
| 3 Normal bant tek tanım | ✓ kritik eşik evreye göre katalogdan (tek tanım) | — | — | ✓ sınıf eşikleri tek yerde (`konum_esik`) | — | eşikler «ön değer · mühendis onayı bekliyor» |
| 4 Dürüst ölçek | ✓ sıcaklık °C, 1 ondalık; sayısal olasılık kullanıcıya gösterilmez | — | ◐ göreli 0–1 sıralama (°C DEĞİL) açıkça etiketli | ✓ eğim ° / rakım m | ✓ grafik: °C ekseni, kritik eşik çizgisi | rapor grafiği tek eksen |
| 5 Renk anlamı sabit | ✓ düşük gri · orta sarı/turuncu · yüksek kırmızı (jeton) | — | ✓ ılık açık → soğuk koyu mavi (tek ton, jeton) | — | — | ham hex yok (`HARITA`/Tailwind jetonları) |
| 6 Renk tek başına değil | ✓ ○ ▲ ✕ + «don olasılığı: …» yazısı | ✓ metin | ✓ «daha ılık / daha soğuk» yazısı | ✓ metin | ✓ etiket metni | axe temiz |
| 7 Belirsizlik görünür | ✓ «Uyarılarımız bilerek temkinlidir» notu; en soğuk MODEL tahmini; ön değer etiketi | ✓ «genel literatür; mühendisle doğrulayın»; kaynak her satırda | ✓ «varsayım: soğuk hava alçak kısımda birikir» | ✓ «sıcaklığa °C olarak eklenmez» | ✓ «model sapması olası» ≠ kanıt; «resmi ekspertiz değildir» | |
| 8 Yok / bayat / hata ayrı | ✓ veri yok → neden yazılır; yükleniyor ayrı | ✓ risk düşükse bölüm hiç çıkmaz | ✓ pasif + neden («rölyef 8 m, eğim 2,1° — bahçe içi fark ölçülemez»), «yükleniyor…» ayrı | ✓ profil yok → «henüz hesaplanmadı» | ✓ rapor hatası `role=alert` | |
| 9 Doğrudan etiket, 12 px | ✓ satır içi etiket, lejant yok | ✓ | ✓ lejant gradyan + uç kelimeleri | ✓ | ✓ | en küçük yazı 12 px |
| 10 Harita–grafik bağı | — | — | ◐ katman Durum'daki bahçe içi nedenle aynı kaynaktan (`/don/goreli-soguk`) | — | ✓ «Haritada göster» mevcut bağ | |
| 11 Bir grafik bir mesaj; ≤ 150 ms | ✓ | ✓ | ✓ tek katman, 30 m ayrık hücre | ✓ | ✓ rapor grafiği: tek mesaj (saatlik sıcaklık ↔ kritik) | |

**Dokunma hedefi:** tüm düğmeler ≥ 44 px (`min-h-11`). **Klavye:** önlem satırları `<details>`; katman anahtarı `disabled` + `aria-describedby`.

**Kalan borçlar / dürüst notlar:** (1) Katman menüsündeki «Bölgeler» satırında (bu kapsam dışı, mevcut) axe `color-contrast` bulgusu var; menü açıkken taramada görünüyor, e2e menü kapalıyken tarar. (2) Hasar raporunda Sentinel-2 yalnız bahçe ortalaması NDVI/NDRE'dir (görüntü küçük resmi yok); mevsimsel değişim ayrıştırılmaz. (3) `Don oldu mu?` yanıtı bahçe bazında yanlış alarm ayarına bahar sonu pilot verisiyle girer.
