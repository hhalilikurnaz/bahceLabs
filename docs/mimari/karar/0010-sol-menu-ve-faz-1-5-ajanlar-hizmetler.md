# ADR 0010 — Sol menü bilgi mimarisi ve Faz 1.5 (Ajanlar ve Hizmetler)

**Durum:** kabul (Adım 8B düzeltmeleri)

**Bağlam.** Ürün yalnızca izleme değil, çiftçinin evrak işlerini yapan «ajanlar» ve sahaya gelen «hizmetler» ile genişleyecek. Sol menü bu yönü baştan göstermeli; ölü bağlantı bırakılmaz.

**Karar.**
1. Sol menü (üstten alta): **Bahçelerim · İşlerim · Hizmetler · Pazar · Bildirimler**, altta **Ayarlar**. Yollar: `/bahcem`, `/bahcem/islerim`, `/bahcem/hizmetler`, `/bahcem/pazar`, `/bahcem/bildirimler`, `/bahcem/ayarlar`.
2. **İşlerim** (Faz 1.5, «Yakında»): hibe/destek, kalıntı ve ihracat uyumu, sertifika, sigorta ve hasar, kredi dosyası, satış, sürdürülebilirlik raporu ajanları.
3. **Hizmetler** (Faz 1.5, «Yakında»): saha ekipleri (drone ilaçlama/gübreleme, budama, hasat ekibi, nakliye), laboratuvar (toprak/yaprak/su/kalıntı analizi), uzman (ziraat mühendisi danışmanlığı).
4. **Pazar:** satış ve depo (Adım 17), girdi ve finansman (Faz 1.5). Eski «Pazar & Depo» adı «Pazar» oldu.
5. Faz 1.5 ürün planında Adım 20'den sonra, Faz 2'den önce yer alır; ajanlar mevcut `JobQueue` (ADR 0009) ve bildirim kanallarını kullanır. Hiçbiri bu adımda uygulanmadı: yalnızca menü ve «Yakında» listeleri vardır.

**Sonuçlar.** Rota/menü sabitleri `lib/routes.ts` içindedir; yeni bölüm eklemek bir sabit, bir rota ve bir `SectionPanel` girdisidir.
