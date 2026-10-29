# Dış olay kataloğu (kamu kayıtları)

Olay ön doğrulamasında (ADR 0021) **bağımsız kanıt** olarak kullanılan, elle derlenen kamu kayıtları: İl/İlçe Tarım Müdürlüğü afet duyuruları, TARSİM hasar duyuruları, yerel haber arşivi.

- Makine okunur dosya: `bahcelab-backend/src/bahcelab_backend/domain/evidence/dis_olay_katalogu.json`
- Şema: `{tarih, tarih_bitis (isteğe bağlı), olay_turu (don|yagis|sel|ruzgar|firtina|dolu|hasar), yer, yer_duzeyi (il|ilce), kaynak, url, not}`
- **Kural:** her satırın açılabilir bir kaynak URL'si olmalıdır; doğrulanamayan kayıt eklenmez, kayıt uydurulmaz.
- **İl düzeyi kayıt:** yalnız il adı veren kayıt (ilçe yazılı değil) bahçe olayını «destekleniyor» yapabilir; rozet ve kanıt metni «il düzeyi kayıt» der. Eşleşme penceresi kayıt aralığı ± 2 gün (`dis_kanit.katalog_pencere_gun`, ön değer).

## Kayıtlar (2)
| Tarih | Tür | Yer | Düzey | Kaynak (yayın) | URL |
|---|---|---|---|---|---|
| Şubat 2025 (Nisan 2025'te tekrarladı) | don | Mersin (haberde Toroslar; Erdemli yok) | il | Haberler.com (04.06.2025): limon dâhil narenciye etkilendi | https://www.haberler.com/ekonomi/mersin-deki-don-afeti-narenciye-uretimini-tehdit-ediyor-18709175-haberi/ |
| 06–07.01.2020 | aşırı yağış | Mersin (Tarsus'ta tahliye; Erdemli yok) | il | TRT Haber (07.01.2020): tarım arazileri ve seralar su altında | https://www.trthaber.com/haber/guncel/mersinde-saganak-nedeniyle-tarim-arazileri-sular-altinda-kaldi-452354.html |

Doğrulama notu (2026-10-29): iki haberin yayın tarihi, başlığı ve ilgili cümleleri sayfalardan okunarak teyit edildi. Haberler gün belirtmediği için Şubat 2025 kaydı ayın tamamını kapsar (**Nisan 2025 tekrarı ayrı satır olarak girilmedi**; haber o ayın gününü vermiyor). 6 Ocak 2020 günü haberdeki «dün başlayan sağanak» ifadesinden çıkarılmıştır.
