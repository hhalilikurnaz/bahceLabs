# ADIM 10 · Dilim 0 — Topografya ve don: doğrulama spike'ı

Tarih: 2026-11-14 · Kapsam: yalnız doğrulama (ürün kodu yok). Kural: mock yok, ücretsiz kaynak. Betikler: `bahcelab-backend/scripts/don_dilim0/` (`arazi.py`, `veri_topla.py`, `degerlendir.py`, `modis.py`); ham sonuçlar: [`docs/agro/don-dilim0/`](don-dilim0/). Eşikler ve katsayılar «ön değer · mühendis onayı bekliyor».

## 0. Özet ve karar (go / no-go)

| Parça | Karar | Gerekçe (tek cümle) |
|---|---|---|
| Bahçe topografya profili (eğim, bakı, TPI, akış birikimi, çanak, gökyüzü görüş) | **GO** | Ücretsiz DEM'den bahçe başına ≈ 5 sn'de bir kez hesaplanır; **betimleyicidir (°C vermez)**. |
| Mutlak sıcaklık için arazi (TPI/birikim/SVF) radyatif düzeltmesi | **NO-GO** | 68 istasyonda çapraz doğrulamada RMSE iyileşmedi (4,10 → 4,38 K) ve katsayı işaretleri literatürün tersi; hedef bölgede yerel ölçüm ağı yok. |
| Gece don riski (olasılıksal, 3 gece, saatlik) | **KOŞULLU GO** | Ham ERA5-Land hedefe en yakın istasyonda **−2,8 K soğuk** (gözlem min 0,7 °C iken model 15 gece ≤ 0 °C): yerel sapma düzeltmesi + geniş belirsizlik şart; **tahmin (forecast) başarımı bu spike'ta ölçülmedi** (aşağıda §5, Dilim 1'in ilk işi). |
| Bahçe içi göreli soğuk nokta haritası (30 m) | **KOŞULLU GO** | Yalnız bahçe içi rölyef ≥ 10 m ve eğim ≥ 3° ise; jlnnlk ve soğuk hava'da rölyef 8–13 m, TPI std 0,5 m (DEM gürültüsü düzeyi) → bu bahçelerde «ayrım yok» yazılır. |
| Zarar eşikleri (sıcaklık × süre × fenoloji) | **KOŞULLU GO** | Çiçek/meyve için kaynaklı sayılar var; **yaprak ve odun için limona özgü sayısal kaynak bulunamadı** (uydurulmadı). |

**Önemli yan bulgu (mevcut ürünü ilgilendirir):** Don olay motoru ve Durum riski ERA5 (Open-Meteo) günlük minimumunu kullanıyor. Mersin kıyısında bu veri sistematik soğuk: 5 kışta (2019–2024) Mersin istasyonu en düşük +0,7 °C ölçtü, ERA5-Land aynı günlerde 15 gece ≤ 0 °C verdi (en düşük −4,7 °C). Yani **mevcut «don» olaylarının bir kısmı model artefaktı olabilir** (bkz. ADR 0021 / `on-dogrulama-raporu.md`: don olaylarının çoğu «belirsiz»). Bu, Dilim 1'de olay motoruyla birlikte ele alınmalı (onayınıza bağlı).

## 1. Topografya (Copernicus DEM GLO-30)

**Kaynak:** Copernicus DEM GLO-30 (30 m), AWS Açık Veri (`copernicus-dem-30m`, anonim, ücretsiz). UTM'e 30 m'ye bilineer yeniden örneklenir. **Yöntemler:** eğim/bakı — Horn (1981); TPI — Weiss (2001) (disk, 300 m ve 1000 m yarıçap, merkez hariç); akış birikimi — D8 üzerinde priority-flood doldurma (Barnes vd. 2014) + yukarı havza alanı; çanak derinliği = doldurulmuş DEM − DEM; gökyüzü görüş faktörü — Zakšek vd. (2011), 16 yön, 1 km. Akış birikimi için 5 km pencere (havza kesilmesin), raporlanan değerler 1 km çevre için geçerli.

