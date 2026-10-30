// Yön C PDF'i. Kullanım: node pdf-c.cjs  (önce uret.py ve foto.cjs; onizleme/c-*.jpg)
const { createRequire } = require('module')
const req = createRequire(require('path').resolve(__dirname, '../../../bahcelab-frontend/package.json'))
const { chromium } = req('@playwright/test')
const fs = require('fs'), path = require('path')
const OUT = path.resolve(__dirname, '../gorsel-dil-v2-yon-c.pdf')
const css = fs.readFileSync(path.join(__dirname, 'tokens-c.css'), 'utf8')
const T = Object.fromEntries([...css.slice(css.indexOf(':root'), css.indexOf('[data-tema')).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
const sw = (n) => `<li><i style="background:${T[n]}"></i><b>${n.slice(2)}</b><span>${T[n]}</span></li>`
const img = (f) => 'file://' + path.join(__dirname, 'onizleme', f)
const EK = { liste: ['Bahçeler', 'Karar: «İki bahçe de normal.» Her satırda büyük cevap «Normal», gerçek değer küçük yazıda; mini çizgi + veri yaşı'],
  durum: ['Bahçe · Durum', 'Karar: «Bahçe bu mevsim için normal.» Büyük sayı normale göre konum; en fazla 2 sade not haritada'],
  su: ['Bahçe · Su', 'Karar: «Toprak nemli, bu hafta sulama gerekmiyor.» Büyük sayı kök bölgesi doluluğu; iki panelli su dengesi'],
  gecmis: ['Geçmiş', 'Karar: «Bu sezon normal ya da normalin üstünde.» Sadeleşmiş sezon çizgisi + 12 yaz ortak skalada'] }
const sayfa = (ek) => `<section class="s"><h2>${EK[ek][0]} <span>${EK[ek][1]}</span></h2><div class="r"><div><h3>1440 × 900</h3><img class="g" src="${img(`c-${ek}-1440.jpg`)}"></div><div><h3>390 × 844</h3><img class="d" src="${img(`c-${ek}-390.jpg`)}"></div></div></section>`
const html = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="file://${path.join(__dirname, 'yazi/source-sans.css')}"><style>
@page{size:1587px 1123px;margin:0} *{box-sizing:border-box;margin:0} body{font:15px/21px 'Source Sans 3',sans-serif;color:#1b201e;background:#fff}
.s,.k{width:1587px;height:1123px;padding:28px 36px;page-break-after:always;overflow:hidden}
h1{font:600 32px/38px 'Source Sans 3';margin-bottom:6px} h2{font:600 22px/28px 'Source Sans 3';margin-bottom:12px} h2 span{font:400 15px 'Source Sans 3';color:#59615f;margin-left:12px} h3{font:600 13px/18px 'Source Sans 3';color:#59615f;margin-bottom:6px}
.r{display:grid;grid-template-columns:1fr 262px;gap:24px;align-items:start}.g{width:100%;display:block;border:1px solid #dcdfde}.d{width:262px;display:block;border:1px solid #dcdfde}
table{border-collapse:collapse;font-size:14px;width:100%;margin:8px 0 14px}td,th{border:1px solid #dcdfde;padding:5px 9px;text-align:left;vertical-align:top}th{background:#f1f2f2;font-weight:600}
.c2{display:grid;grid-template-columns:1fr 1fr;gap:26px}.sw{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 10px;margin:6px 0 12px;padding:0;list-style:none}.sw li{display:flex;align-items:center;gap:6px;font-size:13px}.sw i{width:24px;height:24px;border:1px solid #0003;border-radius:3px;flex:none}.sw span{color:#59615f;margin-left:auto;font-size:12px}
p{max-width:1400px;margin:5px 0}.sp .kr{font:600 28px/34px 'Source Sans 3'}.sp .sy{font:600 60px/58px 'Source Sans 3';font-variant-numeric:tabular-nums}
</style>
<section class="k"><h1>Yön C · «Saha»: nötr, ciddi tarım aracı</h1><p>B'nin iskeleti (düzen, yoğunluk, kart yapısı, mobil alt sayfa) korunarak «yapay zekâ hissi» veren öğeler çıkarıldı. Aynı gerçek veri (jlnnlk / soğuk hava, 29 Eki 2026), mutlak skala, ilkeler 1–11. <b>Uygulama yok.</b></p>
<table><tr><th>İstek</th><th>Yön C'de nasıl</th></tr>
<tr><td>1 · Krem kâğıt + serif başlık yok</td><td>Yüzeyler nötr: sayfa <code>#f1f2f2</code>, kart beyaz. Sıcaklık yalnız marka yeşili (birincil eylem, seçili sekme çizgisi), logo limon noktası ve veriden. Serif yok.</td></tr>
<tr><td>2 · Büyük harfli mono eyebrow yok</td><td>Eyebrow tamamen kaldırıldı (DURUM · JLNNLK, AYNI HAVA HÜCRESİ yok). Bağlam zaten bahçe çubuğunda. Mono yazı hiç kullanılmadı; hizalama <code>tabular-nums</code> ile.</td></tr>
<tr><td>3 · Hap yok, gölge yalnız yüzende</td><td>Köşe 6 px (kontrol, kart), 4 px (rozet/çip). Kartlar 1 px çizgiyle ayrılır, kartta gölge yok. Gölge yalnız harita üstündeki yüzen ray ve lejantta: <code>0 1px 3px rgb(0 0 0/.14)</code>. Not kutuları gölgesiz.</td></tr>
<tr><td>4 · Yazı tipi</td><td><b>Source Sans 3</b> (tek aile, self-host, Google isteği yok). Gerekçe aşağıda.</td></tr>
<tr><td>5 · Gradyan, cam, parıltı, emoji, süs ikonu yok</td><td>Arayüzde gradyan yok (ray örneği düz renkli kare); gradyan yalnız veri rampasında (harita lejantı, 12 yaz skalası). Cam bulanıklığı kaldırıldı. Emoji ve süs simge kaldırıldı: üst çubukta «Bildirimler», «Ara» metin düğmesi.</td></tr>
<tr><td>6 · Kısa karar cümlesi</td><td>Tek cümle, noktalı virgül yok, jargon yok. «Normal bant», «kademe», «p10–p90», «NDVI» başlıkta geçmez (lejantta bile «Canlılık», «Yaprak suyu»). Cümleler API alanlarından türetilir (kodda doğrulayıcı <code>assert</code>).</td></tr>
<tr><td>7 · Büyük sayı çiftçinin sorusu</td><td>Durum: «Normal» (bandın dışındaysa «−%8» gibi ortancaya göre sapma); gerçek değer küçük yazıda (canlılık 0,67 · bu ay genelde 0,64–0,72). Su: kök bölgesi doluluğu %100. Geçmiş: 15/17 görüntü normal ya da üstünde.</td></tr>
<tr><td>8 · Sade kartografik not</td><td>Normal yazı, küçük harf, 1 px kenar, ince çizgi, gölgesiz; ekran başına en fazla 2 not.</td></tr></table>
<p><b>Yazı tipi seçimi.</b> IBM Plex Sans ve Source Sans 3 aynı metinle denendi (karşılaştırma görseli sonraki sayfada): ikisi de Türkçe karakterleri tam gösteriyor ve <code>tabular-nums</code> ile rakamları hizalıyor. Source Sans 3 seçildi: (1) Plex'ten daha dar; 456 px yan panelde ve 390 px'te aynı metin daha az satıra sığıyor, (2) rakam şekilleri 12–13 px'te net, (3) görünümü nötr ve «teknik/kurumsal arayüz» havası daha az; sahada kullanılan araçların sade tonuna yakın. Plex'in avantajı daha belirgin karakteri; bu, aranan nötrlüğe ters düştü. Her iki aile de yapay zekâ maketlerinde aşırı kullanılan listede değil. Yazı ölçeği: 12 / 13 / 15 / 16 / 28 / 60 px; ağırlık 400, 500, 600, 700.</p>
<p><b>Sınırlar (dürüstlük).</b> Mutlak skalada harita neredeyse tek tonlu; bu gerçek veri. «Normal» etiketi aylık normal bantla (Sentinel-2, p25–p75) kıyastır; ayrıntıda «?» açılır. Mobil harita 300 px'e kırpıldı. Aynı hava hücresi notu JSON eşitliğinden türetildi. Bu bir maket; ürüne alınırken bileşen, erişilebilirlik ve performans testleri ayrıca yapılır.</p></section>
<section class="k"><h1>Yazı tipi denemesi ve token önerisi</h1><img src="${img('yazi-karsilastirma.png')}" style="width:1100px;display:block;border:1px solid #dcdfde;margin:6px 0 14px">
<div class="c2"><div class="sp"><p class="kr">Toprak nemli, bu hafta sulama gerekmiyor.</p><p class="sy">%100</p>
<ul class="sw">${['--yuzey-0', '--yuzey-1', '--cizgi', '--cizgi-guclu', '--metin', '--metin-2', '--metin-3', '--vurgu'].map(sw).join('')}</ul>
<ul class="sw">${['--bitki-1', '--bitki-3', '--bitki-5', '--su', '--sicak-2', '--sicak-4', '--iyi', '--uyari', '--sorun', '--marka-limon'].map(sw).join('')}</ul></div>
<div><table><tr><th>Token</th><th>Değer</th></tr><tr><td>Yazı</td><td>Source Sans 3 · 12/16 etiket · 13/18 yardımcı · 15/21 gövde · 16/22 kart · 28/34 karar · 60/58 sayı</td></tr><tr><td>Köşe</td><td>6 kontrol · 6 kart · 4 rozet</td></tr><tr><td>Gölge</td><td>kartta yok · yüzende 0 1px 3px rgb(0 0 0/.14)</td></tr><tr><td>Çizgi</td><td>kart 1 px #dcdfde · seri 2 px · eksen 1 px</td></tr><tr><td>Boşluk</td><td>4 · 8 · 12 · 16 · 20 · 24 · 32</td></tr><tr><td>Birincil eylem</td><td>marka yeşili #1e4b35</td></tr><tr><td>Koyu tema</td><td>aynı veri rampaları; yüzeyler antrasit</td></tr></table><p>Dosya: <code>docs/design/gorsel-dil-v2/tokens-c.css</code>. Grafik bileşen seti ve visx ADR taslağı Yön A/B ile ortaktır (<code>bilesenler.md</code>).</p></div></div></section>
${['liste', 'durum', 'su', 'gecmis'].map(sayfa).join('')}`
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage()
  fs.writeFileSync(path.join(__dirname, 'pdf-c.html'), html)
  await p.goto('file://' + path.join(__dirname, 'pdf-c.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
  await p.pdf({ path: OUT, width: '1587px', height: '1123px', printBackground: true })
  await b.close(); console.log('pdf', OUT, fs.statSync(OUT).size)
})()
