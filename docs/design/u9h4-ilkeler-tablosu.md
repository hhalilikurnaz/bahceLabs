# 9H-S4 (dilim 1) · Sulama paneli: ilkeler 1–11, ekran bazında

✓ = karşılanıyor · ◐ = kısmen · — = geçerli değil. Kaynak: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar: `docs/design/u9h4-ekranlar/` ve [u9h4-ekranlar.pdf](u9h4-ekranlar.pdf). Veri: test tohumlu bahçe (çok kurak sentetik seri; sayılar arayüz denemesidir). Harita simülatörü (dilim 2) bu tabloda **yok**.

| İlke | Karar + KPI | Bugün | Simülasyon | Toprak suyu (vanalara göre) | Su dengesi (14 gün) | Kaynak + güven | Not |
|---|---|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ «Perşembe sabah 05:00 vardiyasıyla V1 ve V2 sulanacak.» (`sulamaPanelKarar`) | ✓ başlıklar tek konu | ◐ iki soru (sezon sayaçları, çizelge); başlıklar «V... sezonu», «Vana çizelgesi» | ✓ grafik altı tek cümle (`toprakSuyuCumlesi`) | ✓ (`suDengesiCumlesi`) | — | cümleler `tests/karar.test.ts` |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ karar → neden → 3 KPI | ✓ şerit → vanalar → program | ✓ ayarlar → sayaçlar → çizelge → karşılaştırma | ✓ kanıt, «Nasıl okunur?» ayrıntıda | ✓ | ✓ güven koşulları ayrıntıda | |
| 3 Normal bant tek tanım | — | — | ◐ kuru/normal/ıslak yıl, yağış sırasından | ✓ ideal aralık bandı katalogdan | — | — | |
| 4 Dürüst ölçek | — | ✓ | ✓ | ✓ 0–100 % tek eksen | ✓ tek eksen mm, 0'dan | — | |
| 5 Renk anlamı sabit | ✓ yeşil/sarı/kırmızı KPI + yazı | ✓ | ✓ | ✓ su mavi · stres turuncu · ideal yeşil | ✓ yağmur mavi, karşılanmayan kırmızı, sulama koyu | — | ham hex yok (`tokens.test.ts`) |
| 6 Renk tek başına değil | ✓ «karşılanıyor / dikkat / yetersiz» | ✓ durum etiketi metin | ✓ | ✓ bant adı çizgi üstünde, sulama üçgeni dolu/boş | ✓ ihtiyaç = çerçeve | ✓ ✓/✗ | |
| 7 Belirsizlik görünür | ✓ «ön değer», güven | ✓ | ✓ | ✓ sonraki 7 gün kesikli + **Forecast** | — | ✓ güven etiketi | |
| 8 Yok / bayat / hata ayrı | ✓ profil yok (CTA) · veri yok (neden) · hata | ✓ vardiya yok → «program yok» | ✓ TL yok → neden; alışkanlık yok → neden | ✓ | ✓ veri yoksa `ChartState` | ✓ | `e2e/sulama.spec.ts` |
| 9 Doğrudan etiket, 12 px | — | — | — | ✓ vana adları çizgi ucunda (çakışınca ayrılır), eşik ve bugün çizgide | ✓ 12 mm üstü yağış okla etiketli | — | lejant yok |
| 10 Harita–grafik bağı | — | ◐ imleç ortak (`calismaStore`); haritada vana etiketi **dilim 2** | — | ◐ imleç ortak; sektör dolgusu dilim 2 | — | — | tek etiket metni: `vanaEtiketi` (satır = harita) |
| 11 Bir grafik bir mesaj; ≤ 150 ms | ✓ | ✓ | ✓ | ✓ «hangi vana eşiğe iniyor» | ✓ «ihtiyaç karşılandı mı» | — | `e2e/performans.spec.ts` geçti |

**Kalan borçlar:** harita simülatörü (sektör dolgusu, dik etiketler, animasyon, alt çubuk, vana çizim aracı), mobil sabit alt çubuk ve harita %45 yerleşimi, sulama günü kareleri ve webm — **dilim 2**. Simülasyon sekmesinde «canlı çizelge» şimdilik sulama günleri arasında gezinen vardiya tablosudur (zaman çubuğu animasyonu dilim 2).
