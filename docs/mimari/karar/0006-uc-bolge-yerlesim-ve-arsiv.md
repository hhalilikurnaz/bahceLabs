# ADR 0006 — Üç bölgeli yerleşim ve görüntü arşivi

**Durum:** kabul (Adım 7B-2)

**Bağlam.** 7B-1'de bahçe sayfası sol panelin genişlemiş hâliydi; liste kayboluyor, harita daralıyordu. Ana ekranda tarih şeridi, görünüm paneli ve kaydırıcı gibi uzman denetimler vardı; çiftçi açtığında "güncel durum" yerine denetimlerle karşılaşıyordu.

**Karar.**
1. **Yerleşim:** sol liste (sabit 360 px) | harita | sağ bahçe paneli (varsayılan görünümün %40'ı, 440–920 px, sürüklenir/klavyeyle ayarlanır, `localStorage`). Genişlikler `lib/layout.ts` içinde saf fonksiyonlarla hesaplanır, CSS değişkenleriyle (`--list-w`, `--detail-w`, `--map-left`, `--map-right`) dağıtılır; harita odaklaması bu sınırları dolgu olarak kullanır. Copilot çekmecesi mevcut `Drawer` ile sağ panelin üstüne biner.
2. **Ana ekran = en güncel geçerli görüntü.** Tarih seçimi, karşılaştırma ve zaman atlaması ana haritadan kaldırıldı (`DateStrip`, `ViewPanel`, `SwipeHandle` silindi; store'dan `selectedDate/degisim/karsilastirma/oynat/hiz` çıktı).
3. **Görüntü arşivi** `/bahcem/:id/arsiv?...`: durum adreste (`lib/archive.ts`). Çizim, haritayla ortak `lib/rasterRender.ts` ile yapılır; değişim/karşılaştırma bu modülde, MapLibre'den bağımsız canvas'ta yürür. Liste `GET /gardens/{id}/indeks/arsiv` (sezon, net/en net işareti, sayfalı; eşikler `config.py`).
4. **Renk:** "Bahçenin kendi farkları" (p2–p98 gerilmiş; yayılım parametre aralığının `RASTER.homogeneityRangeShare` payından azsa "Bahçe homojen") ve "Genel skala" (sabit). Renk körlüğü seçeneği viridis / mavi–turuncu skalaları kullanır. Bölgeler indeks skalasından ayrı mor tonlarda, saydam dolgu ve yumuşatılmış (Chaikin) sınırla çizilir.
5. **Durum rengi tek kaynak:** değişim yüzdesi kırmızı/sarı yalnızca sunucu uyarısı varsa boyanır; aksi hâlde nötr "mevsim normali içinde".

**Sonuçlar.** Harita sayfası JS'i küçüldü (uzman denetimleri arşiv parçasında değil ama ana ekrandan çıktı); mobilde bahçe paneli listeyi örter, arşivde tarihler alt sayfadadır. Yeni görünümler `ViewSettings` tek tipinde birleşir; yeni parametre eklemek yalnızca `indices.ts` tanımını gerektirir.

**Geri dönüş.** Yerleşim yalnızca `usePanelLayout`/`BahcemLayout` içindedir; eski tek sol panele dönmek bu iki dosyayı etkiler.
