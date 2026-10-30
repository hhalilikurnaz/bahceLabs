// Tek PDF: A ve B yan yana, aynı ekranlar. Kullanım: node pdf.cjs  (önce uret.py ve foto.cjs)
const { createRequire } = require('module')
const req = createRequire(require('path').resolve(__dirname, '../../../bahcelab-frontend/package.json'))
const { chromium } = req('@playwright/test')
const fs = require('fs'), path = require('path')
const OUT = path.resolve(__dirname, '../gorsel-dil-v2-yonler.pdf')
const tok = (yon) => {
  const css = fs.readFileSync(path.join(__dirname, `tokens-${yon}.css`), 'utf8')
  const root = css.slice(css.indexOf(':root'), css.indexOf('[data-tema'))
  return Object.fromEntries([...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}
const T = { a: tok('a'), b: tok('b') }
const sw = (yon, ad) => `<li><i style="background:${T[yon][ad]}"></i><b>${ad.slice(2)}</b><span>${T[yon][ad]}</span></li>`
const grup = (yon, adlar) => `<ul class="sw">${adlar.map((n) => sw(yon, n)).join('')}</ul>`
const YUZ = ['--yuzey-0', '--yuzey-1', '--yuzey-2', '--cizgi', '--cizgi-guclu', '--metin', '--metin-2', '--metin-3', '--vurgu']
const VERI = ['--bitki-1', '--bitki-3', '--bitki-5', '--su', '--sicak-2', '--sicak-4', '--sicak-5', '--iyi', '--uyari', '--sorun']
const EK = { liste: ['Bahçeler listesi', 'mini çizgi + durum + veri yaşı; liste de tek soruya cevap verir: «hangi bahçeye bakmalıyım?»'],
  durum: ['Bahçe · Durum', 'karar cümlesi + tek büyük sayı → tek kanıt grafiği → ayrıntı (akordeon); kartografik notlar haritada'],
  su: ['Bahçe · Su', 'yeni su dengesi: iki panel, ortak zaman ekseni, çift eksen yok; sekme haritayı da değiştirir (yaprak suyu)'],
  gecmis: ['Geçmiş', 'sadeleştirilmiş sezon eğrisi (tek normal bant, doğrudan etiket) + 12 yaz ortak mutlak skalada'] }
const img = (f) => 'file://' + path.join(__dirname, 'onizleme', f)
const sayfa = (ek) => `<section class="s"><h2>${EK[ek][0]} <span>${EK[ek][1]}</span></h2><div class="iki">${['a', 'b'].map((y) => `
 <div class="yon"><h3>YÖN ${y.toUpperCase()} · ${y === 'a' ? 'Defter' : 'İstasyon'}</h3><img class="g" src="${img(`${y}-${ek}-1440.jpg`)}"><div class="alt"><img class="d" src="${img(`${y}-${ek}-390.jpg`)}"><p>1440 × 900 ve 390 × 844 · aynı gerçek veri (jlnnlk / soğuk hava, 29 Eki 2026) · mutlak skala</p></div></div>`).join('')}</div></section>`
const html = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="file://${path.join(__dirname, 'yazi/yazi.css')}"><style>
@page{size:1587px 1123px;margin:0} *{box-sizing:border-box;margin:0} body{font:14px/20px 'IBM Plex Sans',sans-serif;color:#20271d;background:#fff}
.s,.k{width:1587px;height:1123px;padding:28px 32px;page-break-after:always;overflow:hidden;position:relative}
h1{font:600 34px/38px 'Newsreader',serif;margin-bottom:8px} h2{font:600 22px/28px 'IBM Plex Sans';margin-bottom:10px} h2 span{font:400 14px 'IBM Plex Sans';color:#5d5a4c;margin-left:10px}
h3{font:600 13px/18px 'JetBrains Mono',monospace;letter-spacing:.04em;margin-bottom:6px;color:#20271d}
.iki{display:grid;grid-template-columns:1fr 1fr;gap:24px}.yon{border:1px solid #d6cbb0;padding:12px;border-radius:4px}
.g{width:100%;display:block;border:1px solid #cfc8b4}.alt{display:flex;gap:14px;align-items:flex-start;margin-top:10px}.d{width:196px;border:1px solid #cfc8b4;display:block}.alt p{font-size:13px;color:#5d5a4c;max-width:380px}
.k p{max-width:1300px;margin:6px 0} table{border-collapse:collapse;margin-top:12px;font-size:14px;width:100%} td,th{border:1px solid #d6cbb0;padding:6px 10px;text-align:left;vertical-align:top} th{background:#f3ecdc}
.sw{display:grid;grid-template-columns:repeat(5,1fr);gap:6px 10px;margin:6px 0 12px;padding:0;list-style:none}.sw li{display:flex;align-items:center;gap:6px;font-size:12px}.sw i{width:26px;height:26px;border:1px solid #0003;border-radius:3px;flex:none}.sw b{font-weight:600}.sw span{color:#5d5a4c;margin-left:auto;font-family:'JetBrains Mono';font-size:11px}
.col{display:grid;grid-template-columns:1fr 1fr;gap:28px}.spec{border:1px solid #d6cbb0;padding:14px;border-radius:4px}
.sa .kr{font:500 30px/34px 'Newsreader',serif}.sa .sy{font:500 68px/62px 'Newsreader',serif}.sa .ui{font:14px/20px 'IBM Plex Sans'}.sa .et{font:600 12px 'IBM Plex Sans';letter-spacing:.07em;text-transform:uppercase}
.sb .kr{font:600 26px/30px 'Inter Tight';letter-spacing:-.02em}.sb .sy{font:600 76px/64px 'Inter Tight';letter-spacing:-.04em}.sb .ui{font:14px/20px 'Inter Tight'}.sb .et{font:500 12px 'JetBrains Mono';text-transform:uppercase}
ul.l{margin:6px 0 0 18px;font-size:14px}
</style>
<section class="k"><h1>BahçeLab · Görsel dil v2: iki yön</h1><p>Yalnız maket. Ürün koduna uygulama yok. Ölçüt: <b>görselleştirme ilkeleri 1–11</b> (docs/design/gorsellestirme-ilkeleri.md). Veri: dev veritabanındaki jlnnlk ve soğuk hava'dan dışa aktarılmış <b>gerçek</b> anlık görüntü (29 Eki 2026); haritalar gerçek altlık + gerçek raster, mutlak skala. Uydurma sayı yok.</p>
<table><tr><th></th><th>YÖN A · Defter</th><th>YÖN B · İstasyon</th></tr>
<tr><td>Fikir</td><td>Kartografik defter: ılık kâğıt, cetvel çizgisi, editoryal serif karar cümlesi</td><td>Ölçüm istasyonu: serin yüzeyler, yumuşak kartlar, sıkı sans karar cümlesi, mono etiket</td></tr>
<tr><td>Yüzey ve renk sıcaklığı</td><td>Sıcak (krem kâğıt, zeytin mürekkep), birincil eylem limon</td><td>Soğuk (gri-yeşil, beyaz kart), birincil eylem koyu mürekkep; limon yalnız logo noktası</td></tr>
<tr><td>Tipografi</td><td>Newsreader (karar, büyük sayı) + IBM Plex Sans</td><td>Inter Tight (karar + arayüz) + JetBrains Mono (etiket)</td></tr>
<tr><td>Yoğunluk</td><td>Rahat, satır tabanlı (cetvelli kayıt)</td><td>Yoğun, kart tabanlı</td></tr>
<tr><td>Köşe · çizgi · gölge</td><td>2–3 px köşe · 1 px hairline, çift çizgi ayraç · gölge yok (yalnız not kutusunda sert gölge)</td><td>8–14 px köşe · 2,25 px seri, yuvarlak uç · yumuşak gölge</td></tr>
<tr><td>Kontrol rayı</td><td>Haritanın üstünde tam genişlik ince cetvel şeridi</td><td>Yüzen hap (pill); mobilde alt sayfa tutamaçlı</td></tr>
<tr><td>Kartografik not</td><td>Kâğıt kutu, serif metin, 1 px mürekkep çizgi, sert gölge</td><td>Beyaz kart, mono üst etiket, 2 px beyaz çizgi + nokta</td></tr>
<tr><td>Normal bant motifi</td><td>Zeytin yeşili bant, ince kesikli ortanca</td><td>Turkuaz-yeşil bant, aynı mantık</td></tr>
<tr><td>Gücü</td><td>Marka kimliği güçlü, okuma ve bilgi yoğunluğu dengeli; basılı rapor/PDF'e doğal uzanır</td><td>Çok veri/çok bahçe için ölçeklenir; tablet ve saha kullanımında net hiyerarşi</td></tr>
<tr><td>Riski</td><td>Serif karar cümlesi dar ekranda uzun; keskin köşe «resmî» durabilir</td><td>Jenerik «dashboard» görünümüne kayma riski; imza öğelere (not, bant) bağlı</td></tr></table>
<p style="margin-top:14px"><b>Ortak imzalar (iki yönde de):</b> kartografik notlar · «kendi geçmişine göre» normal bant motifi (tüm zaman grafiklerinde) · editoryal karar cümlesi + tek büyük sayı · tek kontrol rayı (uzman kontrolleri ⋯ altında) · mutlak skala, tahmin taramalı, veri yaşı rozetli, doğrudan etiket.</p>
<p><b>Grafik bileşen seti ve kütüphane:</b> ChartFrame · TimeDomain · ValueAxis/TimeAxis · NormalBand · Threshold · Forecast · DirectLabel · Annotation · ChartTooltip · StaleBadge · ChartState; türler: BandLine, DivergingBars, CumulativeLine, Bullet, Dumbbell, Strip, Histogram, SmallMultiples, TierStrip, MapLegend. Kütüphane önerisi <b>visx</b> (ADR taslağı); ölü d3 bağımlılıkları buna göre.</p></section>
<section class="k"><h1>Token önerisi (tek tokens.css taslağı)</h1><div class="col">
${['a', 'b'].map((y) => `<div class="spec s${y}"><h3>YÖN ${y.toUpperCase()}</h3><p class="et">Yüzey · çizgi · metin</p>${grup(y, YUZ)}<p class="et">Veri ve durum (anlamı sabit: bitki yeşil, su mavi, sıcaklık sarı→kahve, uyarı amber+▲, sorun kırmızı+■)</p>${grup(y, VERI)}
<p class="et">Yazı ölçeği (12 px taban)</p><p class="kr">İzle: canlılık normal bandın içinde.</p><p class="sy">0,67</p><p class="ui">Gövde 14/20 · yardımcı 13/18 · etiket 12/16 — Türkçe: ığüşöçİ</p><p class="et">ÇİZGİ · ETİKET · 12 PX</p>
<ul class="l"><li>Boşluk: 4 · 8 · 12 · 16 · 20 · 24 · 32 (yarım adım yok)</li><li>Köşe: ${T[y]['--r-kontrol']} kontrol · ${T[y]['--r-kart']} kart · ${T[y]['--r-rozet']} rozet</li><li>Gölge: ${y === 'a' ? 'yok (düz) · not kutusunda sert gölge' : 'e1 kart · e2 yüzen'}</li><li>Çizgi: ince ${T[y]['--cizgi-ince']} · seri ${T[y]['--cizgi-seri']}</li><li>Açık ve koyu tema aynı veri rampaları</li></ul></div>`).join('')}</div></section>
${['liste', 'durum', 'su', 'gecmis'].map(sayfa).join('')}`
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage()
  fs.writeFileSync(path.join(__dirname, 'pdf.html'), html)
  await p.goto('file://' + path.join(__dirname, 'pdf.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
  await p.pdf({ path: OUT, width: '1587px', height: '1123px', printBackground: true })
  await b.close(); console.log('pdf', OUT, fs.statSync(OUT).size)
})()
