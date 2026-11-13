# 9J Dilim 2 · İç izleme ekranı + kullanıcıya «Veri uyarısı» satırı: ilkeler 1–11, ekran bazında

✓ = karşılanıyor · ◐ = kısmen · — = geçerli değil. Kaynak: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar (jlnnlk + soğuk hava, geliştirme verisi, 1440/1024/390): `docs/design/u9j-d2-ekranlar-jlnnlk/`. İç ekran `/ic/kalite` (yalnız INTERNAL_EMAILS, sunucu 403); kullanıcıya yalnız bahçe panelinde tek satır.

**Veri notu (dürüstlük):** geliştirme ortamında worker/zamanlayıcı çalışmadığı için günlük anlık görüntü geçmişi YOK; ekranlardaki zaman çizelgesi bugünün tek kaydını gösterir (geçmişe dönük uydurma anlık görüntü yazılmadı). Akış durumları, uyum noktaları ve güven etiketleri o günün GERÇEK verisinden hesaplandı. e2e'de çizelge, gerçek işlerin 14 gün için koşturulmasıyla dolar.

| İlke | Akışlar | Kaynak uyumu | Kurallar | Bahçeler | Bahçe paneli · «Veri uyarısı» satırı | Not |
|---|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ «hangi veri akışı bozuk?» (tablo + zaman çizelgesi) | ✓ «kaynaklar birbirinden kayıyor mu?» | ✓ «kurallarımız işe yarıyor mu?» | ✓ «hangi bahçelerde güven düşük, neden?» | ✓ tek cümle: ne bozuk + ölçülen tarih | sekme başlığı = soru |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ durum → gecikme/kabul/kopuk eşikleri → neden | ✓ durum → son değer/taban/sapma/n → grafik | ✓ özet tablo → aylık döküm (açılır) | ✓ dağılım → bahçe satırı → eksik koşul listesi | ✓ satır → «Güven etiketi neye dayanıyor?» açılır | |
| 3 Normal bant tek tanım | ✓ kabul/kopuk eşikleri katalogdan | ✓ gri bant = ±eşik (katalog `drift_*`) | ✓ ölçülebilirlik eşiği katalog `kural_min_yanit` | ✓ güven oranları katalog | — | tüm eşikler «ön değer · mühendis onayı bekliyor» |
| 4 Dürüst ölçek | ✓ gecikme gün olarak, kare = gün | ✓ y ekseni simetrik, 0 kesikli çizgi, tek eksen | ✓ oran %, n ile | ✓ dağılım çubuğu toplam bahçeye oranlı | — | |
| 5 Renk anlamı sabit | ✓ yeşil taze · sarı gecikmeli · kırmızı kopuk · gri veri yok | ✓ yeşil uyumlu · kırmızı drift | ✓ yeşil ölçülüyor · gri ölçülemiyor | ✓ yeşil/sarı/kırmızı = yüksek/orta/düşük | ✓ uyarı rengi tek | ham hex yok; jeton sınıfları |
| 6 Renk tek başına değil | ✓ ● ▲ ✕ ○ + metin; zaman çizelgesi `role=img` + özet metin | ✓ simge + «kayıyor (drift)» yazısı | ✓ ● / ○ + yazı | ✓ ● ▲ ✕ + etiket + sayı | ✓ metin satırı | WCAG 1.4.1; axe (açık + koyu tema) temiz |
| 7 Belirsizlik görünür | ✓ «veri yok» ayrı durum | ✓ «yetersiz veri»: çizim uydurulmaz, nokta yoksa çizgi kopar | ✓ «ölçülemiyor» + neden (yanıtlı örnek < eşik) | ✓ «N koşul ölçülemedi», en az 4 koşul yoksa en çok «orta» | ✓ nedensellik uydurulmaz: «son net görüntü 09.10.2026 (35 gün önce)» (bulut nedeni bilinmiyor → yazılmaz) | |
| 8 Yok / bayat / hata ayrı | ✓ yükleniyor · hata (yeniden dene) · kayıt yok metni | ✓ kayıt yok ≠ yetersiz ≠ drift | ✓ | ✓ bahçe yok metni | ✓ hiçbir şey bozuk değilse satır HİÇ çıkmaz | `veri_durumu` null → render yok |
| 9 Doğrudan etiket, 12 px | ✓ satır etiketi akış adı, lejant yalnız renk anahtarı | ✓ başlıkta kontrol adı + bahçe | ✓ | ✓ | ✓ | en küçük yazı 12 px (`text-small`/`text-caption`) |
| 10 Harita–grafik bağı | — | — | — | — | — | iç ekranda harita yok |
| 11 Bir grafik bir mesaj; ≤ 150 ms | ✓ | ✓ kontrol başına bir grafik | ✓ tablo | ✓ | ✓ | sekme değişimi istemci içi; veriler sekme açılınca tek istek |

**Tek güven servisi:** iç «Bahçeler» etiketi `guven.topla` çıktısıdır (Sulama ve Durum aynı fonksiyon). Fark: Durum ekranı kendi «bileşen verisi yeterli» koşulunu ekler; iç ekranda bu koşul yok ve ekranda yazılı. Test: `tests/test_izleme_ic.py` (iç etiket = doğrudan servis çıktısı).

**Kalan borçlar / dürüst notlar:** (1) geçmiş akış zaman çizelgesi, günlük iş gerçekten koşmaya başladıkça dolar; (2) uyum noktaları haftalık: ilk haftalarda tek nokta; (3) iç ekran çalışma alanı kapsamlı (ETa ekranıyla aynı), tüm sistem bahçeleri değil; (4) kullanıcı satırı «Veri uyarısı», Durum'daki «Veri durumu» akordeonunun ÖZETİDİR: iki ayrı kavram değil iki seviye. «Ayrıntı →» akordeonu açar ve ilk bozuk veri koşulu satırına kaydırıp odaklar (e2e: `ic-izleme.spec.ts`).
