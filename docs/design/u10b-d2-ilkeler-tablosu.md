# ADIM 10B · Dilim 2 · «Olası sebepler (kesin değil)»: ilkeler 1–11, ekran bazında

✓ = karşılanıyor · ◐ = kısmen · — = geçerli değil. Kaynak: [gorsellestirme-ilkeleri.md](gorsellestirme-ilkeleri.md). Ekranlar: `docs/design/u10b-d2-ekranlar-jlnnlk/` (jlnnlk, gerçek geliştirme verisi, 1440/1024/390: Geçmiş'te «Don + optik hasar izi» olayı, «belirsiz» vaka, kontrol listesi, haritada olay kartı).

**Veri notu (dürüstlük):** jlnnlk'te şu an TAZE (≤ 3 gün) bir gerçek düşüş olayı yoktur; bu yüzden **Durum'daki bölge düşüşü maddesi** ve **görüntü kapısı tek satırı** gerçek veriyle gösterilemedi. Bu iki ekran e2e testlerinde SENTETİK test tohumuyla (`tests/support/seed_sebep.py`) doğrulandı ve ekranları `tb-durum-*` adıyla test bahçesinden alınmıştır. Geçmiş ve harita kartı gerçek jlnnlk olaylarıdır (17 Şub–13 Mar 2025 don + optik hasar izi; 29 Mar 2020 ani düşüş).

| İlke | Olası sebepler kartı | «Sahada şunlara bakın» | «Sebep buydu» | Görüntü kapısı (tek satır) | Not |
|---|---|---|---|---|---|
| 1 Tek soru, başlık cevap | ✓ başlık «Olası sebepler (kesin değil)»; ilk satır cevap: «Don · daha olası» | ✓ başlık soruyu yanıtlar | ✓ «Sebep buydu: hangisi?» | ✓ tek cümle | |
| 2 Karar → sayı → kanıt → ayrıntı | ✓ sözcük → açılır kanıt satırları | ✓ sebep başına madde → kaynak | ✓ | — | sayı YOK (yüzde/puan gösterilmez) |
| 3 Normal bant tek tanım | — | — | — | — | eşikler katalogda (`sebep`), tek yer |
| 4 Dürüst ölçek | ✓ yüzde ve ham puan yok; güven yalnız sözcük | — | — | ✓ beklenen geçiş «(tahmini)» | e2e: kartta `\d%` yok |
| 5 Renk anlamı sabit | ✓ renksiz; yalnız metin ve işaret | ✓ | ✓ seçili = koyu dolgu | ✓ | ham hex yok |
| 6 Renk tek başına değil | ✓ ●/◐/○ + sözcük; ✓ lehte / ✕ aleyhte + sr-only «Lehte/Aleyhte»; bağımsızlık rozeti metin | ✓ | ✓ `aria-pressed` + metin | ✓ | axe temiz (Durum, Geçmiş, harita kartı, kapı) |
| 7 Belirsizlik görünür | ✓ «Belirsiz: veriler tek bir sebebi ayırt etmeye yetmiyor» + neden; «ön değer · mühendis onayı bekliyor»; kararsızlıkta güven bir kademe düşer (zayıf olasılık) | ✓ «kaynak yok» açıkça işaretli | ✓ «sebep ayrıştırmayı iyileştirir» | ✓ «(tahmini)» | bağımlı/bağımsız etiketi döngüselliği gösterir |
| 8 Yok / bayat / hata ayrı | ✓ yükleniyor ayrı; hata ya da S2 düşüşü olmayan olayda kart çizilmez (404) | — | — | — | |
| 9 Doğrudan etiket, 12 px | ✓ satır içi etiket, lejant yok; en küçük yazı 12 px | ✓ | ✓ | ✓ | |
| 10 Harita–grafik bağı | ◐ haritada olay kartı ile Geçmiş aynı kaynaktan (`/olaylar/{id}/sebep`) | — | — | — | |
| 11 Bir grafik bir mesaj; ≤ 150 ms | ✓ grafik yok, tek mesaj | ✓ | ✓ | ✓ | giriş animasyonu yok |

**Dokunma hedefi:** tüm düğmeler ≥ 44 px (`min-h-11`). **Klavye:** sebep ve kontrol satırları `<details>`; yanıt düğmeleri `aria-pressed`.
**Yerleşim:** Durum'da madde satırının ALTINDA açılır (eylem düğmesi satırı bozulmaz); haritada olay kartı içinde kaydırılabilir (390 px'te alt sayfanın altına taşmaz); Geçmiş'te olay ayrıntısında görünür.

**Kalan borçlar / dürüst notlar:** (1) Durum ve kapı ekranları gerçek veriyle gösterilemedi (taze düşüş yok). (2) «Görüntü kaynaklı» lehine «sahne bulutu» kanıtı Sentinel-2 karosunun genel bulut yüzdesidir, bahçeye özgü değildir; bu yüzden «destekleyici» kalır ve tek başına sebep seçtirmez. (3) Erken sinyal ölçümü (komşu halka, SCL gölgesi) kabul ölçütünü geçmedi; kapı eski haliyle kalır (`docs/agro/sebep-ayristirma.md` §7).
