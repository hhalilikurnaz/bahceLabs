# 0029 — Vana bazında «sulama sistemini kontrol edin» işareti (Sentinel-2 NDMI)

Durum: kabul edildi (Dilim 1B). Tarih: 2026-11-12. İlgili: ADR 0023–0027 (plan, vanalar, vana Kc), ADR 0018 (bildirim öncelikleri), `docs/agro/KURAL-DURUMU.md` (Adım 9I-1B), `docs/agro/sistem-kontrol-geriye-donuk.md`.

## Karar
Kova «yeterli/dolu» (Ks = 1) olduğu halde bir vananın yaprak suyu göstergesi (**Sentinel-2 L2A NDMI**, SWIR 20 m) **kendi geçmişine göre** belirgin düşükse (z ≤ −1,5, art arda 2 bulutsuz sahne) vana satırında «**V2'de sulama sistemini kontrol edin — tıkalı damlatıcı, arızalı vana ya da basınç sorunu olabilir.**» işareti gösterilir. İşaret kullanıcıya GÖSTERİLİR (uydudan ETa'nın aksine kapı yok): bir teşhis değil, **kontrol çağrısı**dır ve kullanıcı yanıtıyla doğrulanır.

## Kural (saf: `domain/irrigation/sistem_kontrol.py`, birim testli)
1. **Girdi:** vana çokgeninin (yoksa bahçenin) NDMI ortalaması, her sahne için; kalite: temiz piksel ≥ %80 ve ≥ 4 piksel (SCL maskesi acquisitions hattında uygulanır). Vana serileri `sk_ndmi` önbelleğinde tutulur (çokgen değişince `geom_hash` ile geçersiz); tek sektörde `acquisition_stats`'in bahçe ortalaması kullanılır (ızgara okunmaz).
2. **Taban:** aynı **fenolojik evrede** (`stage_on`), **yalnız önceki sezonlar** (Ekim başlangıçlı); en az 2 farklı sezon ve 6 sahne. Yoksa **işaret üretilmez, nedeni yazılır** («taban yok: … 1 önceki sezon var, en az 2 gerekir»). z = (NDMI − ort)/max(std, 0,02). Gelecek ve mevcut sezon tabana girmez.
3. **Tetik:** kova etiketi `yeterli`/`dolu` VE Ks = 1 (plan/uygulanan sulamalı kova) olan **son 2 bulutsuz sahnede** z ≤ −1,5 (sahneler arası ≤ 21 gün). Kova zaten eşik altındaysa bu **işaret değil, normal stres mesajıdır**.
4. **Vanalar arası:** aynı tarihlerde yalnız bu vana düşüyorsa güven **yüksek**; vanaların ≥ %50'si birlikte düşüyorsa (hava/fenoloji) işaret **üretilmez**; karşılaştırılacak vana yoksa (tek sektör) güven **orta** ve bu açıkça yazılır.
5. **Eşikler katalogda** (`sistem_kontrol`, ön değer · mühendis onayı bekliyor).

