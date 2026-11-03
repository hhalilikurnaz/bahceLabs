# 0025 — Tek yağış/ET₀ serisi (kova, plan, Su kartı, Hava)

Durum: kabul edildi. Tarih: 2026-11-03. Kanıt: `docs/agro/yagis-kaynak-karsilastirma.md`. İlgili: ADR 0017, 0023, 0024.

## Sorun
İki ayrı yağış serisi vardı: Hava sekmesi `weather_daily` (Open-Meteo «arşiv»), Su sekmesi/kova/plan `era5_daily`. jlnnlk'de son 7 gün 138 mm ↔ 91 mm, 30 gün 242 mm ↔ 165 mm; 29 Ekim'de 89,8 ↔ 52,6 mm. Kullanıcı aynı bahçede iki farklı sayı görüyordu; Hava sekmesinin «su dengesi» de ayrı bir hesaptı.

## Karar
1. **Geçmiş günlerin yağışı ve ET₀'ı TEK yerden:** `domain/water/rain_series.gecmis_hava` (`era5_daily`; Su sekmesi kuralıyla aylık karşılaştırmada IMERG sistematik farklıysa geçmiş günlerde IMERG). Kova, sulama planı, simülasyon, Su kartı ve Hava sekmesi (7/30 gün toplamı, sezon toplamı, su dengesi, geçmiş uç noktası) bunu kullanır. `weather_daily` yalnız **sıcaklık** (ve geçici yedek) içindir.
2. **Neden era5_daily:** (a) 2015'ten kesintisiz kapsam: sezon tekrarı, kuru/normal/ıslak yıl sınıflaması ve normal bantlar buna dayanır; weather_daily ≈ 2,2 yıl; IMERG gecikmeli ve boşluklu; (b) ET₀, toprak nemi ve yağış aynı veri setinden: kova iç tutarlı; (c) Meteostat 17340'a göre uzun dönem toplam sapması −%3 (IMERG −%19, weather_daily +%57); (d) kısa pencerede üç serinin farkı istasyonun temsil gücünün (26 km, kıyı) altında kalıyor, hiçbirini ayırt edici biçimde üstün kılmıyor.
3. **Bilinen zayıflıklar açıkça yazılır:** ERA5'in ıslak gün yanlış alarm oranı IMERG'den yüksek (%19–28 ↔ %6–12); son günler «model» satırıdır (ERA5 henüz kesinleşmedi). Kaynak satırı (Hava ve Sulama paneli) hangi serinin kullanıldığını ve kaç son günün model değeri olduğunu söyler: «Yağış serisi: ERA5 (Open-Meteo yeniden analiz); 5 son gün model değeri…».
4. **Yedek:** ERA5 beslemesi bir hücre için henüz çalışmadıysa (yeni bahçe) Hava sekmesi `weather_daily`'ye düşer ve bunu kaynak satırında **«Open-Meteo arşiv (ERA5 verisi henüz alınmadı)»** diye yazar. Seride günü olmayan günün yağışı bilinmez (uydurulmaz, arşivle doldurulmaz).
5. **Tutarlılık testi:** Hava'nın yağış toplamı ve geçmiş günleri `era5_daily` ile birebir (arşiv 50 mm/gün olsa bile) — `tests/test_weather_api.py::test_gecmis_yagis_su_sekmesiyle_ayni_seriden_gelir`.

## Sonuçlar
- Hava sekmesindeki yağış sayıları değişir (jlnnlk 29 Ekim: 89,8 → 52,6 mm). Hangisinin doğru olduğunu bu veriler kanıtlamaz (istasyon 20 Ekim'de bitiyor, IMERG gecikmeli); bir yerel yağmur ölçer Saha Defteri'ne girilebilirse seri ona göre sınanabilir (sonraki iş).
- `weather_daily`'nin yağış alanı artık okunmuyor; tablo sıcaklık ve yedek için kalır.
