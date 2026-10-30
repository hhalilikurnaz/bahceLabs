# jlnnlk · 1 Ekim → 10 Kasım günlük kova tablosu ve tutarsızlık analizi

Üretim: `bahcelab-backend/scripts/sulama_kova_tablosu.py` (yalnız okur, geri alır). Bahçe jlnnlk, bugün **30 Ekim 2026**. jlnnlk'nin kayıtlı sulama profili yok; sayılar **örnek profille** (damla, 4 × 4 L/sa, 5 × 4 m, 7,5 kW; kaydedilmedi) hesaplandı. Hava verisi 6 Kasım'da bitiyor (ERA5/Open-Meteo tahmin ufku); 7–10 Kasım için satır yok, uydurulmadı. «·t» = tahmin günü. Katsayılar ön değer · mühendis onayı bekliyor.

> **Önemli not:** sulama planı Su sekmesindeki kova ile aynı hesabı kullanıyor (aşağıda). «Tükenme» = kök bölgesinde kullanılabilir su açığı (0 = tarla kapasitesi, TAW 118,2 mm = solma noktası). Tablo düzeltme **sonrası** değerlerdir; düzeltmeden önce tek fark `tetik` sütunu (8,9 mm) ve 4 Kasım öneri satırıydı (aşağıda).

## 1. Tablo (düzeltme sonrası)

# bahçe jlnnlk · bugün 2026-10-30 · TAW 118,2 · RAW 59,1 · tetik 47,3 (damla 0.8×RAW) · taç örtüsü %67 · verim 0.9