## Gösterim ve yanıt
- Sulama paneli vana satırı: işaret + tek cümle neden + güven + **«Nasıl hesaplandı?»** (taban ort ± std, n/sezon, evre; son sahnelerin NDMI ve z'si; eşikler). Vana odağında da görünür.
- Harita: o vana sınırı uyarı rengi (turuncu, kalın) + etiket «… · sistemi kontrol edin».
- Bildirim merkezi: `sulama_sistem_kontrol`; **güven yüksek → anında (kritik), orta → günlük özet**; tekil anahtar bahçe+vana+sahne tarihi (aynı işaret ikinci kez bildirilmez).
- **Kullanıcı yanıtı:** «Kontrol ettim: sorun yoktu» (işareti kapatır; yeni sahnede yeniden değerlendirilir) · «Damlatıcı tıkalıydı» · «Başka bir sorun vardı». Yanıt **Saha Defteri'ne «gözlem» kaydı** olarak düşer (`ayrinti.konu = sistem_kontrol`); **kural doğruluğu bu yanıtların oranıyla ölçülür** (kesinlik = tıkalı + başka sorun / yanıtlanan).

## Geriye dönük koşu (jlnnlk, gerçek Sentinel-2 geçmişi)
`docs/agro/sistem-kontrol-geriye-donuk.md`: 247 bulutsuz sahne (2015-08 → 2026-10), taban olan 206; **tek sahne z ≤ −1,5: 9 (%4,4); bunlardan kova yeterliyken yalnız 1; art arda 2 sahne + kova koşulunu sağlayan 0 → 11 yılda 0 bildirim.** Yorum: kural **çok tutucu**; yanlış alarm riski düşük, ama **duyarlılığı (gerçek tıkanmayı yakalama) ölçülemedi** — jlnnlk'in gerçek tıkanma kaydı ve sulama profili yok (kova geçici örnek profille, tek sektör; sonra silindi). Doğruluk, kullanıcı yanıtları birikince ölçülecek; eşikler o veriyle gözden geçirilir.

## Sınırlar
- NDMI yaprak suyunu ölçer; düşüş yalnız sulama sorunundan değil hastalık, zararlı, budama, ot örtüsü ya da fenoloji kaymasından da olabilir: bu yüzden çıktı «kontrol edin» der, «tıkandı» demez.
- Vana çokgenindeki temiz piksel sayısı küçük vanada az olabilir (SWIR 20 m): ≥ 4 piksel ve %80 koşulu; yetmezse sahne sayılmaz.
- Kova yalnız plan/uygulanan sulamaya dayanır; kullanıcı planı izlemiyorsa «kova yeterli» yanlış olabilir (Saha Defteri sulama kaydı bunu düzeltir).

## Ek (2026-11-12) — Komşu halka referansı
Karar (kullanıcı onayı): **tek sektörlü bahçede** ve **vanaların hepsinin birlikte düştüğü** durumda işaret yalnız komşu halka normalken üretilir; çok vanalı bahçede vana-arası kural aynen korunur, halka güveni yükseltir.

- **Halka:** bahçe sınırından **100–300 m**; yalnız **ağaçlık** pikseller (Sentinel-2 **SCL geçerli** [bulut/gölge/kar maskesi] + **NDVI ≥ 0,5**; bahçenin kendisi, yollar, çıplak toprak ve su dışarıda). **En az 30 geçerli ağaçlık piksel** yoksa işaret üretilmez ve nedeni yazılır («komşu halkada … geçerli ağaçlık piksel var, en az 30 gerekir»). SCL tek başına bitki sınıfı için yetmez (yollar/çıplak toprak SCL'de «geçerli»dir), bu yüzden NDVI eşiği SCL'ye eklenir.
- **Z-skoru:** halkanın NDMI'sı bahçe/vana ile **aynı sahnelerde** ve **aynı yöntemle** (halkanın KENDİ önceki sezonları, aynı fenolojik evre, ≥ 2 sezon, ≥ 6 sahne) z'ye çevrilir. Halka **normal** = her iki sahnede z > **−0,5**.
- **Karar:** (bahçe/vana z ≤ −1,5, 2 ardışık bulutsuz sahne, kova yeterli) ve halka normal → işaret, güven **orta-yüksek**; halka da düşüyorsa (hava/fenoloji) ya da halka referansı yoksa → **işaret yok**, nedeni yazılır. Çok vanalı: «yalnız bu vana düşüyor» güveni **yüksek** kalır (halka normalse metne eklenir); vana-arası «orta» + halka normal → **orta-yüksek**; halka da düşükse not düşülür (işaret kalır, çünkü diğer vanalar normal).
- **Mimari:** halka serisi `sk_halka` (migration 041); **panel isteği ağ kullanmaz**. Doldurma: günlük arka plan işi `refresh_sk_halka` (sulama profili olan bahçeler, bahçe başına en yeni 60 eksik sahne) ve `scripts/sk_halka_doldur.py`. Panel yalnız önbelleği okur; halka henüz hazır değilse tek sektörde işaret üretilmez ve «komşu halka referansı hesaplanmamış» yazar (güvenli taraf).
- **Eşikler** katalogda (`sistem_kontrol.halka_*`) ve `KURAL-DURUMU.md`'de «ön değer · mühendis onayı bekliyor».
- **Geriye dönük koşu (jlnnlk, halka kuralıyla yeniden üretildi):** halka ölçümü 246/247 sahnede var (≈ 3 000 ağaçlık piksel/sahne; bahçe NDMI'sıyla uyumlu: 0,25 ↔ 0,25); bahçe tek-sahne z ≤ −1,5 olan **9** sahnenin **8**'inde halka da düşüktü (hava/fenolojiyle ortak) → bunlar işaret olmaktan çıkar; yalnız 1 sahnede halka normaldi; **olay 0** (tablo: `sistem-kontrol-geriye-donuk.md`). Sonuç: halka yanlış alarm riskini daha da düşürür; duyarlılık hâlâ ölçülemedi (gerçek tıkanma kaydı yok).
- **Sınırlar:** halka bahçeyle aynı yönetimde değildir (komşu bahçeler farklı sulayabilir; ağaçlık pikseller narenciye dışı ağaçları da içerebilir); NDVI eşiği ürün ayrımı yapmaz.
