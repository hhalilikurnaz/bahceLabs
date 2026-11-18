# 0033 — Olası sebep ayrıştırma: kural tabanlı, açıklanabilir, çekimser (ADIM 10B · Dilim 1)

Durum: kabul edildi (Dilim 0 koşullu GO, 2026-11-17). İlgili: ADR 0018 (olay motoru), ADR 0021 (olay ön doğrulaması), ADR 0030 (izleme), ADR 0031/0032 (don), `docs/agro/sebep-ayristirma.md`.

## Karar
1. **Seçilebilir sebepler yalnız don, su ve görüntü kaynaklıdır.** Besin, hastalık/zararlı ve mekanik/yönetim için doğrudan uydu kanıtı yoktur; bunlar seçilemez, yalnız «sahada kontrol edin» listesidir.
2. **Eleme ile seçim yok.** Bir sebep ancak en az bir DOĞRUDAN lehte kanıtı varsa, puanı ≥ 2,0 ve ikinciden ≥ 0,5 öndeyse seçilir; aksi halde «belirsiz» ve nedeni döner. «Başka açıklama yok» kanıt sayılmaz. Kilit vaka: 1 Şubat 2025 düşüşü (donun öncesi) «belirsiz».
3. **Bağımsızlık etiketi her kanıt satırında:** bağımsız = istasyon · dış kayıt · kullanıcı yanıtı; bağımlı = model/ERA5 · uydu · radar. Bağımsız kanıt ×1,5 ağırlıklıdır; bağımsız lehte kanıt yoksa güven sözcüğü «daha olası» olamaz (en çok «olası»). Döngüsellik (olay motorunun kendi etiketi) belgede açıkça yazılır.
4. **Görüntü kaynaklı = kapı.** Görüntü seçildiyse, puanı ≥ 2,0 ve don puanı < 1,0 ise o SAF optik düşüş için uyarı/bildirim (bildirim işi ve Bugün listesi) üretilmez; olay Geçmiş'te kalır. Ekran mesajı: «Görüntü kaynaklı olabilir (bulut gölgesi/sis/sınıflandırma) — bir sonraki net görüntüyü bekleyin» + sonraki geçişin TAHMİNİ tarihi (bahçenin son 10 net sahnesi arası ortanca aralık). Don bağlantılı olaylar kapıya girmez.
5. **Puan olasılık değildir;** ekranda yüzde yok. Ağırlıklar katalogda (`sebep`), hepsi «ön değer · mühendis onayı bekliyor»; kararlılık (ağırlık ×U(0,7–1,3), 200 deneme) çıktıda döner.
6. **Etiket:** kullanıcı «sebep buydu» yanıtı ayrı tabloya (`sebep_etiket`; yanıt anındaki model seçimi ve sırası ile) ve Saha Defteri'ne gözlem olarak yazılır; 9J kural performansına `sebep_ayrisma` girer. Eğitimde kullanım için `egitim_riza` alanı vardır, varsayılan YOK; rıza metni Adım 19–20. ML yok.

## Sonuç ve sınırlar
- İki bahçe (yaklaşık 13 bağımsız tarih), tek bağımsız dış etiket (Şubat 2025 don): doğruluk ÖLÇÜLEMEDİ; yalnız tutarlılık denetimi.
- Kapı, uyarı anındaki veriyle geriye dönük 13 uyarının **hiçbirini** bastırmazdı (uyarı anında görüntü kanıtı en çok 1,0 puan). Kapı hazırdır; erken sinyal (SCL gölge payı, ikinci sensör) ayrı karar.
- Kaynakça: açılamayan/okunamayan bağlantılar «doğrulanamadı» işaretlidir.

## Dilim 2 eki (arayüz ve erken sinyal)
- **Güven kademesi:** kararlılık < 0,5 ise güven sözcüğü bir kademe düşer (daha olası → olası → zayıf olasılık) ve görüntü kapısı kapanmaz (kararsız seçimle uyarı bastırılmaz). Katalog: `sebep.kararlilik_min`.
- **Erken sinyal (kapı):** komşu halka eş zamanlı düşüşü (z ≤ −1 + hava kanıtı yok) ve SCL gölge+bulut payı (≥ %10, bahçe + 100 m) uyarı anındaki veriyle ölçüldü; ikisi de sonradan toparlanmayan (kalıcı) bir uyarıyı bastırdı → kabul ölçütü geçmedi, kapı eski haliyle kalır, motora eklenmedi. Ölçüm betiği ve SCL yardımcısı korunur.
- **Arayüz:** «Olası sebepler (kesin değil)» Durum Yapılacaklar maddesinde, haritada olay kartında ve Geçmiş olay ayrıntısında; yüzde yok; her kanıt satırında bağımsızlık etiketi; kapı devredeyse Durum'da tek satır bilgi (uyarı değil). `GET /gardens/{id}/bugun` maddesi S2 düşüşü içeren olayda `olay_id` taşır.
