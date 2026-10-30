# 9H · Sulama planı: İlkeler 1–11, ekran bazında

✓ = karşılanıyor (test ya da ekran görüntüsüyle) · ◐ = kısmen (not var) · — = bu ekranda geçerli değil. Kaynak ilkeler: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar: [u9h-ekranlar/](u9h-ekranlar/) (1440 / 1024 / 390) ve hareket kayıtları. Test verisi: `tests/support` tohumlu bahçe (ürün kodunda sahte veri yok).

| İlke | Plan | Maliyet | Senaryolar | Sihirbaz | Su kartı | Bugün satırı | Geçmiş satırı | Not |
|---|---|---|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ «Perşembe sabah 2 saat 25 dakika sulayın.» / «Bu hafta sulama gerekmiyor.» (`sulamaKarar`) | ◐ başlık planın cümlesi; bölüm başlıkları «Önümüzdeki 7 gün», «Aylık su», «Sezon boyunca» | ◐ dört kart, dört ayrı soru (her kartın başlığı soru) | ✓ «Hangi sistemle sulıyorsunuz?» | ✓ aynı cümle | ✓ «Sulama: Perşembe, 2 sa 25 dk» (`sulamaSatiri`) | ✓ tek satır | cümleler `tests/karar.test.ts`: tek cümle, noktalı virgül yok |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ cümle + büyük süre/m³ → hafta takvimi → kova → animasyon | ✓ rakamlar → çubuk → aralık | ✓ sonuç cümlesi + fark | — | ✓ | — | — | kaynaklar ve katalog sürümü sayfa altında |
| 3 Normal bant tek tanım | — | — | ◐ kuru/ıslak yıl çubukları 2015–2025 aralığını gösterir, «normal bant» değil | — | — | — | — | |
| 4 Dürüst ölçek | ✓ kova ekseni 0 → TAW mm, tek eksen | ✓ aylık çubuklar 0'dan | ✓ yıl çubukları 0'dan | — | — | — | — | |
| 5 Renk anlamı sabit | ✓ su mavi (`--color-app-water`), uygulanan koyu, planlanan çerçeve, uyarı eşiği `warn` | ✓ | ✓ iyi/kötü fark yeşil/turuncu + işaret | ✓ | ✓ | ✓ | ✓ | ham hex yok (`tests/tokens.test.ts`) |
| 6 Renk tek başına değil | ✓ planlanan = taralı çerçeve + «planlanan sulama» etiketi, uygulanan dolu | ✓ uygulanan çerçeveli, plan dolu | ✓ fark işareti (+/−) ve birim | ✓ | ✓ | ✓ | ✓ | |
| 7 Belirsizlik görünür | ✓ önümüzdeki 10 gün **Forecast** (taralı), tahmin çizgisi kesikli | ✓ sezon **aralık** (p10–p90 + ortanca), tek sayı yok; «tahmin» ayları soluk | ✓ «ön değer · mühendis onayı bekliyor» her kartın altında | ✓ «Sizin girdiğiniz fiyat» / «Tarife güncel değil» | ✓ | ✓ | ✓ | |
| 8 Yok / bayat / hata ayrı | ✓ `profil_yok` (CTA) · `veri_yok` (neden) · hata (`ErrorState`) | ✓ TL yok → neden yazılı | ✓ | ✓ | ✓ yükleniyor/hata ayrı | ✓ plan yoksa satır hiç çizilmez | ✓ | `e2e/sulama.spec.ts` |
| 9 Doğrudan etiket, 12 px taban | ✓ eşik ve «bugün» çizgide, son değer çizgi ucunda | ◐ aylık çubuk açıklaması tek satır lejant | ✓ | ✓ | ✓ | ✓ | ✓ | kova altındaki tek satırlık açıklama (4 öğe) lejant sayılır: ◐ |
| 10 Harita–grafik bağı | ◐ imleç tarihi diğer grafiklerle `calismaStore` üzerinden ortak; sayfada harita yok | — | — | — | — | — | — | «Su ihtiyacı» harita katmanı blok tanımı olmadığı için yok (ADR 0023) |
| 11 Bir grafik bir mesaj; ≤ 150 ms | ✓ kova = «toprakta su, eşiğe ne kadar var»; animasyon ayrı bölüm | ✓ | ✓ | — | — | — | — | katman değişimi eşiği: `e2e/performans.spec.ts` değişmedi, geçti |

**Kalan borçlar (dürüst liste):** Plan sayfasında harita yok (blok kavramı gelince «Su ihtiyacı» katmanı); kova altı lejant satırı doğrudan etikete çevrilebilir; Saha Defteri sulama formu eski yerleşimde (iç bölümler son tasarım turunda).
