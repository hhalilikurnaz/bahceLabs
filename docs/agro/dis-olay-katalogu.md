# Dış olay kataloğu (kamu kayıtları)

Olay ön doğrulamasında (ADR 0021) **bağımsız kanıt** olarak kullanılan, elle derlenen kamu kayıtları: İl/İlçe Tarım Müdürlüğü afet duyuruları, TARSİM hasar duyuruları, yerel haber arşivi.

- Makine okunur dosya: `bahcelab-backend/src/bahcelab_backend/domain/evidence/dis_olay_katalogu.json`
- Şema: `{tarih (YYYY-AA-GG), olay_turu (don|yagis|sel|ruzgar|firtina|dolu|hasar), yer (il/ilçe), kaynak (yayıncı), url, not (isteğe bağlı)}`
- **Kural:** her satırın açılabilir bir kaynak URL'si olmalıdır; doğrulanamayan kayıt eklenmez, kayıt uydurulmaz.

## Durum: BOŞ
Derleme sırasında yapılan web aramaları Erdemli/Mersin için **tarihi ve kaynağı doğrulanabilir** kayıt vermedi (bulunan haberlerin çoğu tarihsiz ya da başka ilçeye ait). Bu yüzden katalog boş şemayla bırakıldı; satırlar kaynakları doğrulandıkça elle eklenir. Boş katalog «kanıt yok» sonucu üretir, hiçbir olayı desteklemez.

| Tarih | Tür | Yer | Kaynak | URL |
|---|---|---|---|---|
| — | — | — | — | — |
