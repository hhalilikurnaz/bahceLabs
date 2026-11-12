# 0028 — Uydudan ETa altyapısı (Landsat/SSEBop): iç kalite, tutarlılık kapısı, kullanıcıya açılma şartları

Durum: kabul edildi (Dilim 1A). Tarih: 2026-11-12. İlgili: `docs/agro/eta-kaynak-dogrulama.md` (Dilim 0), ADR 0017 (Landsat), ADR 0023 (FAO-56 plan), `docs/agro/KURAL-DURUMU.md` (Adım 9I).

## Karar
Uydudan gerçek su tüketimi (ETa) hattı kurulur, **ama kullanıcıya gösterilmez**. Sonuç yalnız iç kalite ekranında (`/ic/kalite`, 9J'nin ilk parçası) görünür. Bir bahçe için ETa **ancak** şu iki şart birlikte sağlanınca kullanıcıya açılabilir (ayrı bir onaylı iş; bu ADR açmaz):
1. **Tutarlılık kapısı geçer** (aşağıda), ve
2. **bahçe ≥ 40 da** (Dilim 0 §6: 15 da'da 100 m termal pikselin tam içine düşen 0, bahçe payı %26) ve gösterim «bahçe + çevresi» etiketi + belirsizlik aralığıyla yapılır.
Kapı kapalıyken hiçbir kullanıcı ekranına ETa/ETf taşınmaz (e2e: sulama panel yanıtında `etf`/`eta_mm`/`ssebop` yok).

## Yöntem
`ETf = (Th − Ts)/dT`, `Th = Tc + dT`, `Tc = c·Ta`, `dT = (Rn − G)·rah/(ρ·cp)`; `ETa = ETf × ET0` (ERA5, FAO-56 çim; OpenET ETr kullanır — fark bilinen sapmadır). Saf matematik `domain/eta/ssebop.py`, birim testli; Dilim 0'daki elle hesapla aynı büyüklükler (Ra 41,66; Rso 31,28; ρ 1,177).
- **Dilim 0 bulgusu:** sahne içi soğuk referans Tc, ETf'yi ±0,2–0,5 oynatıyordu (12 Haziran 0,33 ↔ 14 Temmuz 0,90). Bu yüzden **Tc artık sahne içi referanstan değil `c·Ta`'dan** gelir; soğuk referans yalnız **c-faktörü tanılamasıdır**.
- **Uzun dönem c-faktörü:** sahne başına `c_i = Tc,soğuk_i / Ta_düz,i`; aynı mevsimde (±1 ay) **en az 8 sahnenin medyanı** uzun dönem c'dir; yayılım (MAD×1,4826) ETf belirsizliğine girer. Yeterli sahne yoksa c **uydurulmaz**, sahne elenir ve nedeni yazılır.
- **Hava sıcaklığı:** ERA5 Tmax'ın **aylık sapması Meteostat 17340 (Mersin) gözlemine göre ölçülür** (istasyon koordinatında ERA5 ↔ gözlem; ≥ 20 eşleşen gün, yoksa düzeltme yok) ve uygulanır; ayrıca ERA5 hücre yüksekliğinden bahçe DEM'ine **6,5 K/km** rakım düzeltmesi. Sınır: istasyon kıyıda (3 m), bahçeden ≈ 26 km; sapma bahçeye aynen taşınır varsayımı ön değerdir.
- **ST_QA belirsizliği:** Landsat `ST_QA` (K, ölçek 0,01) bahçe ortalaması `σ_LST`; `σ_ETf = √(σ_Ts² + σ_Tc²)/dT` (σ_Tc = c yayılımı × Ta). dT küçükse (kış) belirsizlik büyür; dT ≤ 0,5 K'de ETf tanımsız, sahne elenir.
- **Karışık piksel:** bahçe poligonu ve iç tampon (−15 m) ayrı işlenir; `karisik_pay = 1 − iç/tüm`; ETf hem tüm bahçe hem iç tampon için saklanır. Fiziksel termal çözünürlük 100 m'dir (`termal_m`), 30 m ürün yeniden örneklemedir.
- ETf bahçe ortalaması, ortalama Ts üzerinden hesaplanır (ETf Ts'de doğrusaldır; tavan/taban kırpması bahçe ortalamasında nadir).

## Tutarlılık kapısı (kullanıcıya açılma önkoşulu)
**Metrik:** kuru mevsimde (Haz–Eyl), ≤ 10 gün arayla **ardışık** temiz geçişlerde, araya ≥ 5 mm yağış girmeyen çiftlerde **|ΔETf| dağılımının p90'ı**; en az 8 çift. **p90 ≤ 0,15** ise kapı açılır; değilse ya da çift yetersizse **kapalı**. Eşikler katalogda (`eta_ic`, ön değer · mühendis onayı bekliyor). Gerekçe: aynı bahçe, yağışsız yaz ayında, bir haftada ETf'si ±0,15'ten fazla değişemez; değişiyorsa hata yöntemdedir. Alan alt sınırı (40 da) kapıya ayrıca eklenir.

## Mimari
- **Sağlayıcı soyutlaması** (`domain/eta/provider.py`): `TermalSahneSaglayici` (Landsat bugün; ileride Hydrosat/yüksek çözünürlüklü termal aynı arayüze bağlanır, hesap ve servis değişmez), `BaglamSaglayici` (WaPOR L1), `DogrulamaSaglayici` (ECOSTRESS V003). **WaPOR L2 kullanılmaz** (Türkiye kapsam dışı, Dilim 0).
- **İki aşama** (`service.py`): A `olc` (ağ/IO: ERA5, Meteostat, sahneler; 6 paralel okuma) ve B `hesapla` (yalnız veritabanı: c-faktörü, ETf, ETa, kapı). B ağ gerektirmez; eşik değişince yeniden koşar.
- **Tablolar** (migration 039): `eta_sahneler`, `eta_meteo`, `eta_baglam`, `eta_dogrulama`, `eta_kalibrasyon`, `eta_durum`.
- **feed_runs kullanılmaz:** `tracked` hata olunca kullanıcıya bildirim gönderir; iç iş kullanıcıyı ilgilendirmez. Hat `scripts/eta_calistir.py` ile koşar (zamanlanmış iş, kapı açılırsa ayrı kararla eklenir).
- **Erişim:** `/ic/eta/*` yalnız `INTERNAL_EMAILS` listesindeki kullanıcılar (boşsa kimse; `*@alan` deseni yalnız test için), aksi 403.

## Sonuç — jlnnlk 24 ay (gerçek veri)
`scripts/eta_calistir.py` jlnnlk (15,1 da) için 2024-11-12 → 2026-11-12 koştu (≈ 1 saat; 6 paralel okuma). Kaynak: `eta_*` tabloları (dev veritabanı).

| Sonuç | Değer |
|---|---|
| Geçiş (tarih başına en iyi kare) | 173 |
| Hesaplanan / elenen | **133 / 40** (elenen: 35'i bahçe %0 geçerli (bulut/maske), 2'si %11–22 geçerli, 3'ü soğuk referans piksel yetersiz) |
| **c-faktörü (uzun dönem, ay penceresi ±1)** | **0,995 – 1,013** (aylık medyan; yayılım MAD 0,003–0,019; her ay 25–44 sahne). Çok kararlı: kalibrasyon çalışıyor |
| ERA5 Tmax sapması (Meteostat 17340 − ERA5) | **+4,2 … +5,3 °C**, tüm aylarda sistematik (aylık 60–93 eşleşen gün) — düzeltme uygulandı |
| Ortalama ETf belirsizliği (σ, ST_QA + c yayılımı) | 0,34 |
| Aylık ETf medyanı | Oca–Şub ≈ 1,0 (tavan 1,05; dT 4–5 K, belirsiz), Haz 0,67, Tem 0,53, Ağu 0,51, Eyl 0,39 (aralık 0,17–0,78) |
| **Tutarlılık: p90 \|ΔETf\|** | **0,284** (38 çift; kuru mevsim, ≤ 10 gün, yağışsız) → eşik 0,15 **GEÇMEDİ** |
| **Kapı** | **KAPALI** (ayrıca bahçe 15,1 da < 40 da) |

Tanı (gerçek veri): *tekrarlanabilirlik* tabanı kapı eşiğinin üstünde. Yağışsız yazda **1 gün arayla** çiftlerde bile (27 çift, aynı hava) |ΔETf| medyanı **0,138**, p90 **0,183**; 5–10 gün arayla medyan 0,139, p90 0,328. Yani aynı bahçenin yan yana iki geçişi arasında yöntemin kendi gürültüsü ≈ 0,14. WRS-2 karesine göre sistematik fark da var (176/034 yazı ort. ETf 0,55 ↔ 175/035 0,49): termal pikselin bahçe üzerindeki yerleşimi/karışımı. Bu, Dilim 0 §6'daki çözünürlük gerçeğiyle uyumludur (15 da'da tam içeride 100 m piksel yok). **c-faktörü sahne içi Tc kararsızlığını giderdi (aylık c sabit), kalan gürültü çözünürlük/karışık piksel kaynaklı.**

**Karar:** durdurma kuralı uygulandı — ETa/ETf kullanıcıya AÇILMAZ; yalnız `/ic/kalite`. Kapı, ≥ 40 da bahçelerde (daha çok saf piksel) yeniden sınanmalıdır; jlnnlk için çözüm yazılımla bulunamaz (fiziksel çözünürlük).

## Sınırlar
- SSEBop burada literatür formülünün Python uygulamasıdır; OpenET ile birebir doğrulanmadı. Yer gerçeği (akı kulesi, damla sayacı) yok: «doğruluk» değil, **iç tutarlılık** ölçülür. Kapı geçse bile bu bir doğruluk kanıtı değildir.
- ECOSTRESS V003 yalnız kısmi doğrulama (seyrek, bulutlu, akşam geçişleri); V002 işleme sorunu (15 Nisan 2026) aktif.
- WaPOR L1 300 m: bahçe için %9 saflık; yalnız dekad ortalaması bağlamı.
