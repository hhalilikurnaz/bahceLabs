# Sulama sistemi kontrol işareti — geriye dönük koşu (jlnnlk)

Üretim: `scripts/sk_geriye_donuk.py` · tarih 2026-11-12 · bahçe **jlnnlk** (15.1 da; tek sektör) · kural ADR 0029 (ön değer · mühendis onayı bekliyor). Kural her sahne tarihinde **yalnız o güne kadarki veriyi** görür; taban yalnız önceki sezonlardır.

**Önemli:** jlnnlk'in gerçek sulama profili/kaydı yok; kova durumu **geçici örnek profille** (damla, 5×4 m) planın günlük kovasından gelir (profil iş sonunda silindi). Tek sektör olduğundan diğer vanalarla karşılaştırma yoktur (güven «orta»). Yer gerçeği (gerçek tıkanma kaydı) yok: tablo «kaç işaret üretilirdi»yi gösterir, doğruluğu DEĞİL.

## Özet

- Değerlendirilen bulutsuz Sentinel-2 sahnesi: **247** (2015-08-13 → 2026-10-09)
- Tabanı olan (≥ 2 önceki sezon, ≥ 6 sahne) tek-sahne gözlemi: **206**; bunların **9**'ı z ≤ -1.5 (%4.4); kova yeterliyken **1**
- Komşu halka (bahçe sınırından 100–300 m, ağaçlık NDVI ≥ 0.5) ölçümü olan sahne: **246** / 247; halka z-skoru hesaplanabilen: **205**
- Bahçe tek-sahne z ≤ -1.5 olan 9 sahnede halka: **normal (z > -0.5) 1**, **düşük 8** (hava/fenoloji), **referans yok 0**
- İşareti ateşleyen sahne tarihi (art arda 2 sahne + kova): **0**
- **Üretilecek bildirim (olay; ≥ 14 gün arayla): 0** — yaklaşık yılda **0.0**

## İşaret olayları

| Olay başlangıcı | Bitiş | Ateşleyen sahne | z (son 2 sahne) | NDMI | Evre | Taban (ort ± std, n/sezon) |
|---|---|---:|---|---|---|---|
| (hiç olay yok) | | | | | | |

## Neden işaret çıkmadı (sahne sayısı)

| Neden | Sahne |
|---|---:|
| kova bu sahnelerde «yeterli/dolu» değil | 155 |
| taban yok | 36 |
| son bulutsuz sahneler 25 gün arayla | 23 |
| son bulutsuz sahneler 30 gün arayla | 12 |
| NDMI normal aralıkta | 12 |
| son bulutsuz sahneler 50 gün arayla | 2 |
| son bulutsuz sahneler 23 gün arayla | 2 |
| yetersiz bulutsuz sahne | 1 |
| son bulutsuz sahneler 70 gün arayla | 1 |
| son bulutsuz sahneler 40 gün arayla | 1 |
| son bulutsuz sahneler 60 gün arayla | 1 |
| son bulutsuz sahneler 27 gün arayla | 1 |

## Sezon başına

| Sezon (Ekim başlangıçlı) | Bulutsuz sahne | Ateşleyen sahne | z ≤ eşik (tek sahne) |
|---|---:|---:|---:|
| 2014/2015 | 4 | 0 | 0 |
| 2015/2016 | 21 | 0 | 0 |
| 2016/2017 | 20 | 0 | 1 |
| 2017/2018 | 22 | 0 | 2 |
| 2018/2019 | 21 | 0 | 0 |
| 2019/2020 | 23 | 0 | 1 |
| 2020/2021 | 24 | 0 | 1 |
| 2021/2022 | 19 | 0 | 0 |
| 2022/2023 | 22 | 0 | 0 |
| 2023/2024 | 24 | 0 | 1 |
| 2024/2025 | 24 | 0 | 3 |
| 2025/2026 | 22 | 0 | 0 |
| 2026/2027 | 1 | 0 | 0 |

## Yorum (halka kuralı)

Bahçe tek-sahne z ≤ -1.5 olan **9** sahnenin **8**'inde komşu halka da düşüktü (z ≤ -0.5) → bu düşüşler bahçeye özgü değil, **hava/fenolojiyle ortak**; halka kuralı onları işaret olmaktan çıkarır. Yalnız **1** sahnede halka normaldi (bahçeye özgü düşüş adayı); o da art arda 2 sahne + kova koşulunu sağlamadığından **olay üretilmedi**. Yani halka referansı yanlış alarm riskini daha da azaltıyor; **duyarlılık (gerçek tıkanmayı yakalama) hâlâ ölçülemedi** — jlnnlk'te bilinen tıkanma kaydı yok. Doğruluk kullanıcı yanıtlarıyla (Saha Defteri) ölçülecek.

