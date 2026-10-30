# Görsel dil v2 · iki yön (maket)

> **Yalnız maket.** Ürün koduna uygulama yok; yön seçiminden sonra token birleştirme, grafik bileşen seti ve sayfa iskeleti uygulanır, 9H yeni dilin üstüne kurulur.
> Ölçüt: [görselleştirme ilkeleri 1–11](../gorsellestirme-ilkeleri.md) · Bulgular: [UX denetimi](../ux-denetimi.md) · **Karşılaştırma PDF'i:** [`../gorsel-dil-v2-yonler.pdf`](../gorsel-dil-v2-yonler.pdf)

## İki yön
| | **A · Defter** | **B · İstasyon** |
|---|---|---|
| Fikir | kartografik defter: ılık kâğıt, ince cetvel çizgileri, editoryal serif karar cümlesi | ölçüm istasyonu: serin yüzeyler, yumuşak kartlar, sıkı sans karar cümlesi, mono etiket |
| Yüzey | `#f3ecdc` kâğıt · `#faf6eb` panel | `#e8edeb` · beyaz kartlar |
| Tipografi | Newsreader (karar, sayı) + IBM Plex Sans | Inter Tight + JetBrains Mono (etiket) |
| Köşe / gölge | 2–3 px, düz (gölge yok) | 8–14 px, yumuşak gölge |
| Yoğunluk | rahat, cetvelli satırlar | yoğun, kart tabanlı |
| Ray | haritanın üstünde ince şerit | yüzen hap |
| Birincil eylem | limon | koyu mürekkep (limon yalnız logo noktası) |

**Ortak imzalar (iki yönde de, farklı uygulanışla):** kartografik notlar (haritada bölgeye ince çizgiyle bağlı), «kendi geçmişine göre» normal bant motifi tüm zaman grafiklerinde, editoryal karar cümlesi + tek büyük sayı, tek kontrol rayı (uzman kontrolleri ⋯ altında).

## İçerik
- `yon-a/`, `yon-b/`: 4 ekran × 1440/390 statik HTML (`liste`, `durum`, `su`, `gecmis`).
- `tokens-a.css`, `tokens-b.css`: tek `tokens.css` taslağı (renk, yazı ölçeği, boşluk, köşe, gölge, çizgi).
- `bilesenler.md`: grafik bileşen seti · `adr-grafik-kutuphanesi.md`: visx ADR taslağı.
- `veri/`: dev veritabanından **dışa aktarılmış gerçek anlık görüntü** (2026-10-29): jlnnlk ve soğuk hava. `gorsel/`: gerçek harita görüntüleri ve çok yıllı analizin yıllık gerçek ızgaraları.
- `uret.py`: maketleri JSON'dan üretir (ekrandaki her sayı JSON'dan okunur ya da türetilir; uydurma sayı yok). `foto.cjs`: ekran görüntüsü; `pdf.cjs`: PDF.

## Yeniden üretme
```
python3 uret.py      # yon-a/*.html, yon-b/*.html
node foto.cjs        # onizleme/*.png
node pdf.cjs         # ../gorsel-dil-v2-yonler.pdf
```

## Dürüstlük notları (maket)
- **Harita:** gerçek uydu altlığı + gerçek NDVI/NDMI rasteri, MUTLAK skalada (ilke 4). Mutlak skalada bahçe içi fark düşük görünür; bu gerçektir. Fark okuması haritada bölge notlarıyla, panelde sayıyla verilir.
- **Normal bant kıyası aynı kaynakla:** bant Sentinel-2'den kurulur; 12 aylık sayım ve «normal bantta» kararı yalnız Sentinel-2 görüntüleriyle yapılır. HLS (30 m) gözlemleri grafikte boş nokta olarak ayrıca çizilir.
- **«Aynı hava hücresi» notu:** iki bahçenin ERA5 verisi JSON'da birebir aynı olduğu için yazıldı (kod: `su['profil']['katmanlar']` eşitliği).
- **2015 yazı «yetersiz»:** API 2015 için canlılık vermiyor; 12 yazın ilk kutusu taramalı boş.
- **Durum cümlesi** `risk_sinirladi` ve `durum` alanlarından türetilir (doğrulayıcı `assert` ile).
- Maketteki bildirim sayısı: «bahçe uyarısı yok · 3 sistem uyarısı» (rozet yalnız ürün uyarısını sayar; U1).

## Yön C · «Saha» (A/B incelemesinden sonra)
B'nin iskeleti + «yapay zekâ hissi» yasakları: nötr beyaz/açık gri yüzey, serif ve eyebrow yok, köşe 6 px, kartta gölge yok (yalnız yüzen öğede çok hafif), tek yazı ailesi **Source Sans 3** (self-host; IBM Plex Sans ile denendi, bkz. `yazi-karsilastirma.html`), gradyan/cam/emoji yok, kısa ve jargonsuz karar cümleleri, büyük sayı «normale göre» konum. Dosyalar: `tokens-c.css`, `maket-c.css`, `yon-c/`, `pdf-c.cjs` → `../gorsel-dil-v2-yon-c.pdf`. Üretim: `python3 uret.py && node foto.cjs && node pdf-c.cjs`.
