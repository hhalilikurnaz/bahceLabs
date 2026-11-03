# Prototip panosu ↔ Dilim 1: farklar

> **Önemli:** 4 prototip PNG'si bu oturuma **ulaşmadı** (mesajda dosya yok; bilgisayarda `~/Downloads`, `~/Desktop` ve repo içinde yok; repodaki tek prototip `docs/design/prototip/komuta-merkezi.html` 12 Ekim tarihli ve «Sulama · harita simülatörü» ekranını içermiyor). Aşağıdaki liste bu yüzden **görsel karşılaştırma değil**, S4 metin tarifine (referans desenler ve A–E maddeleri) göre yapılmış **eksik/fark listesidir**. PNG'ler eklenince piksel düzeyinde yeniden karşılaştırılacak.

## Dilim 1'de karşılanan (metne göre)
- Su sekmesinde «Sulama» modu, rota `/bahceler/:id/su/sulama`, ayrı sayfa yok; sağ panel, Bugün | Simülasyon sekmeleri.
- 3 KPI (sonraki sulama + vanalar, ihtiyaç karşılandı % + renk/yazı, sezon suyu + sezon tahmini %).
- Bugün: karar cümlesi + neden, 7 gün şeridi, sonraki program (vardiya), [Programı onayla], [Saha Defteri'ne işle].
- Simülasyon: yıl düğmeleri (kuru/normal/ıslak gerçek yağıştan), Plan | Alışkanlığım, Damla | Mini | Salma, kısıntı (kilitli dönemler), kWh fiyatı, vana çizelgesi, 4 sayaç, plan–alışkanlık karşılaştırması.
- Toprak suyu · vanalara göre, Su dengesi · son 14 gün, kaynak satırı + güven.

## Fark / eksik (Dilim 2 ve açık noktalar)
| # | S4 maddesi | Durum |
|---|---|---|
| 1 | Harita sulama modunda parsel uzun eksenine döner (250 ms), çıkışta 0 | **Yok** (dilim 2) |
| 2 | Alt çubuk: ▶/❚❚, 1×/3×/8×, önceki/sonraki sulama, Bugün, sezon şeridi, klavye ←/→/Space | **Yok** (dilim 2); Simülasyon'da yalnız sulama günleri arası ← → ve kaydırıcı var |
| 3 | Parsel dışı blur + %50 karartma; sektör dolgusu (Toprak suyu · Stres 7 gün · Fazla su 7 gün) | **Yok** (dilim 2) |
| 4 | Sektörde dik etiket «V2 · %92» + «yeterli · sonraki 22 Tem» | Metin hazır (`vanaEtiketi`, panel satırı aynı metni kullanır); **haritada çizilmiyor** |
| 5 | Ağaç sıraları dikim aralığından, damla hatları, ana boru, pompa, vanalar, katman anahtarları | **Yok** (dilim 2); hat/boru/pompa konumu için veri modeli yok (yalnız vana çokgeni) |
| 6 | Animasyon (vana halkası, akış, ıslanan şerit, yağmur parçacığı, sararan taç), reduced-motion | **Yok** (dilim 2) |
| 7 | Cam kartlar (durum, gösterge+lejant, ölçek+kuzey, sol alt not) | **Yok** (dilim 2); mevcut harita cam kartları değişmedi |
| 8 | Simülasyon: «canlı vana çizelgesi (şu an çizgisi, ilerleme)» | Kısmi: sulama günü seçilince vardiya tablosu; zaman çizgisi/«şu an» yok |
| 9 | Toprak suyu grafiğinde bantlar «Dolu/İdeal/Doldur» (CropX) | Kısmi: tarla kapasitesi çizgisi + ideal aralık + stres bandı + sulama eşiği; «doldur» bandı ayrı çizilmedi |
| 10 | Su dengesi: yağmur 12 mm üstü ok, karşılanmayan kırmızı | Var |
| 11 | Mobil: harita %45, KPI yatay kaydırma, 3 duraklı alt sayfa, sabit alt çubuk | KPI kaydırma + alt sayfa var; **harita %45 ve sabit alt çubuk yok** (dilim 2) |
| 12 | IrriWatch tarzı 4 durumlu trafik ışığı | Metin etiketi (stres/yakın/yeterli/dolu) + vana satırı; renkli «ışık» göstergesi **yok** (renk tek başına değil kuralı için metin öncelikli) |
| 13 | Tule tarzı gerçek tüketim/ihtiyaç | Var (KPI «ihtiyaç karşılandı» ΣETa/ΣETc); uydu ET (9I) yok |
| 14 | WiseConn/Netafim vana vardiya çizelgesi, haritadan aksiyon | Çizelge var; **haritadan aksiyon yok** |
| 15 | Phytech 7 günlük stres özet haritası | **Yok** (dilim 2, gösterge 2) |
| 16 | [Programı onayla] «WhatsApp hatırlatması» | Uygulama içi onay + bildirim (WhatsApp adım 18) |

**Şimdiki ekranlarda bilinen kusurlar:** test tohumlu bahçede sayılar yapay (her gün sulama); mobil «tüm panel» görüntüleri kaydırma parçalarının birleşimidir.
