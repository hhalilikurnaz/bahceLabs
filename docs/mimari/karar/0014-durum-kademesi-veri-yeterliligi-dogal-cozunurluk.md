# 0014 — Durum kademesi, yıl veri yeterliliği ve doğal çözünürlük (Adım 9B)

Durum: kabul edildi. Tarih: 2026-10-12.

## Bağlam
9B tasarım ilkeleri: arayüzde uydurma kesinlik yok; belirsizlik görünür; her piksel kendi çözünürlüğünde çizilir; ön değerler katalogda ve etiketli.

## Kararlar
1. **Durum kademesi (v1).** Mevcut iç skor (0–100) yalnız kademeyi belirler: ≥85 İyi · 70–84 İzle · 50–69 Dikkat · <50 Sorun. Aktif risk (uyarı ya da yüksek zararlı riski) kademeyi en fazla İzle yapar; kırmızı uyarı en az Dikkat. **Skor API yanıtında, arayüzde ve ipucunda yoktur**; yanıt kademe, üç çip (Ağaç gücü · Su · Risk: normal / normalin altı / belirgin düşük) ve «Nasıl hesaplandı?» (veri, tarih, güven, kademeyi düşüren bileşen, «ön değer · v1») döndürür. Eşikler `katalog.yaml › durum_kademesi`. Tam formül 9F'de.
2. **«Yetersiz veri» ≠ «uyumsuz yıl».** Yıl yeterliliği: analiz penceresinde (Haz–Eyl) farklı gün sayısı ve 10 günlük dönem kapsamı. Eşikler katalogda ön değer (en az 3 net sahne, dönemlerin %50'si). Yetersiz yıl kompozitte görünür, analize girmez, uyumsuzluk sorusu sorulmaz, elle eklenemez. 2015 «kısmi yıl» etiketlidir. Sahne okuma sırası dönem dönem en temizi önce: sınırlı bütçede sahneler birkaç döneme yığılıp yılı yapay olarak «yetersiz» göstermez.
3. **Uyumsuz yıl kararı.** Son iki yıl uyumsuz bulunsa bile sessizce atılmaz (korumalı: varsayılan dahil, kullanıcıya sorulur). Dahil/hariç kararı zamanıyla saklanır ve geri alınabilir. Karar kaydı 9G'deki bahçe geçmişinde olay olarak görünecek.
4. **Doğal çözünürlük.** Sentinel-2 20 m bantlar 10 m ızgaraya en yakın komşuyla okunur (2×2 blok); bilinear ara değer üretilmez. Harita her indeksi kare piksel olarak, en yakın komşu örneklemeyle ve bahçe poligonuna tam kırpılmış çizer.
5. **Tipik bant (ön değer).** Narenciye NDVI için 0,45–0,70 katalogdadır; histogram lejantında bağlam olarak gösterilir, karar kuralı değildir.
6. **Bildirim yaşam döngüsü.** oluştu → görüldü → çözüldü / ertelendi (süre dolunca yeniden oluştu). Aynı olay için tek bildirim (dedupe) korunur; çözülen bildirim iş tekrarında geri gelmez.

## Sonuçlar
- Kademe formülü değişince yalnız `score.py` ve katalog değişir; API sözleşmesi sabit kalır.
- 20 m indeksler (NDMI, NDRE…) artık 2×2 bloklu görünür; eski bilinear görünüm geri gelmez.
