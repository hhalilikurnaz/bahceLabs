# 0027 — Vana başına Sentinel-2 taç örtüsü → Kc

Durum: kabul edildi. Tarih: 2026-11-05. İlgili: ADR 0023 (FAO-56 plan), ADR 0024 (vanalar, tek kova), `docs/agro/KURAL-DURUMU.md` (Adım 9H).

## Karar
Kullanıcı haritada vana (sektör) çizdiyse her vananın Kc'si **kendi pikselleriyle** hesaplanır; çizilmediyse (tek sektör «Bahçe») bahçe değeri kullanılır.

## Hesap (`irrigation/service.py::_vana_kc`)
1. Bahçenin kanonik 10 m ızgarasında vana çokgeni maskelenir (`garden_mask`).
2. Son 60 günün **net** Sentinel-2 sahneleri yeniden yeniye taranır; sahnenin NDVI ızgarasındaki **maskelenmiş piksellerin ortalaması** (`nanmean`) alınır.
3. NDVI → taç örtüsü (`canopy_cover_from_ndvi`, katalog: 0,30 → 0,85) → aylık Kc (`kc_monthly`, FAO-56 Tablo 12 ön değeri).
4. Panel ve harita kartı **piksel sayısını** (geçerli/toplam), **bulut maskesi oranını** ve sahne tarihini gösterir.

## Eşikler (katalog, ön değer · mühendis onayı bekliyor)
- `kc_vana_min_piksel` = 20: vanada en az 20 geçerli (bulutsuz) piksel.
- `kc_vana_min_gecerli_oran` = 0,5: çokgen piksellerinin en az yarısı geçerli.

## Bulutlu / yarım vana kuralı
Eşiklerden biri sağlanmazsa o sahne o vana için atlanır, bir önceki sahne denenir. 60 günde hiçbiri uygun değilse **o vana için bahçe değerine düşülür** ve neden ekranda yazılır («son görüntülerde temiz piksel yetersiz (n/N, asgari …); bahçe değeri kullanıldı»). Vanalar birbirinden bağımsız karar verir: biri vana değeri, diğeri bahçe değeri kullanabilir. Değer uydurulmaz, enterpolasyon yoktur.

## Toprak vana başına ayrışmaz
Toprak (SoilGrids, 250 m) bir bahçeden küçük vanalarda tek hücreye düşer; vanalar arasında fark üretmez. Bu yüzden TAW/RAW tüm vanalarda aynı toprak girdisinden gelir, vanalar yalnız **Kc (taç örtüsü), alan, ağaç sayısı ve debi** ile ayrışır. Bu sınırlama **ekranda söylenmez** (kullanıcıya yararlı bir karar bilgisi değil); yalnız bu ADR'de kayıtlıdır. Yerinde toprak ölçümü eklenirse yeniden değerlendirilir.

## Sonuçlar
- Yüksek örtülü vana daha çok tüketir, kovası daha kuru görünür; haritadaki vana rengi ve plan buna göre ayrışır.
- 10 m piksel, küçük vanalarda (≈ 0,2 ha altı) ölçü sınırıdır; bu durum bahçe değerine düşüşle şeffaf gösterilir.
