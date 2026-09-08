# Phase 1 B — Ürün Spec

## Ürün Tanımı

> Boş araziden hasada kadar akıllı planlama, dikim, bakım ve sonuç simülasyonu.

## Bu Bir Form Wizard Değil

Bu bir **spatial planning workspace**. Kullanıcı aynı anda:
- Araziyi görür
- Dikim düzenini görür
- Ürün bilgisini görür
- Hesaplanan özetleri görür
- Bakım planını görür
- Simülasyonu çalıştırabilir
- Sonucu spatial olarak inceler

## Kullanıcı Akışı

### Senaryo 1: Boş Arazi

```
Yeni Plan Oluştur
  → Haritada polygon çiz
  → Ürün seç (Limon → Meyer → Carrizo)
  → Dikim mesafesi belirle (6m × 6m)
  → Sistem gerçek grid hesaplar
  → Bakım planı oluştur
  → Simülasyonu başlat
  → Planı kaydet
  → (Opsiyonel) Gerçek bahçeye uygula
```

### Senaryo 2: Mevcut Bahçe

```
Mevcut Bahçe Seç
  → Garden geometry otomatik gelir
  → Ürün seç
  → ... (aynı akış)
```

## 5 Ana Adım

| # | Adım | Açıklama |
|---|------|----------|
| 1 | Arazi Tanımı | Polygon çiz veya bahçe seç |
| 2 | Ürün Seçimi | Product / Variety / Rootstock |
| 3 | Planlama | Dikim mesafesi, grid, spacing |
| 4 | Bakım Planı | Sulama, besleme, budama (plan düzeyinde) |
| 5 | Simülasyon | Gelişim timeline, hasat senaryosu |

## Bakım Planı Sınırı

**Yapılır:** Plan oluşturma, kullanıcıya gösterme  
**Yapılmaz:** Otomatik sulama, IoT, vana kontrolü, otonom karar

## Simülasyon Sınırı

**Yapılır:** Kontrollü, etiketlenmiş senaryo simülasyonu  
**Yapılmaz:** Bilimsel yield garantisi, hava durumu modeli, hastalık kaybı tahmini

Tüm simülasyon çıktıları UI'da **"Simülasyon"** veya **"Tahmini senaryo çıktısı"** olarak etiketlenir.

## Ürün Hiyerarşisi

```
Product: Limon
  └── Variety: Meyer
        └── Rootstock: Carrizo
```

Başlangıçta citrus öncelikli. Veri yoksa çeşit uydurma — `no_data` state göster.

## Responsive

| Breakpoint | Davranış |
|------------|----------|
| 1440px | Referans tasarım (primary) |
| 1280px | Sıkıştırılmış 3 kolon |
| 1024px | Sağ panel collapse |
| 768px | Stacked: stepper → map → summaries → timeline |
| 390px | Mobile stacked |
