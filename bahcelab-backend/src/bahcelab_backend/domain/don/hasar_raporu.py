"""Don SONRASI hasar raporu (PDF taslağı): hava kanıtı + Sentinel-2 önce/sonra + çiftçi fotoğrafları/notu + olay etiketi. «TARSİM başvurusuna yardımcı taslak — resmi ekspertiz değildir».
Veri toplama (`topla`, DB) ve çizim (`pdf_olustur`, saf) ayrıdır; hiçbir değer uydurulmaz: yoksa «yok» ve nedeni yazılır."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.agro.simulation import stage_on
from bahcelab_backend.domain.don import olay_yd, risk, topografya
from bahcelab_backend.domain.evidence import service as ev_service
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import StorageBackend

FONT = Path(__file__).parent / "fonts"
BASLIK = "Don hasarı raporu"
ALT_BASLIK = "TARSİM başvurusuna yardımcı taslak — resmi ekspertiz değildir"
UYARI = (
    "Bu belge BahçeLab'ın topladığı verilerden otomatik hazırlanmış bir TASLAKTIR. Resmi ekspertiz ya da hasar tespit tutanağı değildir; TARSİM/sigorta şirketinin ekspertiz sürecinin yerini tutmaz. "
    "Hasar tutarı veya hasar oranı içermez. Sayılar model/uydu/istasyon kaynaklarından gelir ve kaynakları her bölümde yazılıdır; model değerleri bahçedeki gerçek sıcaklık olmayabilir."
)
ETIKET_AD = {
    "istasyon_destekliyor": "İstasyon destekliyor (bağımsız istasyon ≤ 0 °C ölçtü)",
    "dis_kayit_destekliyor": "Kamu kaydı destekliyor (istasyon > 0 °C ölçse de resmi/haber kaydı don bildiriyor)",
    "model_sapmasi_olasi": "Model sapması olası (istasyon > 0 °C ölçtü, kamu kaydı yok; olay model artefaktı OLABİLİR — kanıtlanmış değil)",
    "belirsiz": "Belirsiz (istasyon > 0 °C ama model istasyona yakın)",
    "kanit_yok": "Kanıt yok (pencerede istasyon gözlemi ve kamu kaydı yok)",
}


async def topla(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID, olay_id: uuid.UUID) -> dict[str, Any]:
    k = load_catalog().don
    ev = (await session.execute(text("SELECT id, anahtar, tur, turler, baslangic, bitis, siddet, guven, ayrinti FROM events WHERE id = :e AND garden_id = :g"), {"e": olay_id, "g": garden_id})).first()
    if ev is None:
        raise AppError(404, AppErrorCode.NOT_FOUND, "Olay bulunamadı.")
    if ev[2] != "don" and "don" not in (ev[3] or []):
        raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Hasar raporu yalnız don olayları için hazırlanır.")
    anahtar, bas, bit, ayr = ev[1], ev[4], ev[5], ev[8] or {}
    g = (await session.execute(text("SELECT ad, il, ilce, urun, cesit, cesit_kodu, alan_dekar, agac_sayisi, dikim_yili, ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).one()
    topo = (await session.execute(text("SELECT profil FROM bahce_topografya WHERE garden_id = :g"), {"g": garden_id})).scalar()
    # olay etiketi (yeniden değerlendirme; yoksa hesapla — silmez/değiştirmez)
    et = (await olay_yd.etiketler(session, garden_id)).get(anahtar)
    if et is None:
        await olay_yd.yeniden_degerlendir(session, garden_id, k)
        et = (await olay_yd.etiketler(session, garden_id)).get(anahtar)
    ctx = await ev_service.load_context(session, garden_id)
    onyargi = ev_service.prior_of(ctx, "don", bas, bit)
    kanitlar = [{"kaynak": x.kaynak, "yon": x.yon, "metin": x.metin, "baglanti": x.baglanti} for x in onyargi.kanitlar]
    # hava kanıtı: ERA5 saatlik (model) pencere ±1 gün
    cell, _, _ = await garden_cell(session, garden_id)
    gunler = (await session.execute(text("SELECT tarih, saatlik->'t2m', hava_kaynak FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :a AND :b AND saatlik IS NOT NULL ORDER BY tarih"), {"c": cell, "a": bas - timedelta(days=1), "b": bit + timedelta(days=1)})).all()
    saatlik = []
    gunluk = []
    for tarih, t2m, kaynak in gunler:
        vals = [(h, v) for h, v in enumerate(t2m or []) if v is not None]
        for h, v in vals:
            saatlik.append((datetime(tarih.year, tarih.month, tarih.day, h), float(v)))
        if vals:
            h, v = min(vals, key=lambda x: x[1])
            gunluk.append({"tarih": tarih, "min_c": round(float(v), 1), "saat": h, "kaynak": "ERA5 yeniden analiz" if kaynak != "model" else "model tahmini"})
    ist = []
    for d in ctx.days:
        st = ctx.stations.get(d.istasyon_id)
        if st is not None and d.kaynak == "gozlem" and d.tmin is not None and bas - timedelta(days=1) <= d.tarih <= bit + timedelta(days=1):
            ist.append({"istasyon": st.ad, "mesafe_km": st.mesafe_km, "tarih": d.tarih, "tmin_c": d.tmin, "baglanti": st.baglanti})
    evre, _ = stage_on(g[3], g[5], bas)
    kr = risk.kritik_sicaklik(evre, k)
    # Sentinel-2 önce/sonra
    s2 = await _s2(session, garden_id, bas, bit, load_catalog().olay.don_hasar_gun)
    # çiftçi kayıtları ve fotoğrafları
    pencere_bit = bit + timedelta(days=load_catalog().olay.don_hasar_gun)
    kayitlar = (await session.execute(text("SELECT r.id, r.tur, r.tarih, r.aciklama FROM field_records r WHERE r.garden_id = :g AND r.tarih BETWEEN :a AND :b ORDER BY r.tarih, r.created_at"), {"g": garden_id, "a": bas - timedelta(days=1), "b": pencere_bit})).all()
    fotolar = (await session.execute(text("SELECT p.id, p.dosya_yolu, r.tarih, r.aciklama FROM field_photos p JOIN field_records r ON r.id = p.record_id WHERE p.garden_id = :g AND r.tarih BETWEEN :a AND :b ORDER BY r.tarih, p.created_at LIMIT 8"), {"g": garden_id, "a": bas - timedelta(days=1), "b": pencere_bit})).all()
    foto_veri = []
    for _, yol, tarih, acik in fotolar:
        if storage.exists(yol):
            foto_veri.append({"tarih": tarih, "aciklama": acik, "bayt": storage.read(yol)})
    return {
        "bahce": {"ad": g[0], "il": g[1], "ilce": g[2], "urun": g[3], "cesit": g[4], "alan_dekar": float(g[6]), "agac_sayisi": g[7], "dikim_yili": g[8], "lat": float(g[9]), "lng": float(g[10]),
                  "arazi": topografya.konum_sinifi(topo, k)["cumle"] if topo else None},
        "olay": {"anahtar": anahtar, "baslangic": bas, "bitis": bit, "siddet": ev[6], "guven": ev[7], "model_en_dusuk_c": ayr.get("don.en_dusuk_c"), "turler": list(ev[3] or []), "s2_delta_ndvi": ayr.get("s2_dusus.delta_ndvi"), "s2_dusen_pay": ayr.get("s2_dusus.dusen_pay")},
        "etiket": None if et is None else {"sonuc": et["sonuc"], "ad": ETIKET_AD.get(et["sonuc"], et["sonuc"]), "aciklama": et["aciklama"], "model_en_dusuk_c": et["model_en_dusuk_c"], "istasyon_en_dusuk_c": et["istasyon_en_dusuk_c"]},
        "kanitlar": kanitlar, "kanit_yok_nedeni": onyargi.neden,
        "hava": {"gunluk": gunluk, "saatlik": saatlik, "istasyon": ist, "evre": evre, "kritik_c": kr[0] if kr else None, "organlar": [risk.ORGAN_AD.get(o, o) for o in kr[1]] if kr else []},
        "s2": s2,
        "kayitlar": [{"tur": r[1], "tarih": r[2], "aciklama": r[3]} for r in kayitlar],
        "fotograflar": foto_veri,
        "uretildi": datetime.now(UTC),
    }


async def _s2(session: AsyncSession, garden_id: uuid.UUID, bas: date, bit: date, hasar_gun: int) -> dict[str, Any]:
    q = ("SELECT a.tarih, a.scene_id, a.gecerli_oran, max(s.ortalama) FILTER (WHERE s.indeks = 'ndvi'), max(s.ortalama) FILTER (WHERE s.indeks = 'ndre') FROM acquisitions a "
         "JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.garden_id = :g AND a.source_id = 'sentinel2-l2a' AND a.durum = 'net' AND {c} GROUP BY a.tarih, a.scene_id, a.gecerli_oran ORDER BY a.tarih {o} LIMIT 1")
    once = (await session.execute(text(q.format(c="a.tarih < :b", o="DESC")), {"g": garden_id, "b": bas})).first()
    sonra = (await session.execute(text(q.format(c="a.tarih > :e AND a.tarih <= :u", o="ASC")), {"g": garden_id, "e": bit, "u": bit + timedelta(days=hasar_gun * 3)})).first()
    out: dict[str, Any] = {"once": None, "sonra": None, "bulutlu_arada": 0, "neden": None}
    if once:
        out["once"] = {"tarih": once[0], "ndvi": once[3], "ndre": once[4]}
    if sonra:
        out["sonra"] = {"tarih": sonra[0], "ndvi": sonra[3], "ndre": sonra[4]}
    if once and sonra:
        out["bulutlu_arada"] = int((await session.execute(text("SELECT count(*) FROM acquisitions WHERE garden_id = :g AND source_id = 'sentinel2-l2a' AND durum = 'bulutlu' AND tarih BETWEEN :a AND :b"), {"g": garden_id, "a": once[0], "b": sonra[0]})).scalar() or 0)
        out["delta_ndvi"] = None if once[3] is None or sonra[3] is None else round(float(sonra[3]) - float(once[3]), 3)
        out["delta_ndre"] = None if once[4] is None or sonra[4] is None else round(float(sonra[4]) - float(once[4]), 3)
    else:
        out["neden"] = ("olaydan önce net Sentinel-2 görüntüsü yok" if not once else "olaydan sonraki " + str(hasar_gun * 3) + " günde net Sentinel-2 görüntüsü yok (bulutlu olabilir)")
    return out


# ------------------------------------------------------------------ çizim
def _grafik(saatlik: list[tuple[datetime, float]], kritik: float | None) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    w, h, ml, mb, mt = 1100, 330, 60, 40, 18
    im = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(str(FONT / "DejaVuSans.ttf"), 14)
    ts = [t for t, _ in saatlik]
    vs = [v for _, v in saatlik]
    lo, hi = min([*vs, kritik if kritik is not None else min(vs)]) - 1, max(vs) + 1
    x0, x1 = ts[0].timestamp(), ts[-1].timestamp()
    X = lambda t: ml + (t.timestamp() - x0) / max(x1 - x0, 1) * (w - ml - 15)  # noqa: E731
    Y = lambda v: mt + (hi - v) / max(hi - lo, 1e-6) * (h - mt - mb)  # noqa: E731
    adim = max(1, round((hi - lo) / 6))
    for v in range(int(lo) - 1, int(hi) + 2):
        if lo <= v <= hi and v % adim == 0:
            d.line([(ml, Y(v)), (w - 15, Y(v))], fill=(225, 225, 225))
            d.text((8, Y(v) - 8), f"{v}", fill=(60, 60, 60), font=f)
    if lo <= 0 <= hi:
        d.line([(ml, Y(0)), (w - 15, Y(0))], fill=(120, 120, 120), width=2)
    if kritik is not None:
        for xx in range(ml, w - 15, 14):
            d.line([(xx, Y(kritik)), (xx + 7, Y(kritik))], fill=(190, 40, 40), width=2)
        d.text((ml + 6, Y(kritik) - 20), f"kritik {kritik:.1f} °C", fill=(190, 40, 40), font=f)
    d.line([(X(t), Y(v)) for t, v in saatlik], fill=(30, 90, 170), width=3)
    gun = None
    for t in ts:
        if t.date() != gun and t.hour == 0:
            gun = t.date()
            d.line([(X(t), h - mb), (X(t), h - mb + 6)], fill=(60, 60, 60))
            d.text((X(t) + 3, h - mb + 8), f"{t.day:02d}.{t.month:02d}", fill=(60, 60, 60), font=f)
    d.text((ml, 2), "°C (ERA5 yeniden analiz, saatlik)", fill=(60, 60, 60), font=f)
    b = io.BytesIO()
    im.save(b, format="PNG")
    return b.getvalue()


def _s2_grafik(s2: dict[str, Any]) -> bytes | None:
    from PIL import Image, ImageDraw, ImageFont

    if not (s2.get("once") and s2.get("sonra")) or s2["once"]["ndvi"] is None or s2["sonra"]["ndvi"] is None:
        return None
    w, h = 520, 220
    im = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(str(FONT / "DejaVuSans.ttf"), 14)
    for i, (ad, v, renk) in enumerate((("Önce " + f"{s2['once']['tarih']:%d.%m.%Y}", s2["once"]["ndvi"], (60, 140, 70)), ("Sonra " + f"{s2['sonra']['tarih']:%d.%m.%Y}", s2["sonra"]["ndvi"], (200, 120, 40)))):
        x = 60 + i * 200
        bh = int(max(v, 0) / 1.0 * 150)
        d.rectangle([x, 180 - bh, x + 120, 180], fill=renk)
        d.text((x, 186), ad, fill=(40, 40, 40), font=f)
        d.text((x + 30, 180 - bh - 20), f"NDVI {v:.2f}".replace(".", ","), fill=(40, 40, 40), font=f)
    d.line([(40, 180), (w - 10, 180)], fill=(120, 120, 120))
    b = io.BytesIO()
    im.save(b, format="PNG")
    return b.getvalue()


def _f(x: float | None, n: int = 1) -> str:
    return "—" if x is None else f"{x:.{n}f}".replace(".", ",")


def pdf_olustur(v: dict[str, Any]) -> bytes:
    from fpdf import FPDF
    from PIL import Image

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(True, 16)
    pdf.add_font("DejaVu", "", str(FONT / "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", "B", str(FONT / "DejaVuSans-Bold.ttf"))
    pdf.set_title(f"{BASLIK} — {v['bahce']['ad']}")
    pdf.set_author("BahçeLab")
    pdf.add_page()

    def h1(t: str) -> None:
        pdf.set_font("DejaVu", "B", 13)
        pdf.ln(3)
        pdf.cell(0, 8, t, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("DejaVu", "", 10)

    def p(t: str, size: int = 10, bold: bool = False) -> None:
        pdf.set_font("DejaVu", "B" if bold else "", size)
        pdf.multi_cell(0, 5.2, t, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("DejaVu", "", 10)

    pdf.set_font("DejaVu", "B", 18)
    pdf.cell(0, 10, BASLIK, new_x="LMARGIN", new_y="NEXT")
    pdf.set_fill_color(255, 240, 200)
    pdf.set_font("DejaVu", "B", 11)
    pdf.multi_cell(0, 7, ALT_BASLIK, fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    p(UYARI, 9)
    b, o = v["bahce"], v["olay"]
    h1("1. Bahçe")
    p(f"{b['ad']} — {b['il'] or ''} {b['ilce'] or ''}".strip(" —") + f" · {b['urun']}{' (' + b['cesit'] + ')' if b['cesit'] else ''}")
    p(f"Alan {_f(b['alan_dekar'], 1)} da · ağaç sayısı {b['agac_sayisi'] if b['agac_sayisi'] else 'beyan edilmemiş'} · dikim yılı {b['dikim_yili'] or 'beyan edilmemiş'} · merkez {b['lat']:.5f} K, {b['lng']:.5f} D")
    if b["arazi"]:
        p("Arazi (Copernicus DEM 30 m): " + b["arazi"])
    h1("2. Olay ve etiketi")
    p(f"Dönem: {o['baslangic']:%d.%m.%Y} – {o['bitis']:%d.%m.%Y}" + (f" · şiddet: {o['siddet']}" if o["siddet"] else "") + (f" · olay motoru en düşük (model): {_f(o['model_en_dusuk_c'])} °C" if o["model_en_dusuk_c"] is not None else ""))
    if v["etiket"]:
        p("Olay etiketi: " + v["etiket"]["ad"], bold=True)
        p(v["etiket"]["aciklama"] or "", 9)
    for kn in v["kanitlar"]:
        p(f"• {'Kamu kaydı' if kn['kaynak'] == 'dis_kayit' else 'İstasyon'}: {kn['metin']}" + (f" — {kn['baglanti']}" if kn["baglanti"] else ""), 9)
    if not v["kanitlar"] and v["kanit_yok_nedeni"]:
        p("Bağımsız kanıt yok: " + v["kanit_yok_nedeni"], 9)
    h1("3. Hava kanıtı")
    hv = v["hava"]
    if hv["kritik_c"] is not None:
        p(f"Dönemdeki fenoloji evresi: {hv['evre']} — hassas organ: {', '.join(hv['organlar'])}; kritik sıcaklık {_f(hv['kritik_c'])} °C (UC ANR 8100 / FAO Tablo 4.10; ön değer).", 9)
    if hv["saatlik"]:
        pdf.image(io.BytesIO(_grafik(hv["saatlik"], hv["kritik_c"])), w=185)
        pdf.set_font("DejaVu", "B", 9)
        pdf.cell(35, 6, "Gün", border=1)
        pdf.cell(40, 6, "Saatlik en düşük (°C)", border=1)
        pdf.cell(25, 6, "Saat", border=1)
        pdf.cell(80, 6, "Kaynak", border=1, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("DejaVu", "", 9)
        for gdn in hv["gunluk"]:
            pdf.cell(35, 6, f"{gdn['tarih']:%d.%m.%Y}", border=1)
            pdf.cell(40, 6, _f(gdn["min_c"]), border=1)
            pdf.cell(25, 6, f"{gdn['saat']:02d}:00", border=1)
            pdf.cell(80, 6, gdn["kaynak"], border=1, new_x="LMARGIN", new_y="NEXT")
        p("Model değeri 9–31 km ızgara hücresinin ortalamasıdır; bahçedeki gerçek sıcaklıktan farklı olabilir (Akdeniz kıyısında ERA5'in istasyonlara göre sistematik soğuk sapması saptanmıştır).", 8)
    else:
        p("Bu dönem için saatlik ERA5 verisi veritabanında yok.", 9)
    if hv["istasyon"]:
        p("İstasyon gözlemi (Meteostat, ölçüm kaynaklı):", 9, True)
        for s in hv["istasyon"]:
            p(f"• {s['istasyon']} ({_f(s['mesafe_km'])} km) {s['tarih']:%d.%m.%Y}: günlük en düşük {_f(s['tmin_c'])} °C" + (f" — {s['baglanti']}" if s["baglanti"] else ""), 9)
    else:
        p("İstasyon gözlemi: bu pencerede ölçüm kaynaklı istasyon verisi yok.", 9)
    h1("4. Uydu (Sentinel-2) önce / sonra")
    s2 = v["s2"]
    if s2["once"] and s2["sonra"]:
        img = _s2_grafik(s2)
        if img:
            pdf.image(io.BytesIO(img), w=95)
        p(f"Önce: {s2['once']['tarih']:%d.%m.%Y} — NDVI {_f(s2['once']['ndvi'], 2)}, NDRE {_f(s2['once']['ndre'], 2)}", 9)
        p(f"Sonra: {s2['sonra']['tarih']:%d.%m.%Y} — NDVI {_f(s2['sonra']['ndvi'], 2)}, NDRE {_f(s2['sonra']['ndre'], 2)}", 9)
        p(f"Fark (sonra − önce): NDVI {_f(s2.get('delta_ndvi'), 3)}, NDRE {_f(s2.get('delta_ndre'), 3)}. Arada {s2['bulutlu_arada']} bulutlu geçiş (net görüntü alınamadı).", 9, True)
        p("Mevsimsel değişim de fark yaratır; olaydan bağımsız normal değişim için Durum ekranındaki sezon eğrisine bakın. Bu fark hasar oranı değildir.", 8)
    else:
        p("Önce/sonra karşılaştırması yapılamadı: " + (s2["neden"] or "veri yok") + ".", 9)
    h1("5. Çiftçi kayıtları ve fotoğrafları")
    if v["kayitlar"]:
        for r in v["kayitlar"]:
            p(f"• {r['tarih']:%d.%m.%Y} · {r['tur']}: {r['aciklama'] or '(açıklama yok)'}", 9)
    else:
        p("Bu dönemde Saha Defteri kaydı yok.", 9)
    if v["fotograflar"]:
        for ft in v["fotograflar"]:
            try:
                im = Image.open(io.BytesIO(ft["bayt"]))
                im.thumbnail((700, 700))
                bio = io.BytesIO()
                im.convert("RGB").save(bio, format="JPEG", quality=80)
                if pdf.get_y() > 200:
                    pdf.add_page()
                pdf.image(io.BytesIO(bio.getvalue()), w=80)
                p(f"Fotoğraf — {ft['tarih']:%d.%m.%Y}" + (f": {ft['aciklama']}" if ft["aciklama"] else ""), 8)
            except Exception:  # noqa: BLE001
                continue
    else:
        p("Fotoğraf eklenmemiş (Saha Defteri'nden eklenebilir).", 9)
    h1("6. Kaynaklar ve notlar")
    for t in (
        "Kritik sıcaklıklar: Geisel ve Unruh (2003) UC ANR Yayın 8100 Tablo 2; Snyder ve de Melo-Abreu (2005) FAO Frost Protection Tablo 4.10. Eşikler ön değerdir, mühendis onayı bekler.",
        "Hava: ERA5 / ERA5-Land yeniden analiz (Open-Meteo arşivi); istasyon: Meteostat. Uydu: Sentinel-2 L2A (Copernicus). Arazi: Copernicus DEM GLO-30.",
        f"Olay etiketi kuralı: {load_catalog().don.yeniden_degerlendirme_surum} (docs/agro/don-dogrulama.md §7).",
        f"Hazırlanma: {v['uretildi']:%d.%m.%Y %H:%M} UTC · BahçeLab · bu taslak resmi belge değildir.",
    ):
        p("• " + t, 8)
    out = pdf.output()
    return bytes(out)


async def hazirla(session: AsyncSession, storage: StorageBackend, garden_id: uuid.UUID, olay_id: uuid.UUID) -> tuple[bytes, str]:
    v = await topla(session, storage, garden_id, olay_id)
    ad = f"don-hasar-raporu-{v['olay']['baslangic'].isoformat()}.pdf"
    return pdf_olustur(v), ad
