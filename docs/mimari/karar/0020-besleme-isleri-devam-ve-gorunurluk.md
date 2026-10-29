# 0020 — Besleme işlerinin devam etmesi ve düşünce görünür olması (feed_runs)

Durum: kabul edildi. Tarih: 2026-10-29.

## Bağlam
ERA5, HLS, IMERG ve SMAP çekimleri uzun süren arka plan işleridir. Docker/işçi yeniden başlayınca yarıda kalıyor, kimse fark etmiyordu: 9G sonunda iki bahçede ERA5 8–21 gün, IMERG 11 gün geride, `soğuk hava` bahçesinde IMERG/SMAP hiç çekilmemişti. Sulama planı (9H) yağış ve toprak nemi verisine dayanacağı için bu sessiz kayıp kabul edilemez.

## Kararlar
1. **Veri idempotent, iş durumu ayrı tabloda.** Veri tabloları (era5_daily, hls_observations, dogrulama_gozlem) zaten idempotent upsert / eksik-gün mantığıyla yazılır ve parça parça kalıcıdır (IMERG/SMAP 30 günlük parçalar, en yeni önce). `feed_runs` yalnızca «son çalışma nasıl bitti» kaydıdır: bahçe × kaynak (`era5 | hls | imerg | smap`) başına tek satır; `durum` = calisiyor · tamam · hata · kesildi · atlandi, `deneme`, `kalp_atisi`, `ilerleme`, `hata`.
2. **İzleyici (`tracked`)** her aşamayı sarar: başlangıçta satır, çalışırken 30 sn'de bir kalp atışı, başarıda `tamam` (deneme sıfırlanır); istisnada `hata` + log (ERROR) + bildirim ve istisna yeniden fırlatılır; iptalde (süreç kapanıyor) `kesildi` (bildirimsiz). Bahçe silinmişse hata alarm sayılmaz. İzleme hiçbir zaman işi bozmaz (kayıt hataları yutulur).
3. **Sessiz «tamam» yok:** belirteç yoksa `atlandi` + neden; > 7 gün arandı ve hiç gözlem yazılamadıysa (ağ/erişim) `hata`. Küçük son gün eksikleri kaynak gecikmesidir (hata değil).
4. **Devam ettirme (`resume_feeds`):** API açılışında (inline), arq işçisi açılışında ve **15 dk'lık bekçi** işinde: kalp atışı kesilen `calisiyor` işler `kesildi` olur (açılışta eşik 1 dk, bekçide 3 dk) ve bildirilir; `kesildi` hemen, `hata` **15 dk geri çekilmeyle ve en çok 4 denemeye kadar** `run_garden_feed` ile yeniden başlatılır (aynı bahçe için ikinci kopya başlamaz). Limit dolunca iş kendiliğinden denenmez ama «tekrar tekrar başarısız» bildirimi ve `feed_runs` satırı görünür kalır.
5. **Bildirim:** yeni tür `besleme` («Veri akışı»); **özeti beklemez**, listede anında görünür (`publish_operational`); anahtar bahçe × kaynak × olay × gün (günde bir); «denemeyi bıraktı» ayrı bildirimdir.
6. **Başlamış iş iptal edilmez:** bahçe silinince yalnız henüz başlamamış besleme görevi iptal edilir; çalışan görev veritabanı işlemi ortasında kesilmez (yarıda kesilen asyncpg işlemi havuz bağlantısını sızdırıp API'yi kilitledi — CI'da gözlendi) ve bir sonraki aşamada `garden_exists` ile sessizce biter.
7. **Kapsama raporu** (`scripts/report_feed_coverage.py` → `docs/agro/besleme-kapsami.md`): kaynak başına tarih aralığı ve eksik gün sayısı. Elle devam: `scripts/besleme_devam.py` (varsayılan dry-run, kapsam, yedek, onay).

## Sonuçlar
Docker/işçi düşse bile işler açılışta kaldığı yerden sürer; sürmüyorsa bildirim merkezi ve log söyler. 9H, bu raporda eksik gün görünmeyen veriye dayanır.