| Tarih | ERA5 yağış (mm) | IMERG (mm) | kullanılan yağış | etkili yağış | ET₀ | Kc | ETc | tükenme (mm) | RAW | tetik | öneri (net mm) | Su sekmesi doluluk % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-01 | 14,7 | 8,1 | 14,7 | 11,8 | 2,0 | 0,67 | 1,3 | 34,0 | 59,1 | 47,3 | — | 66 |
| 2026-10-02 | 9,4 | 7,6 | 9,4 | 7,5 | 2,2 | 0,67 | 1,5 | 28,0 | 59,1 | 47,3 | — | 75 |
| 2026-10-03 | 1,5 | 0,1 | 1,5 | 0,0 | 2,5 | 0,67 | 1,6 | 29,6 | 59,1 | 47,3 | — | 78 |
| 2026-10-04 | 0,7 | 3,2 | 0,7 | 0,0 | 3,7 | 0,67 | 2,4 | 32,1 | 59,1 | 47,3 | — | 77 |
| 2026-10-05 | 0,0 | 0,0 | 0,0 | 0,0 | 3,7 | 0,67 | 2,5 | 34,6 | 59,1 | 47,3 | — | 76 |
| 2026-10-06 | 0,4 | 3,9 | 0,4 | 0,0 | 2,8 | 0,67 | 1,9 | 36,4 | 59,1 | 47,3 | — | 76 |
| 2026-10-07 | 0,3 | 0,0 | 0,3 | 0,0 | 2,8 | 0,67 | 1,8 | 38,3 | 59,1 | 47,3 | — | 75 |
| 2026-10-08 | 0,0 | 0,0 | 0,0 | 0,0 | 3,7 | 0,67 | 2,4 | 40,7 | 59,1 | 47,3 | — | 74 |
| 2026-10-09 | 0,0 | 0,0 | 0,0 | 0,0 | 4,0 | 0,67 | 2,6 | 43,4 | 59,1 | 47,3 | — | 72 |
| 2026-10-10 | 0,0 | 0,0 | 0,0 | 0,0 | 4,4 | 0,67 | 2,9 | 46,3 | 59,1 | 47,3 | — | 71 |
| 2026-10-11 | 0,0 | 2,1 | 0,0 | 0,0 | 4,3 | 0,67 | 2,8 | 49,1 | 59,1 | 47,3 | — | 70 |
| 2026-10-12 | 1,9 | 16,5 | 1,9 | 0,0 | 2,6 | 0,67 | 1,8 | 50,9 | 59,1 | 47,3 | — | 70 |
| 2026-10-13 | 0,0 | 0,0 | 0,0 | 0,0 | 2,9 | 0,67 | 1,9 | 52,8 | 59,1 | 47,3 | — | 70 |
| 2026-10-14 | 2,8 | 4,9 | 2,8 | 2,2 | 2,6 | 0,67 | 1,8 | 52,4 | 59,1 | 47,3 | — | 70 |
| 2026-10-15 | 24,3 | 11,5 | 24,3 | 19,4 | 1,9 | 0,67 | 1,3 | 34,2 | 59,1 | 47,3 | — | 78 |
| 2026-10-16 | 6,5 | 14,9 | 6,5 | 5,2 | 1,9 | 0,67 | 1,3 | 30,2 | 59,1 | 47,3 | — | 81 |
| 2026-10-17 | 8,9 | 4,9 | 8,9 | 7,1 | 1,2 | 0,67 | 0,8 | 23,9 | 59,1 | 47,3 | — | 87 |
| 2026-10-18 | 2,0 | 0,0 | 2,0 | 1,6 | 2,4 | 0,67 | 1,6 | 23,9 | 59,1 | 47,3 | — | 92 |
| 2026-10-19 | 0,5 | 0,0 | 0,5 | 0,0 | 2,3 | 0,67 | 1,5 | 25,5 | 59,1 | 47,3 | — | 92 |
| 2026-10-20 | 0,0 | 0,0 | 0,0 | 0,0 | 2,9 | 0,67 | 1,9 | 27,4 | 59,1 | 47,3 | — | 91 |
| 2026-10-21 | 0,1 | 0,0 | 0,1 | 0,0 | 3,5 | 0,67 | 2,4 | 29,8 | 59,1 | 47,3 | — | 89 |
| 2026-10-22 | 0,0 | 0,0 | 0,0 | 0,0 | 3,2 | 0,67 | 2,1 | 31,9 | 59,1 | 47,3 | — | 88 |
| 2026-10-23 | 0,0 | 0,0 | 0,0 | 0,0 | 3,3 | 0,67 | 2,2 | 34,1 | 59,1 | 47,3 | — | 86 |
| 2026-10-24 | 0,0 | 0,0 | 0,0 | 0,0 | 3,3 | 0,67 | 2,2 | 36,3 | 59,1 | 47,3 | — | 84 |
| 2026-10-25 | 0,0 | — | 0,0 | 0,0 | 3,6 | 0,67 | 2,4 | 38,8 | 59,1 | 47,3 | — | 79 |
| 2026-10-26 | 0,5 | 0,3 | 0,5 | 0,0 | 3,5 | 0,67 | 2,4 | 41,1 | 59,1 | 47,3 | — | 76 |
| 2026-10-27 | 21,3 | 5,0 | 21,3 | 17,0 | 2,4 | 0,67 | 1,6 | 25,7 | 59,1 | 47,3 | — | 80 |
| 2026-10-28 | 16,0 | — | 16,0 | 12,8 | 1,1 | 0,67 | 0,8 | 13,6 | 59,1 | 47,3 | — | 98 |
| 2026-10-29 | 52,6 | — | 52,6 | 42,1 | 0,9 | 0,67 | 0,6 | 0,0 | 59,1 | 47,3 | — | 100 |
| 2026-10-30 | 0,6 | — | 0,6 | 0,0 | 2,2 | 0,67 | 1,5 | 1,5 | 59,1 | 47,3 | — | 100 |
| 2026-10-31 ·t | 0,0 | — | 0,0 | 0,0 | 2,0 | 0,67 | 1,3 | 2,8 | 59,1 | 47,3 | — | 100 |
| 2026-11-01 ·t | 0,0 | — | 0,0 | 0,0 | 1,7 | 0,69 | 1,2 | 4,0 | 59,1 | 47,3 | — | 100 |
| 2026-11-02 ·t | 0,0 | — | 0,0 | 0,0 | 2,2 | 0,69 | 1,5 | 5,5 | 59,1 | 47,3 | — | 100 |
| 2026-11-03 ·t | 0,0 | — | 0,0 | 0,0 | 2,8 | 0,69 | 2,0 | 7,4 | 59,1 | 47,3 | — | 100 |
| 2026-11-04 ·t | 0,3 | — | 0,3 | 0,0 | 2,1 | 0,69 | 1,4 | 8,9 | 59,1 | 47,3 | — | 100 |
| 2026-11-05 ·t | 0,0 | — | 0,0 | 0,0 | 2,1 | 0,69 | 1,4 | 10,3 | 59,1 | 47,3 | — | 100 |
| 2026-11-06 ·t | 0,3 | — | 0,3 | 0,0 | 2,4 | 0,69 | 1,7 | 12,0 | 59,1 | 47,3 | — | 99 |

Sütunlar: ERA5 yağış = `era5_daily.yagis_mm`; IMERG = uydu günlük yağışı (doğrulama gözlemi, gecikmeli: son değer 27 Ekim); kullanılan = kovaya giren (IMERG yalnız aylık karşılaştırma sistematik fark gösterirse ve geçmiş günlerde kullanılır; bu bahçede ERA5); etkili = `0` (< 2 mm) ya da `0,8 × yağış`; ETc = Kc × ET₀; tetik = sistem programı oranı × RAW.

## 2. Tutarsızlık: ne oldu

**Eski kural (hatalı):** damla için tetik `0,15 × RAW = 8,9 mm` tükenmeydi. Kova 29 Ekim'de 0'a (tam dolu) indikten sonra günde ≈ 1,5 mm ile 4 Kasım'da 8,9 mm'ye ulaştı; tetik tükenmeye bakıyordu (takvime değil) ama eşik RAW'ın yalnız %15'iydi, yani kova **%85 doluyken** sulama önerildi (4 Kasım, net 8,0 mm = ≈ 135 m³). Su sekmesi o sırada ayrı bir kovadan «%100, 7 gün gerekmiyor» diyordu.

