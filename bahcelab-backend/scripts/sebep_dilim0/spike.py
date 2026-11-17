"""ADIM 10B · Dilim 0 (spike): geçmiş canlılık düşüşü olaylarında kural tabanlı sebep puanlaması — ÜRÜN KODU DEĞİL.
Girdi: dev veritabanı (events s2_dusus, acquisition_stats, era5_daily). Çıktı: olay başına özellikler + sebep sırası (JSON + konsol).
Tüm ağırlıklar «ön değer · mühendis onayı bekliyor». ML yok. Kullanım: python -m scripts.sebep_dilim0.spike [çıktı.json]"""

from __future__ import annotations

import asyncio
import json
import statistics
import sys
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from bahcelab_backend.config import get_settings

SEBEPLER = ("don", "su", "besin", "hastalik", "mekanik", "goruntu")
S2 = "sentinel2-l2a"
HASAR_GUN = 21  # domain/agro katalog: olay.don_hasar_gun


def z_gecmis(deger: float | None, diger: list[float]) -> float | None:
    if deger is None or len(diger) < 5:
        return None
    sd = statistics.pstdev(diger)
    return None if sd == 0 else (deger - statistics.mean(diger)) / sd


async def ozellikler(conn, garden_id: str, ev) -> dict | None:  # noqa: ANN001
    tarih: date = ev.bitis
    sahneler = (
        await conn.execute(
            text("""SELECT a.id, a.tarih, a.bulut_orani, a.gecerli_oran,
        MAX(s.medyan) FILTER (WHERE s.indeks='ndvi') ndvi, MAX(s.medyan) FILTER (WHERE s.indeks='ndmi') ndmi, MAX(s.medyan) FILTER (WHERE s.indeks='ndre') ndre
        FROM acquisitions a JOIN acquisition_stats s ON s.acquisition_id=a.id
        WHERE a.garden_id=:g AND a.source_id=:s AND a.durum='net' GROUP BY a.id ORDER BY a.tarih"""),
            {"g": garden_id, "s": S2},
        )
    ).all()
    idx = next((i for i, r in enumerate(sahneler) if r.tarih == tarih), None)
    if idx is None or idx == 0:
        return None
    onceki, simdi = sahneler[idx - 1], sahneler[idx]
    sonraki = (
        sahneler[idx + 1]
        if idx + 1 < len(sahneler) and (sahneler[idx + 1].tarih - tarih).days <= 30
        else None
    )
    cell = (
        await conn.execute(
            text(
                """SELECT c.id FROM weather_cells c, gardens g WHERE g.id=:g ORDER BY (c.enlem-ST_Y(ST_Centroid(g.geom)))^2+(c.boylam-ST_X(ST_Centroid(g.geom)))^2 LIMIT 1"""
            ),
            {"g": garden_id},
        )
    ).scalar_one()
    pen_bas = (
        onceki.tarih + timedelta(days=1) - timedelta(days=HASAR_GUN)
    )  # don → görünür hasar gecikmesi (katalog olay.don_hasar_gun)
    hava = (
        await conn.execute(
            text(
                "SELECT MIN(t_min) tmin, MAX(t_max) tmax FROM era5_daily WHERE cell_id=:c AND tarih BETWEEN :a AND :b"
            ),
            {"c": cell, "a": pen_bas, "b": tarih},
        )
    ).one()
    don_gunu = (
        await conn.execute(
            text(
                "SELECT tarih FROM era5_daily WHERE cell_id=:c AND tarih BETWEEN :a AND :b ORDER BY t_min LIMIT 1"
            ),
            {"c": cell, "a": pen_bas, "b": tarih},
        )
    ).scalar()

    async def pencere(yil_fark: int | None) -> tuple[float | None, float | None]:
        """30 gün (sahneden önce) yağış toplamı ve sm1 ortalaması; yil_fark=None: bu yıl, aksi halde `yil_fark` yıl önce."""
        d = tarih.replace(year=tarih.year - yil_fark) if yil_fark else tarih
        r = (
            await conn.execute(
                text(
                    "SELECT SUM(yagis_mm) y, AVG(sm1) s FROM era5_daily WHERE cell_id=:c AND tarih BETWEEN :a AND :b"
                ),
                {"c": cell, "a": d - timedelta(days=30), "b": d},
            )
        ).one()
        return (None if r.y is None else float(r.y)), (None if r.s is None else float(r.s))

    bu = await pencere(None)
    digerleri = [await pencere(k) for k in range(1, 12) if tarih.year - k >= 2015]
    z_yagis = z_gecmis(bu[0], [d[0] for d in digerleri if d[0] is not None])
    z_nem = z_gecmis(bu[1], [d[1] for d in digerleri if d[1] is not None])
    # kardeş bahçe eşzamanlılığı (aynı çalışma alanındaki diğer bahçe, ±10 gün içinde s2_dusus): iki bahçe ~100 m → ilişkili, kanıt SAYILMAZ, yalnız bilgi
    kardes = (
        await conn.execute(
            text(
                "SELECT COUNT(*) FROM events WHERE garden_id<>:g AND 's2_dusus' = ANY(ARRAY(SELECT jsonb_array_elements_text(turler))) AND bitis BETWEEN :a AND :b"
            ),
            {"g": garden_id, "a": tarih - timedelta(days=10), "b": tarih + timedelta(days=10)},
        )
    ).scalar()
    ay = tarih.month
    d_ndvi = None if onceki.ndvi is None or simdi.ndvi is None else simdi.ndvi - onceki.ndvi
    d_ndmi = None if onceki.ndmi is None or simdi.ndmi is None else simdi.ndmi - onceki.ndmi
    d_ndre = None if onceki.ndre is None or simdi.ndre is None else simdi.ndre - onceki.ndre
    toparlanma = None
    if sonraki and d_ndvi and d_ndvi < 0 and sonraki.ndvi is not None:
        toparlanma = (sonraki.ndvi - simdi.ndvi) / (-d_ndvi)
    ay_ = ev.ayrinti or {}
    return {
        "tarih": str(tarih),
        "onceki": str(onceki.tarih),
        "bahce": ev.ad,
        "olay_turu": ev.tur,
        "turler": ev.turler,
        "ay": ay,
        "olay_delta_ndvi": ay_.get("s2_dusus.delta_ndvi"),
        "dusen_pay": ay_.get("s2_dusus.dusen_pay"),
        "kalici": ay_.get("s2_dusus.kalici"),
        "neden_kodu": ay_.get("s2_dusus.neden"),
        "yol": ay_.get("s2_dusus.yol"),
        "alan_da": ev.alan_da,
        "medyan_d_ndvi": d_ndvi,
        "d_ndmi": d_ndmi,
        "d_ndre": d_ndre,
        "toparlanma_orani": toparlanma,
        "sahne_bulut": simdi.bulut_orani,
        "gecerli_oran": simdi.gecerli_oran,
        "tmin_pencere": None if hava.tmin is None else float(hava.tmin),
        "don_gunu": str(don_gunu) if don_gunu else None,
        "z_yagis30": z_yagis,
        "z_nem30": z_nem,
        "yagis30_mm": bu[0],
        "kardes_bahce_ayni_donem": int(kardes),
    }