| Saha | Yükseklik | Eğim | Bakı | TPI 300 m | TPI 1 km | Akış birikimi | Çanak | SVF |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **jlnnlk** (kıyı ovası) 36,664 N 34,380 E | 44 m | 2,1° | GD 144° | +0,7 m | +1,7 m | 0,4 ha | 0 | 0,98 |
| soğuk hava (kıyı ovası; jlnnlk'e ~100 m) | 46 m | 2,1° | GD 152° | +0,9 m | +1,6 m | 0,5 ha | 0 | 0,98 |
| **vadi tabanı** (akarsu yatağı çevresi) 36,616 N 34,189 E | 262 m | 3,0° | GD 146° | −31 m | −69 m | 1561 ha | 0 | 0,80 |
| **yamaç** (kuzey bakılı) 36,712 N 34,409 E | 122 m | 9,9° | K 14° | +4,0 m | +3,9 m | 0,2 ha | 0 | 0,92 |

Saha seçimi nesnel kriterle DEM'den yapıldı (Limonlu–Erdemli çevresi ±14 km): vadi tabanı = eğim < 5°, TPI-1 km −70…−12 m, birikim > 80 ha, SVF > 0,78, en düşük skor; yamaç = eğim 10–20°, |TPI| < 6 m. Kapalı çanak (çukur derinliği > 0) bu bölgede bulunmadı: akarsu vadileri açık drenajlı → «çanak» göstergesi bu bölgede fiilen «0» çıkar, soğuk hava birikimi **akış birikimi + TPI** ile okunmalıdır.

**Bahçe içi çözünürlük (poligon üzerinde):** jlnnlk 15,1 da = 30 piksel (30 m, `all_touched`), yükseklik 41,5–49,6 m, TPI-300 std 0,53 m, SVF 0,976–0,990. Soğuk hava 25,1 da = 46 piksel, 40,4–53,6 m, std 0,48 m. Copernicus GLO-30'un dikey doğruluğu birkaç metredir; bu bahçelerde bahçe-içi göreli fark **DEM gürültüsü düzeyindedir**. Kural önerisi: bahçe içi harita yalnız `yükseklik aralığı ≥ 10 m` **ve** `ortalama eğim ≥ 3°` ise çizilir.

## 2. Gece sıcaklık düzeltmesi

**Veri:** ERA5-Land saatlik 2 m sıcaklık ve ERA5 bulut/rüzgâr (Open-Meteo arşivi; Muñoz-Sabater vd. 2021). Önemli doğrulama: Open-Meteo, ERA5 değerini **zaten kendi 90 m DEM'ine göre** 6,5 K/km ile ölçekler (aynı nokta `elevation=0` → `500` verildiğinde 4,9 → 1,6 °C). Yani «ham» = Open-Meteo'nun rakım ölçeklediği değer (uygulamanın bugün kullandığı); ayrıca Copernicus rakım düzeltmesi eklemek yalnız artık farktır.

**Denenen formül.** `T_min,düzeltilmiş = T_min,ERA5L + ΔT_rakım + 1[açık ∧ sakin]·(β₀ + β·x)`; `ΔT_rakım = −0,0065·(z_Copernicus − z_OpenMeteo)` (standart atmosfer gradyanı); `x = [TPI₃₀₀/10 m, TPI₁₀₀₀/50 m, log₁₀(birikim ha), SVF−1]`; açık = ERA5 bulut < %30, sakin = rüzgâr < 2 m/s (00–07 yerel ortalaması). Terim yalnız açık+sakin gecelerde uygulanır (istenen koşul). **Katsayı kaynağı:** literatürde bölgeye aktarılabilir sabit katsayı **yok**: Chung ve Yun (2006) soğuk hava birikim potansiyelinin logaritmasına karşı sıcaklık sapmasını Kore'de 8 konumda regresyonla kestirir (r² = 0,78, 10 m DEM); Lundquist, Pepin ve Rochford (2008) çanak bölgelerini DEM'den sınıflar ve interpolasyon RMSE'sini düşürür ama sabit bir °C değeri vermez. Bu yüzden β'lar **veriden** (sırt regresyonu, istasyon-bırak-biri-dışarıda) kestirildi ve literatür yönüyle karşılaştırıldı.

**Sınama verisi:** Meteostat'ta Türkiye'nin 68 WMO istasyonu (17xxx), 2019-11 → 2025-03 kış (Kas–Mar) **ölçüm kaynaklı** `tmin` (model dolgusu hariç; `data.meteostat.net`), 43 480 istasyon-gecesi, 9 274'ü açık+sakin. Her istasyonun DEM profili hesaplandı.

| Model (LOSO) | Tüm geceler: yanlılık / MAE / RMSE (K) | Açık+sakin: yanlılık / MAE / RMSE (K) |
|---|---|---|
| Ham ERA5-Land | +0,02 / 2,47 / 3,29 | **+1,38** / 3,16 / 4,10 |
| + Rakım düzeltmesi (Copernicus) | +0,23 / 2,66 / 3,81 | +1,58 / 3,37 / 4,67 |
| + Yalnız açık+sakin sapması (arazi yok) | — | −0,21 / **2,97** / **3,91** |
| + Radyatif arazi terimi (β₀+β·x) | −0,12 / 2,61 / 3,73 | −0,05 / 3,12 / 4,38 |

Yorumlar: (a) Rakım düzeltmesi **kötüleştirdi** (iki DEM arasındaki fark gürültü; Open-Meteo zaten ölçekliyor) → önerilmez. (b) Ülke genelinde açık+sakin gecelerde ERA5-Land **+1,4 K sıcak**; ama bu **bölgesel**: Akdeniz kıyı şeridindeki 8 istasyonda (Muğla, Dalaman, Finike, Mersin, Adana×2, İskenderun, Ercan) yanlılık −0,02 K (MAE 2,08, RMSE 2,52), ülke geneli sapmayı oraya taşımak MAE'yi 2,08 → 2,49 yapıyor. (c) Arazi terimi katsayıları (ortalama ± std, 68 katman): TPI-300 −0,35 ± 0,09 K/10 m, TPI-1 km +0,07 ± 0,11 K/50 m, log₁₀ birikim +0,40 ± 0,09, SVF −9,0 ± 0,4; literatür beklentisi TPI↑ → daha ılık (+), birikim↑ → daha soğuk (−): **TPI-300 ve birikim işaretleri beklentinin tersi**. İstasyonlar havalimanı/şehir; arazi çeşitliliği ve rakım karışık (örn. Yozgat 1413 m ↔ Mersin 3 m) → arazi etkisi rakım/iklimle karışıyor, 9 km ERA5-Land hücresi nokta ölçümünü temsil etmiyor. **Sonuç: arazi düzeltmesi mevcut veriyle doğrulanamıyor.**

**Hedef bölge (Akdeniz kıyı şeridi), istasyon bazında ERA5-Land yanlılığı (K, model − gözlem; açık+sakin gece):** Mersin 17340 (3 m): **−3,22** (tüm geceler −2,76; 5 kışta −2,4…−3,1: **sistematik ve kararlı**); Adana İncirlik (73 m) −0,34; Adana Şakirpaşa (20 m) −1,39; İskenderun (3 m) −0,83; Ercan (100 m) +0,08; Finike (3 m) +0,06; Muğla (646 m) +2,43; Dalaman (7 m) +2,37. Yani yerel sapma ±3 K'e varıyor ve «kıyı» tek başına belirleyici değil; bu, don eşiği çevresindeki 1–2 K'lik marjdan **büyüktür**. Tam tablo: [`don-dilim0/istasyonlar.csv`](don-dilim0/istasyonlar.csv), [`istasyon-degerlendirme.json`](don-dilim0/istasyon-degerlendirme.json).

**Don tespiti (açık+sakin geceler, ≤ 0 °C gözlem; 5 045 gece):** ham POD 0,68 / FAR 0,14; yalnız-sapma POD 0,81 / FAR 0,19; arazi terimli POD 0,79 / FAR 0,19. Akdeniz kıyı şeridinde (81 don gecesi): ham POD 0,33 / FAR 0,25; ülke geneli sapma düzeltmesi POD 0,65 / FAR 0,37 (bölgeye aktarılan düzeltme yanlış alarmı artırıyor).

## 3. Geriye dönük sınama — Şubat 2025 don olayı

Katalog (`dis_olay_katalogu.json`): «Mersin'deki Don Afeti Narenciye Üretimini Tehdit Ediyor» (Haberler.com, 04.06.2025), **gün belirtilmemiş**, il düzeyi, limon etkilendi. Olay motoru: soğuk hava 22–23.02.2025, jlnnlk 17.02–13.03.2025 «şiddetli».

| Gece (yerel gün) | Mersin istasyonu (gözlem) | ERA5-Land: Mersin noktası | jlnnlk | soğuk hava | vadi tabanı | yamaç |
|---|---:|---:|---:|---:|---:|---:|
| 20.02 | 7,7 | 4,9 | 4,1 | 4,1 | 3,0 | 3,7 |
| 21.02 | 5,5 | 1,3 | 0,2 | 0,2 | −0,9 | −0,2 |
| **22.02** | **2,2** | −0,4 | **−5,2** | −5,2 | −2,1 | −5,7 |
| **23.02** | **0,7** | −1,0 | −3,7 | −3,7 | −1,7 | −4,1 |
| 24.02 | 1,7 | −1,1 | 1,5 | 1,5 | −1,5 | 1,0 |
| 25.02 | 1,9 | 2,0 | 1,1 | 1,1 | 2,1 | 0,6 |

Şubat 2025 boyunca Mersin istasyonu − ERA5-Land: ortalama **+3,36 K** (n = 28, MAE 3,37): model gözlemden sürekli soğuk. 22–23 Şubat gecelerinde gözlenen en düşük **+0,7 °C** (don yok), modelin bahçe noktaları −3,7…−5,7 °C verdi. İstasyon hâlâ 26 km uzaktaki kıyı/kent noktası; bahçelerdeki gerçek değer **bilinmiyor**; habere göre don o dönemde Mersin'de hasar yaptı (Toroslar dahil) — yani gerçek bahçe sıcaklığı istasyondan düşük olabilir ama modelin −5 °C'si doğrulanmış değil.

**Önemli teknik uyarı (ERA5-Land hücre artefaktı):** vadi tabanı (−2,1) ile yamaç (−5,7) ve jlnnlk (−5,2) arasındaki farklar arazi değil **9 km ızgara hücresi** farkıdır (jlnnlk ve soğuk hava aynı hücre: değerler birebir aynı). Ayrı hücrelerdeki noktalar arasında arazi sinyali ile hücre gürültüsü ayrışmıyor.

**MODIS gece LST (MOD/MYD11A1, 1 km; Planetary Computer):** 2022-11 → 2025-03, 1 763 geçişin yalnız 70 kış geçişinde dört noktada birden kaliteli LST var. **22–23 Şubat gecelerinde bahçe piksellerinde geçerli LST yok** (bulut/kalite maskesi); yalnız vadi pikselinde 23.02 (Terra) −0,9 °C ve 21.02 (Aqua) 1,6 °C. Yani olay MODIS ile bahçede doğrulanamıyor. 70 açık geçişte: vadi − jlnnlk **+0,58 ± 1,45 K**, yamaç − jlnnlk **+1,09 ± 0,95 K** (Aqua ≈ 01:30: +0,89 / +1,27). Yani bölgede **alçak kıyı ovası vadi ve yamaçtan daha soğuk** — «vadi tabanı = en soğuk» varsayımı bu bölgede (1 km çözünürlükte) desteklenmedi; yamaç ≈ 1 K ılık (termal kuşak ile uyumlu) yönü destekleniyor. LST hava sıcaklığı değildir; 1 km piksel 30 m öznitelikleri çözmez.

**Sonuç tablosu — düzeltilmiş tahmin ham ERA5'ten iyi mi?** Hedef bölge istasyonlarında hayır: ülke geneli kestirilmiş düzeltme (sapma veya arazi) bölgeyi kötüleştiriyor; arazi terimi hiçbir kümede MAE iyileştirmedi; Şubat 2025 olayında ham model Mersin'de 3,4 K soğuk (bahçe için doğrulama verisi yok). İyileştirme yalnız **yerel (istasyon/sensör) sapma düzeltmesi** ile mümkün görünüyor: Mersin'de sapma yıllar arası kararlı (−2,4…−3,1 K, σ 1,4 K).

## 4. Narenciye/limon zarar eşikleri (kaynaklı)

| Organ / dönem | Kritik sıcaklık (donma başlangıcı) | Kaynak |
|---|---|---|
| Çiçek tomurcuğu ve çiçek | **−2,8 °C** (27,0 °F) | UC ANR 8100 Tablo 2; FAO Tablo 4.10 (Puffer ve Turrell 1967) |
| Yeni meyve («button», < 13 mm) | UC: −1,4…−0,8 °C; FAO: −1,4…−0,8 °C | aynı |
| Yeşil meyve (> 13 mm) | UC: −2,8…−1,4 °C; FAO: −1,9…−1,4 °C | aynı (iki kaynak farklı) |
| Olgun meyve (ağaçta) | UC: −3,3…−0,8 °C; FAO: −1,4…−0,8 °C | aynı (UC aralığı daha geniş) |
| Yaprak, sürgün, odun | **limona özgü sayısal kaynak bulunamadı** | UC IPM ve FAO sayfaları yalnız niteliksel (uç ölümü); FAO Bölüm 4: «hafif dayanıklı subtropik meyve ağaçları ≈ −5 °C'ye kadar» (narenciye adı anılmıyor) |
| Hassasiyet sıralaması | limon ağacı «yüksek hassasiyet» (portakal/greyfurt orta) | UC ANR 8100 Tablo 1 |

**Süre ve nem.** UC (Tablo 2 notu): kritik sıcaklık nem ve süreden etkilenir, meyve kuru havada ve kısa sürede aralığın düşük ucuna dayanır. FAO: kısa süreler için (2–24 sa) donma hasarının süreden bağımsız olduğunu (Levitt 1980), sıcaklığın süreden önemli olduğunu belirtir; meyve sıcaklığı hava sıcaklığından birkaç derece sıcak kalıp geriden gelir (büyük meyvede gecikme fazla); islak meyve yaş termometre sıcaklığına doğru soğur. Florida IFAS özetleri (arama özeti, birincil kaynak doğrulanmadı): yuvarlak portakalda ≈ 4 sa −2,2 °C'de meyve hasarı başlar; en hassas yeni sürgünün %50'si 2 sa, %90'ı 3 sa −2,2 °C'de ölür. **İki kaynak süre konusunda çelişiyor → süreyi eşik değil uyarı seviyesi için kullanın.**

**Katalog önerisi (ön değer · mühendis onayı bekliyor):**

```yaml
don:
  durum: dogrulanmadi
  kaynak: "UC ANR 8100 (Geisel ve Unruh 2003) Tablo 2; FAO Frost Protection Böl. 4 Tablo 4.10 (Puffer ve Turrell 1967)"
  kritik_c:            # donma başlangıcı; iki kaynağın DAHA MUHAFAZAKÂR (yüksek) ucu
    cicek_tomurcuk: -2.8
    yeni_meyve: -0.8
    yesil_meyve: -1.4
    olgun_meyve: -0.8
    yaprak_odun: null   # kaynak yok: model dışı; mühendis girdisi gerekli
  hata_payi_c: 2.5      # ERA5-Land gece Tmin RMSE (Akdeniz kıyı şeridi, açık+sakin; §2) — risk olasılığında σ
```

Fenoloji eşlemesi mevcut katalog evrelerinden (çiçeklenme, meyve tutumu, meyve büyümesi, olgunlaşma) yapılacak; hangi evrede hangi satırın geçerli olduğu mühendis onayına bağlıdır.

## 5. Önerilen risk modeli, belirsizlik, go/no-go

**Model (Dilim 1 önerisi, olasılıksal):** her gece ve saat için bahçe sıcaklığı `T ~ N(μ, σ²)`; `μ` = (tahmin ya da ERA5-Land) saatlik 2 m sıcaklığı + **yerel sapma düzeltmesi** (en yakın referans istasyondan; Mersin için kararlı −2,8 K, yalnız açık+sakin gecelerde −3,2 K; «ön değer · yerel ölçümle iyileşir» etiketi); `σ` = 2,5 K (Akdeniz kıyı şeridi RMSE; sapmanın konumsal belirsizliği dahil). Evreye göre `P(T_min ≤ kritik_c)` ve eşik altı saat sayısı → seviye: **Düşük** (P < %10), **İzle** (%10–30), **Uyarı** (%30–60), **Yüksek** (> %60) — bu olasılık sınırları ön değerdir ve mühendis onayı gerektirir; süre (≥ 1 sa eşik altında) yalnız seviyeyi bir kademe artırır, eşik değiştirmez (§4). Arazi etkisi sıcaklığa **eklenmez**; yalnız (i) bahçenin betimleyici profili (eğim, bakı, TPI, birikim, SVF) ve (ii) koşul sağlanırsa bahçe içi **göreli** «daha soğuk/daha ılık» etiketi gösterilir (°C verilmez).

**Belirsizlik özeti:** σ ≈ 2,5 K, eşik marjından büyük → çoğu gece seviye «İzle» ile «Uyarı» arasında kalır; keskin «don olacak» iddiası yapılmaz. Mersin kıyısında ham modelle yanlış alarm (15/5 yıl) düzeltmeyle azaltılır, ama düzeltme tek istasyona dayanır.

**Açık riskler / bu spike'ta yapılmayanlar:**
1. **Tahmin başarımı ölçülmedi.** Dilim 0 yalnız geçmişe dönük (yeniden analiz) sınadı; 3 gecelik **tahmin** için (Open-Meteo tahmin / ECMWF IFS / ICON) gece minimum sapması istasyonlara karşı ayrıca ölçülmeli → Dilim 1'in ilk adımı.
2. Hedef bölgede yalnız 8 düz/kıyı istasyonu var; yamaç/vadi için yer gerçeği yok. Çözüm: çiftçi/istasyon termometresi (sahada ölçüm girişi) ve olay sonrası geri bildirim (TARSİM/hasar) ile kalibrasyon.
3. Mersin istasyonu şehir/kıyı noktası (3 m); bahçeye 26 km: sapmanın bahçeye aktarılabilirliği doğrulanmadı.
4. ECOSTRESS gece geçişi (70 m) ile bahçe-içi doğrulama denenmedi (geçiş seyrek); isteğe bağlı Dilim 1 ek işi.

**Öneri:** Dilim 1'e **daraltılmış kapsamla** geçilsin: (a) topografya profili (betimleyici); (b) gece don riski — olasılıksal, yerel sapma düzeltmeli, tahmin başarımı sınaması ilk iş; (c) olay motorundaki ERA5 don tespitinin Mersin sapmasıyla yeniden değerlendirilmesi (onaya bağlı); (d) altın bahçe testine don çıktısı. Mutlak arazi sıcaklık düzeltmesi **yapılmasın**.

## Kaynaklar

- Copernicus DEM GLO-30, AWS Open Data: <https://registry.opendata.aws/copernicus-dem/> (kaynak URL deseni: `copernicus-dem-30m.s3.amazonaws.com`).
- Horn, B.K.P. (1981) Hill shading and the reflectance map, Proc. IEEE 69(1). · Weiss, A. (2001) Topographic position and landforms analysis (ESRI UC poster). · Barnes, R., Lehman, C., Mulla, D. (2014) Priority-flood, Computers & Geosciences 62:117–127. · Zakšek, K., Oštir, K., Kokalj, Ž. (2011) Sky-view factor as a relief visualization technique, Remote Sensing 3(2):398–415.
- Chung, U., Yun, J.I. (2006) Minimum temperature mapping over complex terrain by estimating cold air accumulation potential, Agric. For. Meteorol. 137(1):15–24, doi:10.1016/j.agrformet.2005.12.011 (özet incelendi; tam metin okunmadı). · Lundquist, J.D., Pepin, N., Rochford, C. (2008) Automated algorithm for mapping regions of cold-air pooling in complex terrain, J. Geophys. Res. 113, D22107 (özet incelendi).
- Muñoz-Sabater, J. vd. (2021) ERA5-Land, Earth Syst. Sci. Data 13:4349–4383. · Open-Meteo arşiv API: <https://archive-api.open-meteo.com/v1/archive>. · Meteostat: <https://data.meteostat.net> (günlük, ölçüm kaynaklı).
- MODIS MOD/MYD11A1 v061 (LST, 1 km), Microsoft Planetary Computer STAC: <https://planetarycomputer.microsoft.com/dataset/modis-11A1-061>.
- Geisel, P.M., Unruh, C.L. (2003) Frost Protection for Citrus and Other Subtropicals, UC ANR Publication 8100: <https://escholarship.org/uc/item/5hh528qp> (Tablo 1–2). · Snyder, R.L., de Melo-Abreu, J.P. (2005) Frost Protection: fundamentals, practice and economics, FAO Environment and Natural Resources Series 10, Böl. 4 (Tablo 4.10: Puffer ve Turrell 1967): <http://www.fao.org/4/y7223e/y7223e0a.htm>. · Purdue MRCC kritik sıcaklık tablosu (FAO Tablo 4.10'un yeniden yayını): <https://mrcc.purdue.edu/VIP/cropspecs>. · UF/IFAS narenciye donma kılavuzları (arama özeti; birincil metin doğrulanmadı): <https://edis.ifas.ufl.edu/publication/CH182>.

## Yeniden üretme

```bash
cd bahcelab-backend
PYTHONPATH=src:. .venv/bin/python -m scripts.don_dilim0.veri_topla <klasör>      # 68 istasyon: gözlem + ERA5 + profil
PYTHONPATH=src:. .venv/bin/python -m scripts.don_dilim0.degerlendir <klasör>     # LOSO tablosu
PYTHONPATH=src:. .venv/bin/python -m scripts.don_dilim0.modis <çıktı.json> 2022-11-01 2025-03-31 36.66392,34.38001 …
```
