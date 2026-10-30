#!/usr/bin/env python3
"""Görsel dil v2 · statik maket üreticisi (YALNIZ MAKET; ürün koduna uygulama yok).

Kullanım:  python3 uret.py            → yon-a/*.html, yon-b/*.html
Veri: veri/*.json (dev veritabanındaki jlnnlk ve soğuk hava'dan dışa aktarılmış GERÇEK anlık görüntü, 2026-10-29).
Harita: gorsel/harita-*.png (gerçek raster + gerçek altlık), gorsel/yaz-*.png (çok yıllı analizin yıllık gerçek ızgaraları).
Uydurma sayı yoktur: ekrandaki her sayı JSON'dan okunur ya da JSON'dan türetilir (türetmeler `tur()` işlevlerinde).
"""
from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path

KOK = Path(__file__).parent
V = KOK / 'veri'
BUGUN = date(2026, 10, 29)
AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
AY_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']


def yukle(ad: str):
    return json.loads((V / f'{ad}.json').read_text(encoding='utf8'))


def sayi(v: float, d: int = 2) -> str:
    return f'{v:.{d}f}'.replace('.', ',')


def tarih(iso: str, yil: bool = False) -> str:
    d = date.fromisoformat(iso)
    return f'{d.day} {AY_KISA[d.month - 1]}' + (f' {d.year}' if yil else '')


def gun_once(iso: str) -> int:
    return (BUGUN - date.fromisoformat(iso)).days


# ───────────────────────────────────────────────────────── veri
BAHCELER = {'jlnnlk': 'jlnnlk', 'soguk-hava': 'soğuk hava'}
D: dict[str, dict] = {}
for slug in BAHCELER:
    D[slug] = {
        'durum': yukle(f'{slug}-durum'), 'bugun': yukle(f'{slug}-bugun'), 'su': yukle(f'{slug}-su'),
        'ed': yukle(f'{slug}-edinimler'), 'bant': yukle(f'{slug}-normal-bantlar'), 'egri': yukle(f'{slug}-canlilik-egrisi'),
        'cy': yukle(f'{slug}-cok-yillik'), 'go': yukle(f'{slug}-gecmis-ozeti'), 'fen': yukle(f'{slug}-fenoloji'),
    }
GARDENS = {g['ad']: g for g in yukle('gardens')}
OVERVIEW = {b['ad']: b for b in yukle('overview')['bahceler']}
YAZ = yukle('yaz-ozet')


def kalkis(slug: str) -> dict:
    """Bir bahçenin türetilmiş gerçekleri (hepsi JSON'dan)."""
    d = D[slug]
    son = d['ed']['edinimler'][-1]
    ndvi = son['gostergeler']['ndvi']['medyan']
    ay = date.fromisoformat(son['tarih']).month
    b = next(x for x in d['bant']['gostergeler']['ndvi'] if x['ay'] == ay)
    konum = 'altında' if ndvi < b['p25'] else 'üstünde' if ndvi > b['p75'] else 'içinde'
    # 30 gün önceki gözlem (±6 gün) ile fark
    # 30 gün önceki Sentinel-2 sahnesi (AYNI kaynak, ±8 gün); yoksa değişim yazılmaz
    hedef = date.fromisoformat(son['tarih']) - timedelta(days=30)
    adaylar = [{'tarih': e['tarih'], 'deger': e['gostergeler']['ndvi']['medyan']} for e in d['ed']['edinimler'] if 'ndvi' in e['gostergeler'] and abs((date.fromisoformat(e['tarih']) - hedef).days) <= 8]
    onc = min(adaylar, key=lambda g: abs((date.fromisoformat(g['tarih']) - hedef).days), default=None)
    return {'ndvi': ndvi, 'tarih': son['tarih'], 'yas': gun_once(son['tarih']), 'bant': b, 'konum': konum, 'onceki': onc, 'ay': ay,
            'bayat': [x['ad'] for x in d['durum']['bilesenler'] if x['bayat']]}


K = {s: kalkis(s) for s in BAHCELER}

# ───────────────────────────────────────────────────────── harita projeksiyonu
def mercator(lng: float, lat: float, zoom: float) -> tuple[float, float]:
    w = 512 * 2 ** zoom
    return (lng + 180) / 360 * w, (0.5 - math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) / (2 * math.pi)) * w


def projeksiyon(ad: str, cw: int, ch: int):
    """Kaynak harita görüntüsünü kapsayıcıya `cover` ile yerleştirir; (görüntü yerleşimi, lng/lat → kapsayıcı px) döndürür."""
    v = json.loads((KOK / 'gorsel' / f'{ad}.json').read_text())
    cx, cy = mercator(*v['center'], v['zoom'])
    sc = max(cw / v['w'], ch / v['h'])
    ox, oy = (cw - v['w'] * sc) / 2, (ch - v['h'] * sc) / 2
    geo = {'ad': ad, 'w': v['w'] * sc, 'h': v['h'] * sc, 'ox': ox, 'oy': oy}

    def p(lng: float, lat: float) -> tuple[float, float]:
        x, y = mercator(lng, lat, v['zoom'])
        return ox + (v['w'] / 2 + x - cx) * sc, oy + (v['h'] / 2 + y - cy) * sc

    return geo, p


def bolge_noktasi(slug: str, sinif: int, p) -> tuple[float, float]:
    """Çok yıllı bölge sınıfının EN BÜYÜK parçasının ağırlık merkezi (ekran px)."""
    for f in D[slug]['cy']['bolgeler']['features']:
        if f['properties'].get('sinif') != sinif:
            continue
        en, ort = -1.0, (0, 0)
        for poly in f['geometry']['coordinates']:
            ring = poly[0]
            alan = abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2
            if alan > en:
                en, ort = alan, (sum(q[0] for q in ring) / len(ring), sum(q[1] for q in ring) / len(ring))
        return p(*ort)
    raise KeyError(sinif)


# ───────────────────────────────────────────────────────── grafik yardımcıları
def nice_ticks(lo: float, hi: float, n: int = 4) -> list[float]:
    span = hi - lo
    if span <= 0:
        return [lo]
    raw = span / max(1, n - 1)
    pw = 10 ** math.floor(math.log10(raw))
    step = next(m * pw for m in (1, 2, 2.5, 5, 10) if m * pw >= raw)
    t = math.ceil(lo / step - 1e-9) * step
    out = []
    while t <= hi + 1e-9:
        out.append(round(t, 10))
        t += step
    return out


def egri_yolu(pts: list[tuple[float, float]]) -> str:
    """Catmull-Rom → kübik Bézier (pürüzsüz bant sınırı)."""
    if len(pts) < 3:
        return 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d


def doy(iso: str) -> float:
    d = date.fromisoformat(iso)
    return (d - date(d.year, 1, 1)).days + 0.5