**Kural nedenleri tek tek:**

| Soru | Bulgu |
|---|---|
| Etkili yağış kovaya doğru giriyor mu (tavan)? | **Evet.** 27–29 Ekim: 21,3 / 16,0 / 52,6 mm ham → 17,0 / 12,8 / 42,1 mm etkili (%80); tükenme 41,1 → 25,7 → 13,6 → **0** (29 Ekim). Kova tavanda (tarla kapasitesi) kırpılır, fazlası derine sızar. Hatalı değil; öneriyi bu yağış tetiklemedi. |
| IMERG boşluğu etkili mi? | **Hayır.** IMERG 27 Ekim'de bitiyor (28–29 Ekim yok); kaynak seçimi ERA5 (aylık karşılaştırmada sistematik fark yok). Bu bahçede IMERG zaten kullanılmıyor, boşluk kovayı değiştirmez. |
| Tetik takvime mi bakıyor? | **Hayır**, tükenmeye bakıyor — ama eşik çok düşüktü (%15 RAW). Kök neden bu. |
| Başlangıç kovası SMAP/ERA5 ile mi? | **ERA5-Land.** 30 günlük pencerenin başlangıcı (30 Eylül) kök bölgesi doluluğundan (bahçenin aynı dönem normuna göre %) kurulur; **SMAP kullanılmaz** (yalnız doğrulama gözlemi; EARTHDATA_TOKEN de tanımlı değil). 30 Eylül başlangıcı sonraki 29 Ekim yağışıyla zaten silinmiş durumda (tükenme 0). |
| İki ayrı kova mı vardı? | **Evet.** Su sekmesi eski NDVI-doğrusal Kc ve %100 etkili yağış kuralıyla kendi kovasını, plan ise FAO-56 Kc/etkili yağış kuralıyla ikinci bir kovayı hesaplıyordu. |
| Ek bulgu: yağış serileri | Hava sekmesi `weather_daily` (Open-Meteo «arşiv») kullanıyor: son 7 gün **138 mm**, 30 gün **242 mm**. Kova `era5_daily`'den besleniyor: 7 gün **91 mm**, 30 gün **165 mm** (28–29 Ekim: 27,1 / 89,8 mm ↔ 16,0 / 52,6 mm; son günler ERA5'te «model» satırı). Fark gerçek ve **bu düzeltmede değiştirilmedi** (hangisinin doğru olduğuna karar vermek ölçüm gerektirir); bu olayda kova ikisinde de 0'a dolar, sonuç değişmez. Öneri: iki seriyi tek kaynağa bağlama kararı ayrı iş. |
| Ek hata (nem_farki uyarısı) | Plan, ERA5-Land nemini **birkaç gün önceki** bir günden alıp **bugünkü** kovayla karşılaştırıyordu («18 mm fark» uyarısı sahteydi). Artık aynı gün karşılaştırılıyor; uyarı kalktı. |

## 3. Düzeltme

1. **Tetik:** her sistemde `tetik ≥ 0,8 × RAW` (katalog `tetik_alt_siniri`, ihlal eden katalog **yüklenmez**). Damla 0,8 (tek seferde en çok 8 mm net, sık-az), mini yağmurlama 0,9 (20 mm), salma 1,0 (70 mm). Tetik yalnız tükenmeye bakar.
2. **Tek kova:** Su sekmesinin gün tablosu (`denge`), TAW ve eşiği artık plan motorundan gelir (Kc taç örtüsüne göre, etkili yağış katalogdan, Saha Defteri sulaması dahil). Plan kurulamıyorsa (toprak ya da taç örtüsü verisi yok) eski hesap kalır; o durumda plan da yoktur, çelişki oluşamaz.
3. **Tek hakem:** sulama profili olan bahçede Su sekmesi, Hava ve Durum kararı plana uyar: plan 7 gün içinde sulama öneriyorsa karar «sulama», önermiyorsa «sulama» olamaz (`reconcile_with_plan`).
4. **Tutarlılık testi** (`test_su_sekmesi_ve_plan_ayni_kovadan_beslenir_ve_celismez`): 117 farklı «bugün» için (kışı yağışlı, yazı kuru tohum seri) (a) her öneride önceki tükenme ≥ 0,8 × RAW, (b) Su ve plan kovaları bugünden önceki günlerde birebir aynı, (c) Su «sulama» ⇔ plan 7 gün içinde sulama.

## 4. Düzeltme sonrası

Bu haftanın planı: **sulama önerilmiyor** (tükenme 4 Kasım'da 8,9 mm, 6 Kasım'da 12,0 mm; tetik 47,3 mm). Su sekmesi: «Kök bölgesi Ekim normaline göre nemli (%100); önümüzdeki 7 gün sulama gerekmiyor.» Plan ve Su aynı. Tam rapor ve sezon aralığı: [sulama-plani.md](sulama-plani.md).
