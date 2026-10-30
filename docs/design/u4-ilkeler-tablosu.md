# U4 · İlkeler 1–11, ekran bazında (kapanış tablosu)

✓ = karşılanıyor (test ya da ekran görüntüsüyle) · ◐ = kısmen (not var) · — = bu ekranda geçerli değil. Kaynak ilkeler: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar: [u4-ekranlar.pdf](u4-ekranlar.pdf).

| İlke | Bahçeler | Durum | Analiz | Su | Hava | Geçmiş | Saha Defteri | Bildirim | Not |
|---|---|---|---|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ «İki bahçe de izlemede.» | ✓ «Bahçe bu mevsim için normal.» | ✓ «Bahçenin %24’ü yıllardır zayıf.» (`analizKarar`) | ✓ «Toprak nemli, bu hafta sulama gerekmiyor.» | ✓ «Bu hafta ilaçlama için uygun.» | ✓ «Bu sezon normal …» | ✓ «Uydunun gördüğünü sahada doğrulayın.» | ✓ «Bahçeniz için yeni uyarı yok.» | başlıklar `lib/karar.ts` |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | |
| 3 Normal bant tek tanım | ✓ mini çizgi | ✓ | — | — | — | ✓ | — | — | `BandLine`/`Sparkline` aynı veri kaynağı |
| 4 Dürüst ölçek | ✓ | ✓ mutlak | ✓ | ✓ | — | ✓ | — | — | gerilme eşikli (U1) |
| 5 Renk anlamı sabit | ✓ | ✓ | ✓ | ✓ su mavi / ETc turuncu-kahve | ✓ | ✓ | ✓ | ✓ | `tests/tokens.test.ts`: ham hex yok |
| 6 Renk tek başına değil | ✓ simge+ad | ✓ | ✓ tarama | ✓ tarama | ✓ desen | ✓ | ✓ | ✓ | |
| 7 Belirsizlik görünür | ✓ veri yaşı | ✓ güven, taralı tahmin | ✓ | ✓ taralı tahmin, yaş | ✓ | ✓ | — | — | |
| 8 Yok / bayat / hata ayrı | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | `ChartState`, `ErrorState` (ağ/sunucu ayrı) |
| 9 Doğrudan etiket, 12 px taban | ✓ | ✓ | ✓ | ✓ | ✓ şerit blokları doğrudan etiketli, lejant yok | ✓ | ◐ | ✓ | `tests/tokens.test.ts` 12 px taban |
| 10 Harita–grafik bağı | — | ✓ imleç + tıkla | ✓ not → uçuş | ✓ imleç | — (sade) | ✓ | — | — | sekme katmanı değiştirir |
| 11 Bir grafik bir mesaj; ≤150 ms | ✓ | ✓ | ✓ | ✓ iki panel | ✓ iki panel (yağış / sıcaklık + 0 °C don eşiği) | ✓ | — | — | katman değişimi medyan 77 ms (A/B: `u4-performans-ab.md`) |

**Kalan borçlar (dürüst liste):** Saha Defteri'nin iç bölümleri hâlâ eski yerleşimde (yalnız dil/token birleşti); giriş ve tanıtım sayfalarında Fraunces ve eyebrow duruyor (uygulama kabuğu dışı).