def sezon_grafik(slug: str, W: int, H: int, ayrintili: bool = False, sade: bool = False) -> str:
    """Sezon eğrisi v2: tek normal bant + bu yıl çizgisi + doğrudan etiket. Lejant paragrafı yok (ilke 3, 7, 9).
    Normal bant = katalogdaki `normal_bant` kuralı (p25–p75 koyu, p10–p90 açık, ortanca ince çizgi), her grafikte aynı bileşen."""
    d = D[slug]
    ay_band = {b['ay']: b for b in d['bant']['gostergeler']['ndvi']}
    sol, sag, ust, alt = 36, 96, 24, 30
    iw, ih = W - sol - sag, H - ust - alt
    egri = [p for p in d['egri']['noktalar'] if p['tarih'].startswith('2026')]
    goz = [g for g in d['egri']['gozlemler'] if g['tarih'].startswith('2026')]
    vals = [ay_band[m][k] for m in ay_band for k in ('p10', 'p90')] + [p['deger'] for p in egri] + [g['deger'] for g in goz]
    lo, hi = min(vals) - 0.03, max(vals) + 0.03
    ticks = nice_ticks(lo, hi, 4)
    lo, hi = min(lo, ticks[0]), max(hi, ticks[-1])
    X = lambda dy: sol + dy / 365 * iw  # noqa: E731
    Y = lambda v: ust + (1 - (v - lo) / (hi - lo)) * ih  # noqa: E731
    mid = [(X(15 + 30.4 * (m - 1)), m) for m in range(1, 13)]

    def band_alan(k_alt: str, k_ust: str) -> str:
        ustp = [(x, Y(ay_band[m][k_ust])) for x, m in mid]
        altp = [(x, Y(ay_band[m][k_alt])) for x, m in reversed(mid)]
        return egri_yolu(ustp) + ' L' + egri_yolu(altp)[1:].replace('M', 'L', 1) + 'Z'

    o = [f'<svg class="grafik-svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Bu yılın canlılık eğrisi, bahçenin önceki sezonlardaki normal bandıyla">']
    o.append('<defs><pattern id="tarama" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--metin-3)" stroke-width="1.5" opacity=".5"/></pattern></defs>')
    for t in ticks:
        o.append(f'<line x1="{sol}" x2="{sol + iw}" y1="{Y(t):.1f}" y2="{Y(t):.1f}" class="izgara"/><text x="{sol - 8}" y="{Y(t) + 4:.1f}" class="eksen" text-anchor="end">{sayi(t, 1 if t * 10 == int(t * 10) else 2)}</text>')
    adim = 1 if iw / 12 >= 34 else 2
    for m in range(0, 12, adim):
        o.append(f'<text x="{X(15 + 30.4 * m):.1f}" y="{H - 8}" class="eksen" text-anchor="middle">{AY_KISA[m]}</text>')
    o.append(f'<path d="{band_alan("p10", "p90")}" fill="var(--bant-acik)"/>')
    o.append(f'<path d="{band_alan("p25", "p75")}" fill="var(--bant-koyu)"/>')
    o.append('<path d="' + egri_yolu([(x, Y(ay_band[m]['p50'])) for x, m in mid]) + '" fill="none" stroke="var(--bant-ortanca)" stroke-width="1" stroke-dasharray="3 3"/>')
    son_goz = max(g['tarih'] for g in goz)
    # çizgi: gözlem dayanaklı bölüm düz; tahmini bölüm kesikli
    seg: list[list] = []
    for p in egri:
        f = p['tahmini']
        if not seg or seg[-1][0] != f:
            seg.append([f, [p]])
        else:
            seg[-1][1].append(p)
    for f, ps in seg:
        pts = [(X(doy(p['tarih'])), Y(p['deger'])) for p in ps]
        if f:
            ust_p = [(X(doy(p['tarih'])), Y(p['ust'])) for p in ps]
            alt_p = [(X(doy(p['tarih'])), Y(p['alt'])) for p in reversed(ps)]
            o.append('<path d="M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in ust_p + alt_p) + 'Z" fill="url(#tarama)"/>')
        if len(pts) > 1:
            o.append(f'<path d="{"M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="var(--metin)" stroke-width="var(--cizgi-seri)" stroke-linecap="round" stroke-linejoin="round"{" stroke-dasharray=\"5 4\"" if f else ""}/>')
    if ayrintili:
        for g in goz:
            s2 = g['kaynak'] == 's2'
            o.append(f'<circle cx="{X(doy(g["tarih"])):.1f}" cy="{Y(g["deger"]):.1f}" r="{3.2 if s2 else 2.4}" fill="{"var(--metin)" if s2 else "var(--yuzey-1)"}" stroke="var(--metin)" stroke-width="1.2"/>')
    # bugün ve veri yaşı
    xb = X(doy(BUGUN.isoformat()))
    xs = X(doy(son_goz))
    o.append(f'<line x1="{xb:.1f}" x2="{xb:.1f}" y1="{ust - 6}" y2="{ust + ih}" stroke="var(--cizgi-guclu)" stroke-width="1"/><text x="{xb:.1f}" y="{ust - 10}" class="etiket" text-anchor="middle">bugün</text>')
    # doğrudan etiketler
    s2son = max((g for g in goz if g['kaynak'] == 's2'), key=lambda g: g['tarih'])
    xl, yl = X(doy(s2son['tarih'])), Y(s2son['deger'])
    o.append(f'<circle cx="{xl:.1f}" cy="{yl:.1f}" r="5" fill="var(--yuzey-1)" stroke="var(--metin)" stroke-width="2"/>')
    o.append(f'<g class="dogrudan"><text x="{xl - 8:.1f}" y="{yl + 24:.1f}" text-anchor="end" class="etiket-b">{tarih(s2son["tarih"])} · {sayi(s2son["deger"])}</text></g>')
    ekim = ay_band[10]
    o.append(f'<text x="{sol + iw + 8}" y="{Y(ekim["p50"]) + 4:.1f}" class="etiket">{"normal aralık" if sade else "normal bant"}</text>')
    o.append(f'<text x="{sol + iw + 8}" y="{Y(ekim["p50"]) + 19:.1f}" class="etiket-s">önceki {ekim["yil_sayisi"]} {"yıl" if sade else "sezon"}</text>')
    o.append(f'<text x="{xs + 6:.1f}" y="{Y(egri[-1]["deger"]) - 10:.1f}" class="etiket-s" text-anchor="start">{gun_once(son_goz)} gün gözlemsiz</text>' if gun_once(son_goz) > 10 else '')
    o.append('</svg>')
    return ''.join(o)


def spark(slug: str, W: int = 132, H: int = 36) -> str:
    """Liste mini çizgisi: son 150 gün gözlem çizgisi + o aylar için normal bant (aynı bileşen, küçük)."""
    d = D[slug]
    ay_band = {b['ay']: b for b in d['bant']['gostergeler']['ndvi']}
    bas = BUGUN - timedelta(days=150)
    goz = [{'tarih': e['tarih'], 'deger': e['gostergeler']['ndvi']['medyan']} for e in d['ed']['edinimler'] if e['tarih'] >= bas.isoformat() and 'ndvi' in e['gostergeler']]
    n = lambda iso: (date.fromisoformat(iso) - bas).days / 150  # noqa: E731
    vals = [g['deger'] for g in goz] + [ay_band[m][k] for m in ay_band for k in ('p25', 'p75')]
    lo, hi = min(vals) - 0.02, max(vals) + 0.02
    Y = lambda v: 3 + (1 - (v - lo) / (hi - lo)) * (H - 6)  # noqa: E731
    X = lambda t: 2 + t * (W - 8)  # noqa: E731
    gunler = [bas + timedelta(days=i) for i in range(0, 151, 5)]
    ustp = [(X((g - bas).days / 150), Y(ay_band[g.month]['p75'])) for g in gunler]
    altp = [(X((g - bas).days / 150), Y(ay_band[g.month]['p25'])) for g in reversed(gunler)]
    yol = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in ustp + altp) + 'Z'
    cizgi = 'M' + ' L'.join(f'{X(n(g["tarih"])):.1f},{Y(g["deger"]):.1f}' for g in goz)
    son = goz[-1]
    return (f'<svg class="spark" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Son 150 gün canlılık gözlemleri, normal bandıyla">'
            f'<path d="{yol}" fill="var(--bant-koyu)"/><path d="{cizgi}" fill="none" stroke="var(--metin)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{X(n(son["tarih"])):.1f}" cy="{Y(son["deger"]):.1f}" r="2.8" fill="var(--metin)"/></svg>')


def su_paneller(W: int, sade: bool = False) -> str:
    """Su dengesi v2: İKİ PANEL, ORTAK ZAMAN EKSENİ, çift eksen yok (ilke 11)."""
    g = D['jlnnlk']['su']['denge']['gunler']
    n = len(g)
    sol, sag = 40, 56
    iw = W - sol - sag
    X = lambda i: sol + (i + .5) * iw / n  # noqa: E731
    bar = max(3, iw / n - 2)
    ilk_tahmin = next(i for i, x in enumerate(g) if x['tahmin'])
    bx = X(ilk_tahmin) - iw / n / 2
    bw = sol + iw - bx
    maks_ham = max(max(x['yagis_mm'] or 0, x['etc_mm'] or 0) for x in g)
    tk = nice_ticks(0, maks_ham, 3)
    maks = max(maks_ham, tk[-1])
    # panel 1
    H1, u1, a1 = 150, 14, 6
    ih1 = H1 - u1 - a1
    ym = u1 + ih1 * .5
    Yu = lambda v: ym - v / maks * (ym - u1)  # noqa: E731
    Ya = lambda v: ym + v / maks * (u1 + ih1 - ym)  # noqa: E731
    o = [f'<svg class="grafik-svg" viewBox="0 0 {W} {H1}" width="{W}" height="{H1}" role="img" aria-label="Günlük yağış (yukarı) ve ETc (aşağı), mm/gün">']
    o.append('<defs><pattern id="tarama2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--metin-3)" stroke-width="1.5" opacity=".35"/></pattern></defs>')
    o.append(f'<rect x="{bx:.1f}" y="{u1 - 6}" width="{bw:.1f}" height="{ih1 + 12}" fill="url(#tarama2)"/>')
    for t in tk:
        if t == 0:
            continue
        for fn, sg in ((Yu, ''), (Ya, '−')):
            o.append(f'<line x1="{sol}" x2="{sol + iw}" y1="{fn(t):.1f}" y2="{fn(t):.1f}" class="izgara"/><text x="{sol - 8}" y="{fn(t) + 4:.1f}" class="eksen" text-anchor="end">{sg}{sayi(t, 0)}</text>')
    o.append(f'<line x1="{sol}" x2="{sol + iw}" y1="{ym:.1f}" y2="{ym:.1f}" stroke="var(--cizgi-guclu)"/><text x="{sol - 8}" y="{ym + 4:.1f}" class="eksen" text-anchor="end">0</text>')
    for i, x in enumerate(g):
        if x['veri_eksik']:
            continue
        ya = x['yagis_mm'] or 0
        op = .3 if (x['etkili_yagis_mm'] or 0) == 0 else (.6 if x['tahmin'] else 1)
        if ya > 0:
            o.append(f'<rect x="{X(i) - bar / 2:.1f}" y="{Yu(ya):.1f}" width="{bar:.1f}" height="{ym - Yu(ya):.1f}" fill="var(--su)" opacity="{op}"/>')
        o.append(f'<rect x="{X(i) - bar / 2:.1f}" y="{ym:.1f}" width="{bar:.1f}" height="{Ya(x["etc_mm"] or 0) - ym:.1f}" fill="var(--sicak-4)" opacity="{.6 if x["tahmin"] else .9}"/>')
    o.append(f'<text x="{sol + 6}" y="{u1 + 10}" class="etiket-su">yağış</text><text x="{sol + 6}" y="{u1 + ih1 - 2}" class="etiket-etc">{"bitki tüketimi" if sade else "ETc"}</text>')
    o.append(f'<text x="{bx + 6:.1f}" y="{u1 + ih1 - 2}" class="etiket-s">7 gün tahmin</text>')
    o.append('</svg>')
    p1 = ''.join(o)
    # panel 2
    H2, u2, a2 = 118, 10, 28
    ih2 = H2 - u2 - a2
    kum = [x['birikimli_mm'] for x in g]
    lo, hi = min(0, min(kum)), max(0, max(kum))
    tk2 = nice_ticks(lo, hi, 4)
    lo, hi = min(lo, tk2[0]), max(hi, tk2[-1])
    Yk = lambda v: u2 + (1 - (v - lo) / (hi - lo)) * ih2  # noqa: E731
    o = [f'<svg class="grafik-svg" viewBox="0 0 {W} {H2}" width="{W}" height="{H2}" role="img" aria-label="Birikimli su dengesi, mm; yağış eksi ETc">']
    o.append(f'<rect x="{bx:.1f}" y="{u2 - 4}" width="{bw:.1f}" height="{ih2 + 8}" fill="url(#tarama2)"/>')
    for t in tk2:
        o.append(f'<line x1="{sol}" x2="{sol + iw}" y1="{Yk(t):.1f}" y2="{Yk(t):.1f}" class="{"sifir" if t == 0 else "izgara"}"/><text x="{sol - 8}" y="{Yk(t) + 4:.1f}" class="eksen" text-anchor="end">{"−" if t < 0 else ""}{sayi(abs(t), 0)}</text>')
    gz = [(X(i), Yk(x['birikimli_mm'])) for i, x in enumerate(g) if not x['tahmin']]
    tz = [(X(i), Yk(x['birikimli_mm'])) for i, x in enumerate(g) if i >= ilk_tahmin - 1]
    o.append('<path d="M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in gz) + '" fill="none" stroke="var(--metin)" stroke-width="var(--cizgi-seri)" stroke-linejoin="round" stroke-linecap="round"/>')
    o.append('<path d="M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in tz) + '" fill="none" stroke="var(--metin)" stroke-width="var(--cizgi-seri)" stroke-dasharray="5 4" stroke-linejoin="round" stroke-linecap="round"/>')
    ex, ey = tz[-1]
    sg = '+' if kum[-1] > 0 else '−' if kum[-1] < 0 else ''
    o.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="3.6" fill="var(--yuzey-1)" stroke="var(--metin)" stroke-width="2"/><text x="{ex + 9:.1f}" y="{ey + 4:.1f}" class="etiket-b">{sg}{sayi(abs(kum[-1]), 0)}</text><text x="{ex + 9:.1f}" y="{ey + 18:.1f}" class="etiket-s">mm</text>')
    gx, gy = gz[-1]
    o.append(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="3.6" fill="var(--metin)"/><text x="{gx - 8:.1f}" y="{gy - 10:.1f}" class="etiket-b" text-anchor="end">bugün {("+" if g[ilk_tahmin - 1]["birikimli_mm"] > 0 else "−") + sayi(abs(g[ilk_tahmin - 1]["birikimli_mm"]), 0)} mm</text>')
    for i in (0, n // 2, n - 1):
        o.append(f'<text x="{X(i):.1f}" y="{H2 - 8}" class="eksen" text-anchor="{"start" if i == 0 else "end" if i == n - 1 else "middle"}">{tarih(g[i]["tarih"])}</text>')
    o.append('</svg>')
    return p1 + f'<p class="panel-baslik">{"Toplam su dengesi" if sade else "Birikimli denge"} <span>mm · yağış eksi {"bitki tüketimi" if sade else "ETc"}</span></p>' + ''.join(o)


# ───────────────────────────────────────────────────────── ortak parçalar
SIMGE = {'iyi': '●', 'izle': '▲', 'dikkat': '◆', 'sorun': '■'}
KADEME_AD = {'iyi': 'İyi', 'izle': 'İzle', 'dikkat': 'Dikkat', 'sorun': 'Sorun'}


def rozet(durum: str) -> str:
    return f'<span class="durum durum-{durum}"><i aria-hidden="true">{SIMGE[durum]}</i>{KADEME_AD[durum]}</span>'


def yas_rozeti(gun: int, kaynak: str) -> str:
    """Veri yaşı: eşik yok iddiası yok, yalnız yaş yazılır; ≥ 14 gün 'eski' tonlanır (ön değer)."""
    eski = ' yas-eski' if gun >= 14 else ''
    return f'<span class="yas{eski}" title="Veri yaşı"><i aria-hidden="true">◷</i>{kaynak} · {gun} gün önce</span>'


def kademe_seridi(durum: str) -> str:
    seg = ''.join(f'<li class="{"aktif" if k == durum else ""} k-{k}"><span class="kb"></span><span class="kt"><i aria-hidden="true">{SIMGE[k]}</i> {KADEME_AD[k]}</span></li>' for k in ('iyi', 'izle', 'dikkat', 'sorun'))
    return f'<ol class="kademe" aria-label="Durum kademesi: {KADEME_AD[durum]}">{seg}</ol>'


def akordeon(baslik: str, ozet: str, acik: bool = False, icerik: str = '') -> str:
    return (f'<details class="akordeon"{" open" if acik else ""}><summary><span class="ak-b">{baslik}</span><span class="ak-o">{ozet}</span><i class="ak-ok" aria-hidden="true">⌄</i></summary>{icerik}</details>')


def kaynak_cipi(s: str) -> str:
    return f'<p class="kaynak">{s}</p>'


def harita_ray(yon: str, katman: str, alt: str, tarih_s: str, yas: str, dar: bool, sw: str = 'bitki') -> str:
    """TEK kontrol rayı: katman · tarih · ⋯ (uzman kontrolleri: skala, eş-değer çizgisi, opaklık ⋯ altında)."""
    return (f'<div class="ray" role="toolbar" aria-label="Harita denetimleri">'
            f'<button class="ray-b ray-katman"><i class="ray-sw sw-{sw}" aria-hidden="true"></i><span><b>{katman}</b>{"" if dar else f"<em>{alt}</em>"}</span><i aria-hidden="true">⌄</i></button>'
            f'<span class="ray-ayrac"></span>'
            f'<span class="ray-tarih"><button aria-label="Önceki görüntü">‹</button><span><b>{tarih_s}</b>{"" if dar else f"<em>{yas}</em>"}</span><button aria-label="Sonraki görüntü" disabled>›</button></span>'
            f'<span class="ray-ayrac"></span>'
            f'<button class="ray-b ray-daha" aria-label="Diğer harita ayarları: skala, eş-değer çizgisi, opaklık">⋯</button></div>')


def lejant_mutlak(ad: str, alt: float, ust: float, ortanca: float, etiket_alt: str, etiket_ust: str, rampa: str) -> str:
    """Mutlak skala lejantı: tek satır; lejant paragrafı yok (ilke 4, 9)."""
    t = (ortanca - alt) / (ust - alt) * 100
    return (f'<div class="lejant" aria-label="{ad}, mutlak skala"><b>{ad}</b>'
            f'<div class="lj-bar" style="background:{rampa}"><i style="left:{t:.1f}%" title="ortanca"></i></div>'
            f'<div class="lj-uc"><span>{sayi(alt, 1) if alt else "0"} {etiket_alt}</span><span class="lj-ort">ortanca {sayi(ortanca)}</span><span>{etiket_ust} {sayi(ust, 1)}</span></div></div>')


RAMP_BITKI = 'linear-gradient(90deg,var(--bitki-1),var(--bitki-2),var(--bitki-3),var(--bitki-4),var(--bitki-5))'
RAMP_SU = 'linear-gradient(90deg,#eef3f7,#c9dcea,#8cb4d2,#4c7fa8,#1f4766)'


def not_kutusu(x: float, y: float, w: int, metin: str, ba: str, dx: float, dy: float, numara: str = '') -> str:
    """Kartografik not: bulgu, haritada ilgili bölgeye ince çizgiyle bağlı kısa not. (x,y) = hedef nokta; (dx,dy) = kutu sol-üst."""
    kx, ky = x + dx, y + dy
    bx, by = (kx if dx > 0 else kx + w), ky + 18
    return (f'<svg class="kn-hat" aria-hidden="true"><circle cx="{x:.1f}" cy="{y:.1f}" r="4.5" class="kn-nokta"/><path d="M{x:.1f},{y:.1f} L{bx:.1f},{by:.1f}" class="kn-cizgi"/></svg>'
            f'<div class="kn" style="left:{kx:.1f}px;top:{ky:.1f}px;width:{w}px">{f"<b>{ba}</b>" if ba else ""}<span>{metin}</span></div>')


# ───────────────────────────────────────────────────────── sayfa iskeleti
def ust_cubuk(dar: bool, aktif: str = 'Bahçeler', c: bool = False) -> str:
    nav = ''.join(f'<a class="{"aktif" if n == aktif else ""}{" yakinda" if n in ("İşlerim", "Hizmetler", "Pazar") else ""}">{n}</a>' for n in ('Bahçeler', 'Asistan', 'İşlerim', 'Hizmetler', 'Pazar'))
    if c:
        if dar:
            return ('<header class="ust"><span class="marka"><i class="marka-nokta"></i>BahçeLab</span><nav><a class="aktif">Bahçeler</a><a>Asistan</a></nav><span class="ust-sag"><button class="txt-btn">Ara</button><span class="avatar">TK</span></span></header>')
        return (f'<header class="ust"><span class="marka"><i class="marka-nokta"></i>BahçeLab</span><nav aria-label="Ana gezinme">{nav}</nav><button class="ara">Ara veya sor — “kuzey köşe nasıl?” <kbd>⌘K</kbd></button><span class="ust-sag"><button class="txt-btn" aria-label="Bildirimler: bahçe uyarısı yok, 3 sistem uyarısı">Bildirimler</button><span class="avatar">TK</span></span></header>')
    if dar:
        return ('<header class="ust"><span class="marka"><i class="marka-nokta"></i>BahçeLab</span><nav><a class="aktif">Bahçeler</a><a>Asistan</a></nav>'
                '<span class="ust-sag"><button class="ikon" aria-label="Ara">⌕</button><button class="ikon" aria-label="Bildirimler (bahçe uyarısı yok)">🔔︎</button></span></header>')
    return (f'<header class="ust"><span class="marka"><i class="marka-nokta"></i>BahçeLab</span><nav aria-label="Ana gezinme">{nav}</nav>'
            '<button class="ara"><span aria-hidden="true">⌕</span> Ara veya sor — “zayıf bölgeleri göster” <kbd>⌘K</kbd></button>'
            '<span class="ust-sag"><button class="ikon" aria-label="Bildirimler: bahçe uyarısı yok · 3 sistem uyarısı">🔔︎</button><button class="ikon" aria-label="Tema">◐</button><span class="avatar">TK</span></span></header>')


def baglam_cubugu(slug: str, aktif: str, dar: bool) -> str:
    g = GARDENS[BAHCELER[slug]]
    sek = ''.join(f'<a class="{"aktif" if s == aktif else ""}">{s}</a>' for s in ('Durum', 'Analiz', 'Su', 'Hava', 'Günlük', 'Rapor'))
    meta = f'Limon · {sayi(g["alanDekar"] if "alanDekar" in g else g["alan_dekar"], 1)} da · Erdemli, Mersin'
    if dar:
        return f'<div class="bag"><div class="bag-1"><b class="bahce-adi">{BAHCELER[slug]}</b><i aria-hidden="true">⌄</i><span class="bag-sag"><button class="btn">Saha Defteri ↗</button></span></div><nav class="sekmeler" role="tablist">{sek}</nav></div>'
    return f'<div class="bag"><b class="bahce-adi">{BAHCELER[slug]}</b><span class="meta">{meta}</span><i aria-hidden="true">⌄</i><nav class="sekmeler" role="tablist">{sek}</nav><span class="bag-sag"><button class="btn">Saha Defteri ↗</button></span></div>'


def sayfa(yon: str, govde: str, dar: bool, baslik: str, tema: str = 'acik') -> str:
    return (f'<!doctype html><html lang="tr" data-tema="{tema}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{baslik} · Yön {yon.upper()}</title><link rel="stylesheet" href="../tokens-{yon}.css"><link rel="stylesheet" href="../maket.css">{"<link rel=stylesheet href=../maket-c.css>" if yon == "c" else ""}</head>'
            f'<body class="yon-{yon} {"dar" if dar else "genis"}">{govde}</body></html>')


def harita_blok(yon: str, geo: dict, ray: str, lejant: str, notlar: str, dar: bool) -> str:
    v = geo
    img = f'../gorsel/{geo["ad"]}.jpg'
    atif = '<span class="atif">© Mapbox © OpenStreetMap © Maxar</span>'
    olcek = '<span class="olcek"><i></i><b>25 m</b></span>' if not dar else ''
    return (f'<section class="harita" aria-label="Harita"><div class="harita-ic"><img src="{img}" alt="Bahçenin uydu görüntüsü ve canlılık haritası" style="left:{v["ox"]:.1f}px;top:{v["oy"]:.1f}px;width:{v["w"]:.1f}px;height:{v["h"]:.1f}px">'
            f'{notlar}{ray}{lejant}{olcek}{atif}</div></section>')


# ───────────────────────────────────────────────────────── Yön C metin yardımcıları (ziraat mühendisi dili)
def eb(yon: str, metin: str) -> str:
    """Eyebrow: Yön C'de YOK (büyük harfli, harf aralıklı etiket yasak)."""
    return '' if yon == 'c' else f'<p class="eyebrow">{metin}</p>'


def risk_cumlesi(slug: str) -> str:
    """Durum API'sinin `riskler` listesinden kısa cümle: «Meyve sineği ve kuruma hastalığı riski orta.»"""
    adlar, seviyeler = [], set()
    for r in D[slug]['durum']['riskler']:
        ad, _, sev = r.partition(' · ')
        adlar.append(ad.split(' (')[0].replace('Akdeniz meyve sineği', 'Meyve sineği').replace('Kuruma hastalığı', 'kuruma hastalığı'))
        seviyeler.add(sev)
    if not adlar:
        return ''
    ad_s = ' ve '.join(adlar)
    return f'{ad_s} riski {next(iter(seviyeler)) if len(seviyeler) == 1 else "var"}.'


def konum_sayisi(slug: str) -> tuple[str, str]:
    """Büyük sayı: bandın içindeyse «Normal»; dışındaysa ortancaya göre sapma («−%8»). İkinci değer: küçük yazı."""
    k = K[slug]
    b = k['bant']
    if k['konum'] == 'içinde':
        return 'Normal', f'canlılık {sayi(k["ndvi"])} · bu ay genelde {sayi(b["p25"])}–{sayi(b["p75"])}'
    sap = (k['ndvi'] / b['p50'] - 1) * 100
    return f'{"+" if sap > 0 else "−"}%{abs(sap):.0f}'.replace('.', ','), f'canlılık {sayi(k["ndvi"])} · bu ay genelde {sayi(b["p25"])}–{sayi(b["p75"])}'


# ───────────────────────────────────────────────────────── EKRANLAR
def ekran_liste(yon: str, dar: bool) -> str:
    adlar = list(BAHCELER)
    harita_ad = 'harita-liste-dar' if dar else 'harita-liste-genis'
    CW, CH = (390, 300) if dar else (984, 844)
    geo, p = projeksiyon(harita_ad, CW, CH)
    notlar = ''
    for i, s in enumerate(adlar):
        g = GARDENS[BAHCELER[s]]
        ring = g['geometry']['coordinates'][0]
        cx = sum(q[0] for q in ring) / len(ring)
        cy = sum(q[1] for q in ring) / len(ring)
        x, y = p(cx, cy)
        k = K[s]
        if dar:
            continue
        notlar += not_kutusu(x, y, 188, (f'{sayi(g["alanDekar"] if "alanDekar" in g else g["alan_dekar"], 1)} da · {"normal" if k["konum"] == "içinde" else "normal değil"}' if yon == 'c' else f'{sayi(g["alanDekar"] if "alanDekar" in g else g["alan_dekar"], 1)} da · canlılık {sayi(k["ndvi"])} · normal bantın {k["konum"]}'), BAHCELER[s], 70 if i == 0 else -270, -64 if i == 0 else -40)
    ray = harita_ray(yon, 'Canlılık', 'Sentinel-2 · 10 m', tarih(K['jlnnlk']['tarih']), f'{K["jlnnlk"]["yas"]} gün önce', dar)
    harita = harita_blok(yon, geo, ray, lejant_mutlak('Canlılık' if yon == 'c' else 'Canlılık (NDVI)', 0, .9, K['jlnnlk']['ndvi'], '', '', RAMP_BITKI) if not dar else '', notlar, dar)
    satirlar = ''
    for s in adlar:
        g = GARDENS[BAHCELER[s]]
        k = K[s]
        o = OVERVIEW[BAHCELER[s]]
        degisim = (k['ndvi'] - k['onceki']['deger']) if k['onceki'] else None
        deg_s = (('<span class="fark">değişmedi <em>30 günde</em></span>' if abs(degisim) < .005 else f'<span class="fark">{"+" if degisim >= 0 else "−"}{sayi(abs(degisim))} <em>30 günde</em></span>') if degisim is not None else '<span class="fark"><em>30 gün önceki sahne yok</em></span>')
        satirlar += (f'<li class="satir"><div class="s-baslik"><b>{BAHCELER[s]}</b>{rozet(D[s]["durum"]["durum"])}</div>'
                     f'<div class="s-meta">Limon · {sayi(g["alanDekar"] if "alanDekar" in g else g["alan_dekar"], 1)} da · {o["ilce"]}, {o["il"]}</div>'
                     + (f'<div class="s-govde"><div class="s-sayi"><span class="sayi-k">{konum_sayisi(s)[0]}</span><span class="alt">{konum_sayisi(s)[1]}</span>{deg_s}</div>{spark(s, 112 if dar else 132, 38)}</div>' if yon == 'c' else f'<div class="s-govde"><div class="s-sayi"><span class="sayi-k">{sayi(k["ndvi"])}</span><span class="alt">canlılık · normal bantın <b>{k["konum"]}</b> ({sayi(k["bant"]["p25"])}–{sayi(k["bant"]["p75"])})</span>{deg_s}</div>{spark(s, 112 if dar else 132, 38)}</div>')
                     + f'<div class="s-alt">{yas_rozeti(k["yas"], "Sentinel-2")}<span class="bayat" title="Bu bileşenlerde veri eski">{"veri eski" if yon == "c" else "bayat"}: {", ".join(k["bayat"]).lower()}</span><span class="hava">{sayi(o["hava"]["sicaklik"], 1)} °C · {o["hava"]["aciklama"].lower()}</span></div></li>')
    izle = sum(1 for s in adlar if D[s]['durum']['durum'] == 'izle')
    icinde = sum(1 for s in adlar if K[s]['konum'] == 'içinde')
    SAYI = {1: 'Bir', 2: 'İki', 3: 'Üç', 4: 'Dört'}
    karar = (f'{SAYI[len(adlar)]} bahçe de izlemede; canlılık {"ikisinde" if len(adlar) == 2 else "hepsinde"} de normal bandın içinde.' if izle == len(adlar) == icinde
             else f'{izle} bahçe izlemede; {icinde} bahçenin canlılığı normal bandın içinde.')
    toplam = sayi(sum((GARDENS[BAHCELER[s]].get('alanDekar') or GARDENS[BAHCELER[s]].get('alan_dekar')) for s in adlar), 1)
    if yon == 'c':
        karar = (f'{SAYI[len(adlar)]} bahçe de normal.' if icinde == len(adlar) else f'{icinde} bahçe normal, {len(adlar) - icinde} bahçe değil.')
    panel = (f'<aside class="panel"><div class="p-bas">{eb(yon, f"Bahçeler · {len(adlar)} bahçe · {toplam} da")}<h1 class="karar">{karar}</h1>'
             + (f'<p class="karar-alt">İkisi de izlemede, ani değişim yok. Ağaç gücü, beslenme ve ısı verisi eski.</p></div>' if yon == 'c' else f'<p class="karar-alt">Önce bakılacak olan <b>yok</b>: ikisinde de ani değişim görülmedi; üç bileşende (ağaç gücü, beslenme, ısı) veri bayat.</p></div>')
             + f'<ul class="liste">{satirlar}</ul><div class="p-alt"><button class="btn btn-birincil">+ Bahçe ekle</button></div></aside>')
    govde = ust_cubuk(dar, c=(yon == 'c')) + (f'<main class="calisma"><div class="kolon">{harita}{panel}</div></main>' if not dar else f'<main class="calisma">{harita}{panel}</main>')
    return sayfa(yon, govde, dar, 'Bahçeler listesi')


def ekran_durum(yon: str, dar: bool) -> str:
    s = 'jlnnlk'
    k = K[s]
    d = D[s]
    ad = 'harita-jlnnlk-canlilik-dar' if dar else 'harita-jlnnlk-canlilik-genis'
    geo, p = projeksiyon(ad, *((390, 300) if dar else (984, 792)))
    cy = d['cy']
    ozet = {o['sinif']: o for o in cy['ozet']}
    zx, zy = bolge_noktasi(s, 1, p)
    gx, gy = bolge_noktasi(s, 3, p)
    notlar = ''
    if not dar:
        if yon == 'c':
            notlar += not_kutusu(zx, zy, 230, f'{sayi(ozet[1]["alan_dekar"], 1)} da, yıllardır normalin %{sayi(abs(ozet[1]["fark_yuzde"]), 1)} altında', 'zayıf kesim', -262, -62)
            notlar += not_kutusu(gx, gy, 230, f'{sayi(ozet[3]["alan_dekar"], 1)} da, yıllardır normalin %{sayi(ozet[3]["fark_yuzde"], 1)} üstünde', 'güçlü kesim', 40, 46)
        else:
            notlar += not_kutusu(zx, zy, 214, f'{sayi(ozet[1]["alan_dekar"], 1)} da · bahçenin %{round(ozet[1]["pay"] * 100)}’i · yıllardır normalin %{sayi(abs(ozet[1]["fark_yuzde"]), 1)} altında', 'Zayıf kesim', -250, -70)
            notlar += not_kutusu(gx, gy, 214, f'{sayi(ozet[3]["alan_dekar"], 1)} da · yıllardır normalin %{sayi(ozet[3]["fark_yuzde"], 1)} üstünde · istikrar yüksek', 'Güçlü kesim (güneydoğu)', 40, 50)
    else:
        notlar += not_kutusu(zx, zy, 150, f'{sayi(ozet[1]["alan_dekar"], 1)} da, yıllardır normalin %{sayi(abs(ozet[1]["fark_yuzde"]), 1)} altında', 'zayıf kesim' if yon == 'c' else 'Zayıf kesim', 36, -34)
    ray = harita_ray(yon, 'Canlılık', 'Sentinel-2 · 10 m', tarih(k['tarih']), f'{k["yas"]} gün önce', dar)
    harita = harita_blok(yon, geo, ray, lejant_mutlak('Canlılık' if yon == 'c' else 'Canlılık (NDVI)', 0, .9, k['ndvi'], '', '', RAMP_BITKI), notlar, dar)
    risk = next(b for b in d['durum']['bilesenler'] if b['kod'] == 'risk') if any(b['kod'] == 'risk' for b in d['durum']['bilesenler']) else None
    maddeler = d['bugun']['maddeler']
    risk_metin = ' · '.join(f'{m["baslik"]}' for m in maddeler if m['tur'] == 'zararli_riski')
    assert d['durum']['risk_sinirladi'] and d['durum']['durum'] == 'izle'  # karar cümlesi API'nin kararından türetilir
    karar = f'İzle: canlılık normal bandın {k["konum"]}; aktif risk kademeyi sınırlıyor.'
    if yon == 'c':
        karar = {'içinde': 'Bahçe bu mevsim için normal.', 'altında': 'Bahçe bu mevsim için normalin altında.', 'üstünde': 'Bahçe bu mevsim için normalin üstünde.'}[k['konum']]
    grafik = sezon_grafik(s, 416 if not dar else 358, 252 if not dar else 214, sade=(yon == 'c'))
    bil = ''.join(f'<li><span>{b["ad"]}</span><em class="{"bayat" if b["bayat"] else ""}">{"veri bayat" if b["bayat"] else b["neden"].rstrip(".")}</em></li>' for b in d['durum']['bilesenler'])
    if yon == 'c':
        sy, sy_alt = konum_sayisi(s)
        rc = risk_cumlesi(s)
        izle_cumle = f'İzlemede: {rc[0].lower() + rc[1:]}'
        sayi_html = (f'<p class="karar-alt">{izle_cumle}</p><div class="sayi-blok"><span class="sayi">{sy}</span><div class="sayi-yan"><b>normale göre</b><span>{sy_alt}</span>{yas_rozeti(k["yas"], "Sentinel-2")}</div></div>')
    else:
        sayi_html = (f'<div class="sayi-blok"><span class="sayi">{sayi(k["ndvi"])}</span><div class="sayi-yan"><b>canlılık (NDVI)</b><span>bu ayın normal bandı {sayi(k["bant"]["p25"])}–{sayi(k["bant"]["p75"])}</span>{yas_rozeti(k["yas"], "Sentinel-2")}</div></div>')
    guven_t = d["durum"]["guven_nedeni"].replace("Ağaç gücü: veri bayat; Beslenme: veri bayat; Isı: veri bayat.", "ağaç gücü, beslenme ve ısı verisi " + ("eski" if yon == "c" else "bayat"))
    guven_s = dict(dusuk='düşük', orta='orta', yuksek='yüksek').get(d['durum']['guven'], d['durum']['guven'])
    g_baslik = 'Bu yıl, önceki yıllara göre' if yon == 'c' else 'Bu yıl, bahçenin kendi geçmişine göre'
    panel = (f'<aside class="panel"><section class="karar-kart">{eb(yon, f"Durum · {BAHCELER[s]}")}<h1 class="karar">{karar}</h1>'
             f'{sayi_html}'
             f'{kademe_seridi(d["durum"]["durum"])}<p class="guven"><b>Güven {guven_s}</b> · {guven_t}</p></section>'
             f'<section class="kanit"><h2 class="g-baslik">{g_baslik}</h2>{grafik}</section>'
             f'<div class="akordeonlar">{akordeon("Bileşenler", "3 bileşende veri " + ("eski" if yon == "c" else "bayat"), False, f"<ul class=bilesen>{bil}</ul>")}{akordeon("Bugün", f"{len(maddeler)} madde: " + risk_metin.lower(), False)}{akordeon("Nasıl hesaplandı?", "ön değer · mühendis onayı bekliyor", False)}</div></aside>')
    govde = ust_cubuk(dar, c=(yon == 'c')) + baglam_cubugu(s, 'Durum', dar) + (f'<main class="calisma"><div class="kolon">{harita}{panel}</div></main>' if not dar else f'<main class="calisma">{harita}{panel}</main>')
    return sayfa(yon, govde, dar, 'Bahçe · Durum')


def ekran_su(yon: str, dar: bool) -> str:
    s = 'jlnnlk'
    d = D[s]
    su = d['su']
    ad = 'harita-jlnnlk-yaprakSuyu-dar' if dar else 'harita-jlnnlk-yaprakSuyu-genis'
    geo, p = projeksiyon(ad, *((390, 300) if dar else (984, 792)))
    g = GARDENS[BAHCELER[s]]
    ring = g['geometry']['coordinates'][0]
    x, y = p(sum(q[0] for q in ring) / len(ring), sum(q[1] for q in ring) / len(ring))
    ayni = su['profil']['katmanlar'] == D['soguk-hava']['su']['profil']['katmanlar']
    notlar = ''
    if ayni and not dar:
        if yon == 'c':
            notlar += not_kutusu(x, y, 236, 'soğuk hava ile aynı hava verisi kullanılıyor (aynı 9 km hücre)', '', 40, -96)
        else:
            notlar += not_kutusu(x, y, 226, 'Toprak nemi, yağış ve sıcaklık verisi soğuk hava ile birebir aynı (aynı 9 km ERA5 hücresi).', 'Aynı hava hücresi', 40, -120)
    ndmi = D[s]['ed']['edinimler'][-1]['gostergeler']['ndmi']['medyan']
    ray = harita_ray(yon, 'Yaprak suyu', 'Sentinel-2 · 20 m', tarih(K[s]['tarih']), f'{K[s]["yas"]} gün önce', dar, 'su')
    harita = harita_blok(yon, geo, ray, lejant_mutlak('Yaprak suyu' if yon == 'c' else 'Yaprak suyu (NDMI)', 0, .6, ndmi, '', '', RAMP_SU), notlar, dar)
    doluluk = su['profil']['kok_bolgesi_doluluk']
    sinif = su['profil']['kok_bolgesi_sinif']
    kd = su['karar_detay']['durum']
    karar_su = su['karar']
    if yon == 'c':
        assert kd in ('gerekmiyor', 'sulama', 'izle', 'veri_yok')  # kısa cümle API kararından türetilir
        toprak = {'nemli': 'Toprak nemli', 'orta': 'Toprak nemi orta', 'kuru': 'Toprak kuru'}[sinif]
        son = {'gerekmiyor': 'bu hafta sulama gerekmiyor', 'sulama': 'sulama zamanı geldi', 'izle': 'sulamayı yakından izleyin', 'veri_yok': 'veri yetersiz'}[kd]
        karar_su = f'{toprak}, {son}.'
    g_su = 'Yağış ve bitki tüketimi: son 30 gün, önümüzdeki 7 gün' if yon == 'c' else 'Son 30 gün ve önümüzdeki 7 gün: yağış ile ETc'
    panel = (f'<aside class="panel"><section class="karar-kart">{eb(yon, f"Su · {BAHCELER[s]}")}<h1 class="karar">{karar_su}</h1>'
             f'<div class="sayi-blok"><span class="sayi">%{round(doluluk)}</span><div class="sayi-yan"><b>{"kök bölgesi doluluğu" if yon != "c" else "kök bölgesi doluluğu"}</b><span>{su["profil"]["donem"]} normaline göre{"" if yon == "c" else " · 2015–2025"}</span><span class="yas"><i aria-hidden="true">◷</i>ERA5-Land · 9 km · {(str(gun_once(su["profil"]["bugun_tarihi"])) + " gün önce") if gun_once(su["profil"]["bugun_tarihi"]) else "bugün"}</span></div></div></section>'
             f'<section class="kanit"><h2 class="g-baslik">{g_su}</h2>{su_paneller(416 if not dar else 358, yon == 'c')}</section>'
             f'<div class="akordeonlar">{akordeon("Toprak nem profili", "4 derinlikte bugün · bahçenin normal aralığı")}{akordeon("Yüzey–hava sıcaklığı", f"Eylül normaline göre +{sayi(su["sicaklik"]["noktalar"][-1]["sapma_c"], 1)} °C · 25 Eyl Landsat")}{akordeon("Nasıl hesaplandı?", "ön değer · mühendis onayı bekliyor")}</div></aside>')
    govde = ust_cubuk(dar, c=(yon == 'c')) + baglam_cubugu(s, 'Su', dar) + (f'<main class="calisma"><div class="kolon">{harita}{panel}</div></main>' if not dar else f'<main class="calisma">{harita}{panel}</main>')
    return sayfa(yon, govde, dar, 'Bahçe · Su')


def ekran_gecmis(yon: str, dar: bool) -> str:
    s = 'jlnnlk'
    d = D[s]
    k = K[s]
    # karar cümlesi: 2026 gözlemlerinin (S2+HLS) aylık normal bandına göre konumu
    ay_band = {b['ay']: b for b in d['bant']['gostergeler']['ndvi']}
    # Normal bant Sentinel-2'den kurulur; kıyas AYNI kaynakla yapılır (HLS 30 m gözlemler grafikte ayrıca çizilir, sayıma girmez)
    goz = [g for g in d['egri']['gozlemler'] if g['tarih'].startswith('2026') and g['kaynak'] == 's2']
    ic = sum(1 for g in goz if ay_band[int(g['tarih'][5:7])]['p25'] <= g['deger'] <= ay_band[int(g['tarih'][5:7])]['p75'])
    alt_ = sum(1 for g in goz if g['deger'] < ay_band[int(g['tarih'][5:7])]['p25'])
    ust_ = len(goz) - ic - alt_
    n_s2 = len(goz)
    if ic / n_s2 >= .5:
        karar = 'Bu sezon canlılık çoğunlukla normal bandın içinde seyretti.'
    elif ust_ / n_s2 >= .5:
        karar = 'Bu sezon canlılık çoğunlukla normal bandın üstünde seyretti.'
    elif alt_ / n_s2 >= .5:
        karar = 'Bu sezon canlılık çoğunlukla normal bandın altında kaldı.'
    elif alt_ / n_s2 <= .15:
        karar = f'Bu sezon canlılık normal bandın içinde ya da üstünde seyretti; altına yalnız {alt_} görüntüde indi.'
    else:
        karar = 'Bu sezon canlılık normal bandın içinde, altında ve üstünde karışık seyretti.'
    if yon == 'c':
        karar = ('Bu sezon normal ya da normalin üstünde.' if alt_ / n_s2 <= .15 and ust_ > 0 else 'Bu sezon normal.' if ic / n_s2 >= .5 else 'Bu sezon normalin altında kaldı.' if alt_ / n_s2 >= .5 else 'Bu sezon değişken.')
    yillar = {y['yil']: y for y in d['go']['yillar']}
    cy = {y['yil']: y for y in d['cy']['yillar']}
    grafik = sezon_grafik(s, (1120 if yon in 'bc' else 1160) if not dar else 358, 214 if not dar else 220, True, sade=(yon == 'c'))
    kutular = ''
    for yil in range(2015, 2027):
        g = yillar[yil]
        uyumsuz = bool(cy.get(yil, {}).get('uyumsuz'))
        yeterli = g['canlilik'] is not None or yil == 2026
        med = YAZ['jlnnlk'][str(yil)]['ortanca']
        if yeterli:
            ic_ = f'<img src="../gorsel/yaz-jlnnlk-{yil}.png" alt="{yil} yaz canlılık haritası">'
            alt = f'<b>{yil}</b><span>{sayi(med)}</span>'
        else:
            ic_ = '<div class="yaz-yok" aria-label="yetersiz veri"></div>'
            alt = f'<b>{yil}</b><span>yetersiz</span>'
        kutular += f'<li class="yaz{" uyumsuz" if uyumsuz else ""}"><div class="yaz-resim">{ic_}</div><div class="yaz-et">{alt}{"<em>uyumsuz</em>" if uyumsuz else ""}</div></li>'
    olay_toplam = sum(y['olay_sayisi'] for y in d['go']['yillar'])
    sayi_blok = (f'<div class="sayi-blok"><span class="sayi">{ic}<small>/{len(goz)}</small></span><div class="sayi-yan"><b>Sentinel-2 görüntüsü normal bantta</b>'
                 f'<span>2026 · {alt_} tanesi bandın altında, {ust_} tanesi üstünde</span></div></div>')
    if yon == 'c':
        sayi_blok = (f'<div class="sayi-blok"><span class="sayi">{ic + ust_}<small>/{n_s2}</small></span><div class="sayi-yan"><b>görüntü normal ya da üstünde</b>'
                     f'<span>2026 uydu görüntüleri · {alt_} tanesi normalin altında</span></div></div>')
    kapsam = f'{d["go"]["ilk_yil"]}–{d["go"]["son_yil"]}'
    govde = (ust_cubuk(dar, c=(yon == 'c')) + baglam_cubugu(s, 'Durum', dar) +
             f'<main class="sayfa-tam"><a class="geri">← Çalışma alanı</a><section class="karar-kart genis-kart">{eb(yon, f"Geçmiş · {kapsam} · {BAHCELER[s]}")}<h1 class="karar">{karar}</h1>{sayi_blok}</section>'
             f'<section class="kanit"><h2 class="g-baslik">{"Bu yıl, önceki yıllara göre" if yon == "c" else f"Bu yıl, önceki {ay_band[10]['yil_sayisi']} sezonun normal bandıyla"}</h2>{grafik}</section>'
             f'<section class="kanit"><h2 class="g-baslik">Aynı bahçe, 12 yaz <span class="g-alt">hepsi aynı skalada · haziran–eylül ortancası</span></h2>'
             f'<ul class="yaz-izgara">{kutular}</ul>'
             f'<div class="yaz-lejant"><span>0</span><div class="lj-bar" style="background:{RAMP_BITKI}"></div><span>0,9</span><em>Bir yaza dokunun: harita o yazı açar.</em></div></section>'
             f'<div class="akordeonlar">{akordeon("Olaylar", f"{olay_toplam} olay · {kapsam}")}{akordeon("Yıl yıl özet", "yaz canlılığı diğer yıllara göre, olay sayısı, hasat kaydı")}</div></main>')
    return sayfa(yon, govde, dar, 'Geçmiş')


EKRANLAR = {'liste': ekran_liste, 'durum': ekran_durum, 'su': ekran_su, 'gecmis': ekran_gecmis}

if __name__ == '__main__':
    for yon in ('a', 'b', 'c'):
        (KOK / f'yon-{yon}').mkdir(exist_ok=True)
        for ad, fn in EKRANLAR.items():
            for dar in (False, True):
                (KOK / f'yon-{yon}' / f'{ad}-{"390" if dar else "1440"}.html').write_text(fn(yon, dar), encoding='utf8')
    print('maketler üretildi')
