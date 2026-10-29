# 0021 — Olay ön doğrulaması: bağımsız dış kanıt

Durum: kabul edildi. Tarih: 2026-10-29.

## Bağlam
Saha Defteri'nde (ADR 0019) üretici her olayı tek tek işaretlemek zorundaydı. Olay motorunun girdisinden (ERA5, Sentinel-2, HLS, Sentinel-1, Open-Meteo) **bağımsız** kaynaklar bir ön yargı verirse üretici yalnız çelişen ya da kanıtsız olaylara bakar.

## Kararlar
1. **Kanıt kaynakları yalnız ikidir:** (a) istasyon günlük gözlemi (Meteostat toplu veri = NOAA ISD tabanlı; soyut `StationProvider`: `MeteostatProvider`, elle temin edilen `CsvStationProvider` — MGM vb. aynı arayüz), (b) elle derlenmiş kamu kayıtları kataloğu (`dis_olay_katalogu.json`, her satır kaynak URL'li). **Bağımsızlık yapıdadır:** `domain/evidence` paketi ERA5, edinimler, HLS, radar, hava, olay, NDVI, su, çok yıllı ve biyofizik modüllerini içe aktaramaz (testle denetlenir, AST taraması).
2. **Yalnız gerçek gözlem:** Meteostat günlük CSV'si istasyonun gözlem envanteri dışındaki günler için model/dolgu değeri içerir. Gözlem aralığı = `inventory.daily.{start,end}`; dışındaki satırlar `model` işaretlenir, **veritabanına yazılmaz** ve kuralda yeniden dışlanır (çifte güvence).
3. **Kural (`domain/evidence/rules.py`, SAF; eşikler katalogda `dis_kanit`, «ön değer · mühendis onayı bekliyor»):** pencere = olay ±1 gün. Don: istasyon min ≤ 0 °C → destek; tüm istasyonlar ≥ 5 °C → çelişki; arası **sınırda = kanıt yok** (kıyı istasyonu bahçeden ~26 km uzakta, küçük farklar çelişki sayılmaz). Aşırı yağış: günlük ≥ 20 mm destek, tümü ≤ 5 mm çelişki. Rüzgâr/optik/radar için istasyon ölçümü yoktur; yalnız kamu kaydı bakılır. Kamu kaydı **destek** üretir, çelişki üretmez (yokluğu yokluk kanıtı değildir). **Veri yoksa «kanıt yok»; «destekleniyor» asla varsayılmaz.** Kaynaklar ayrışırsa (istasyon çelişir, kayıt destekler) sonuç «çelişiyor», neden «kaynaklar ayrışıyor».
4. **Ön yargı türetilir, saklanmaz** (kart okunurken hesaplanır); çiftçi doğrulaması (`event_verifications`) aynen kalır, ön yargı onun yerine geçmez. `GET /gardens/{id}/dogrulama` kartta `on_yargi {sonuc, kanitlar[{kaynak, yon, metin, baglanti}], neden}` ve listede `dogrulanacak` sayısı döner.
5. **Doğruluk özeti iki ayrı sayı verir:** üretici doğrulaması (mevcut, n ≥ 5 kuralı) ve dış kaynak desteği (`dis_destekleniyor / dis_celisiyor / dis_kanit_yok`). Kanıtsız olay desteğe sayılmaz.
6. **Arayüz:** her olay kartında ayrı rozet («Dış kaynak destekliyor / çelişiyor», «Dış kanıt yok»), açılınca kaynak adı ve bağlantı; varsayılan liste **«Doğrulamanız gereken»** (yanıtsız + çelişen/kanıtsız olay); «Yanıt bekleyen» ve «Hepsi» süzgeçleri durur.
7. **Veri akışı:** `refresh_stations` günlük iş (05:00), idempotent upsert; `stations` + `station_daily` tabloları (migrasyon 034). Bahçeye 80 km içindeki en yakın 3 istasyon.
8. **Kamu kayıtları kataloğu:** web aramasında Erdemli/Mersin için tarihi ve kaynağı doğrulanabilir kayıt bulunamadığından **boş şemayla** gönderildi (`docs/agro/dis-olay-katalogu.md`); kayıt uydurulmaz.

## IMERG geçmişi (2015→)
Aynı sürümde: `imerg_gecmis` kaynağı (`feed_runs`, CHECK genişletildi), `refresh_imerg_history` işi (15 dk bekçi aralığı). Kapı: tüm bahçelerde güncel `imerg` ve `smap` `tamam` olmadan başlamaz; bir çağrıda tek bahçe; kesilen/başarısız iş mevcut yeniden deneme kuralıyla devam eder; `resume_feeds` yalnız kesilmeyi bildirir, tam besleme başlatmaz.

## Sonuçlar ve sınırlar
Ön yargı yalnız tek bir istasyonla (Mersin 17340, ~26 km, gözlem 28 Şub 2026'ya kadar) sınırlıdır; sonrası «kanıt yok». MGM verisi elde edilirse `STATION_PROVIDER=csv` ile eklenir. Eşikler mühendis onayı bekler.

## Düzeltme (aynı gün, kullanıcı geri bildirimiyle)
1. **«Belirsiz» ile «kanıt yok» ayrıldı.** kanıt yok = pencerede hiç bağımsız veri yok; belirsiz = veri var ama eşikler arasında (don: 0–5 °C, yağış: 5–20 mm). Rozet, süzgeç ve doğruluk özeti dört sonucu ayrı gösterir. «Doğrulamanız gereken»: çelişen, belirsiz, kanıt yok — bu sırayla. Belirsiz kanıt metni ölçülen değeri, istasyonun bahçeye uzaklığını, rakımını ve kıyı/iç etiketini yazar (etiket rakıma dayalıdır: `kiyi_rakim_azami_m` = 50 m; kıyı çizgisi verisi yok).
2. **Veri kaynağı değişti.** `bulk.meteostat.net/v2` günlük dosyaları **Mart 2026'dan beri güncellenmiyor** (17340: 09.03.2026; liste 30.03.2026) ve değer kaynağı içermiyor; 28 Şubat 2026 sonrasının «kanıt yok» çıkma nedeni budur (istasyon değil, kaynak gecikmesi). `data.meteostat.net/daily/<yıl>/<id>.csv.gz` güncel (26.10.2026) ve her değer için kaynak taşır. **Gözlem = kaynak `ghcnd/isd/isd_lite/synop/metar`**; `metno_forecast` ve bilinmeyen her kaynak gözlem sayılmaz. Eski toplu dosya model dolgusunu da gözlem sayıyordu: ilk rapordaki dağılım düzeltildi. Gözlem aralığı artık envanterden değil gerçek gözlem günlerinden türetilir; eşitleme, kaynağın gözlem saymadığı günleri veritabanından siler (yeniden eşitleme).
3. **İstasyon kapsamı:** `docs/agro/istasyon-kapsami.md` (`scripts/report_station_coverage.py`). 80 km içinde yalnız Mersin 17340 var; iç kesim istasyonu yok (en yakın iç/yüksek istasyon Niğde 17250: 147 km, 1208 m, kullanılmıyor).
4. **Kamu kaydı:** iki il düzeyi kayıt eklendi (`yer_duzeyi: il`, `tarih_bitis`). İl düzeyi kayıt bahçe olayını destekleyebilir; rozet ve kanıt metni «il düzeyi kayıt» yazar. Optik/radar olayları herhangi bir hava/hasar kaydıyla açıklanabildiğinden don kaydı optik olayı da destekler.