def puanla(f: dict, carpan: dict[str, float] | None = None) -> dict[str, dict]:
    """Her sebep için (puan, lehte[], aleyhte[]). Puan göreli: yalnız sıralama için; olasılık DEĞİL. Ağırlıklar ön değer."""
    P: dict[str, dict] = {s: {"puan": 0.0, "lehte": [], "aleyhte": []} for s in SEBEPLER}

    def ekle(s: str, w: float, metin: str) -> None:
        w0, w = w, w * (carpan or {}).get(s, 1.0)
        P[s]["puan"] += w
        P[s]["lehte" if w > 0 else "aleyhte"].append(f"{metin} ({w0:+g})")

    tmin, ay = f["tmin_pencere"], f["ay"]
    kalici = f["kalici"] in (True, "True")
    gecici = f["kalici"] in (False, "False") or (
        f["toparlanma_orani"] is not None and f["toparlanma_orani"] >= 0.6
    )
    tum_bahce = (f["dusen_pay"] or 0) >= 0.8
    # --- don
    if tmin is not None:
        if tmin <= -2.0:
            ekle("don", 3.0, f"pencerede en düşük hava {tmin:.1f} °C ≤ −2")
        elif tmin <= 0.0:
            ekle("don", 2.0, f"pencerede en düşük hava {tmin:.1f} °C ≤ 0")
        elif tmin <= 2.0:
            ekle("don", 0.5, f"pencerede en düşük hava {tmin:.1f} °C (≤ +2, ölçüm belirsizliği)")
        else:
            ekle(
                "don",
                -3.0,
                f"pencerede hava hep > +2 °C (en düşük {tmin:.1f}) — don fiziksel olarak mümkün değil",
            )
    if ay in (12, 1, 2, 3, 4) and kalici:
        ekle("don", 0.5, "kış/erken ilkbahar + kalıcı düşüş")
    # --- su
    if f["d_ndmi"] is not None and f["d_ndmi"] <= -0.05:
        ekle("su", 1.5, f"NDMI {f['d_ndmi']:+.2f} (su içeriği düşüşü)")
    if f["d_ndmi"] is not None and f["d_ndmi"] > -0.02:
        ekle("su", -1.0, "NDMI düşmedi")
    if f["z_nem30"] is not None and f["z_nem30"] <= -1.0:
        ekle("su", 1.5, f"toprak nemi 30 gün z={f['z_nem30']:.1f} (kurak)")
    if f["z_nem30"] is not None and f["z_nem30"] >= 0.5:
        ekle("su", -1.0, f"toprak nemi normalin üstü z={f['z_nem30']:.1f}")
    if ay in (6, 7, 8, 9):
        ekle("su", 0.5, "yaz (su stresi mevsimi)")
    # --- besin: uydu imzası yavaş/kademeli; tek çiftte ani düşüş aleyhte; kanıt derecesi zayıf
    if f["medyan_d_ndvi"] is not None and f["medyan_d_ndvi"] > -0.08:
        ekle("besin", 0.5, "düşüş küçük/yavaş (besin eksikliği kademeli)")
    if (f["olay_delta_ndvi"] or 0) <= -0.10:
        ekle("besin", -1.0, "ani ve büyük düşüş (besin kaynaklı değişim kademelidir)")
    # --- hastalık/zararlı: yayılan küme; tüm-bahçe tek adım aleyhte
    if tum_bahce:
        ekle("hastalik", -1.0, "tüm bahçe tek adımda düştü (yayılan küme deseni değil)")
    elif f["alan_da"]:
        ekle("hastalik", 0.5, f"yamalı düşüş ({f['alan_da']} da) — yayılan küme olabilir")
    # --- mekanik/yönetim: keskin kenar, kalıcı, hava/su açıklaması yok
    if kalici and not tum_bahce and f["alan_da"] and (tmin is None or tmin > 2.0):
        ekle("mekanik", 1.5, "kalıcı yama + don/su açıklaması yok")
    if ay in (2, 3, 4) and f["alan_da"] and kalici:
        ekle("mekanik", 0.5, "budama/söküm mevsimi + yama")
    # --- görüntü kaynaklı
    if gecici:
        ekle("goruntu", 2.0, "sonraki sahnede toparlandı / kalıcı değil")
    if tum_bahce:
        ekle("goruntu", 1.0, "tüm bahçe aynı anda (atmosfer/bulut gölgesi deseni)")
    if (f["sahne_bulut"] or 0) >= 20:
        ekle("goruntu", 1.0, f"sahne bulutu %{f['sahne_bulut']:.0f}")
    if kalici and not gecici:
        ekle("goruntu", -1.5, "kalıcı düşüş")
    return P


def sirala(
    P: dict[str, dict], esik: float = 1.5, marj: float = 0.5
) -> tuple[list[str], str | None]:
    """Sıra + çekimser durum: en iyi puan < eşik ya da ilk ikinin farkı < marj ise sebep SEÇİLMEZ (None)."""
    sira = sorted(SEBEPLER, key=lambda s: -P[s]["puan"])
    en, ikinci = P[sira[0]]["puan"], P[sira[1]]["puan"]
    return sira, (sira[0] if en >= esik and en - ikinci >= marj else None)


async def main() -> None:
    eng = create_async_engine(get_settings().database_url)
    out: list[dict] = []
    async with eng.connect() as conn:
        evs = (
            await conn.execute(
                text("""SELECT g.id gid, g.ad, e.tur, e.turler, e.bitis, e.alan_da, e.ayrinti, e.baslangic
            FROM events e JOIN gardens g ON g.id=e.garden_id WHERE e.turler ? 's2_dusus' ORDER BY g.ad, e.bitis""")
            )
        ).all()
        for ev in evs:
            f = await ozellikler(conn, str(ev.gid), ev)
            if f is None:
                continue
            P = puanla(f)
            sira, secim = sirala(P)
            f.update(
                {
                    "puan": {s: round(P[s]["puan"], 1) for s in SEBEPLER},
                    "sira": sira,
                    "secim": secim,
                    "kanit": {s: P[s] for s in sira[:2]},
                }
            )
            out.append(f)
    await eng.dispose()
    # hassasiyet: sebep başına ağırlık çarpanı U(0,7; 1,3), 500 deneme; seçimin (çekimser dahil) değişmeme oranı
    import random

    rng = random.Random(7)
    for f in out:
        sabit = 0
        for _ in range(500):
            c = {s: rng.uniform(0.7, 1.3) for s in SEBEPLER}
            _, sec = sirala(puanla(f, c))
            sabit += sec == f["secim"]
        f["secim_kararlilik"] = round(sabit / 500, 2)
    if len(sys.argv) > 1:
        open(sys.argv[1], "w").write(json.dumps(out, ensure_ascii=False, indent=1, default=str))
    for f in out:
        print(
            f"{f['bahce'][:7]:7} {f['tarih']} {f['olay_turu']:8} Δndvi={f['olay_delta_ndvi']} tmin={None if f['tmin_pencere'] is None else round(f['tmin_pencere'], 1)} Δndmi={None if f['d_ndmi'] is None else round(f['d_ndmi'], 2)} zNem={None if f['z_nem30'] is None else round(f['z_nem30'], 1)} kalıcı={f['kalici']} pay={f['dusen_pay']} → {f['secim']} kararlılık={f['secim_kararlilik']} {[(s, f['puan'][s]) for s in f['sira'][:3]]}"
        )


if __name__ == "__main__":
    asyncio.run(main())
