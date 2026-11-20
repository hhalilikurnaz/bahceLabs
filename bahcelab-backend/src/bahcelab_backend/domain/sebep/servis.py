"""ADIM 10B (ADR 0033) · sebep servisi: bir S2 canlılık düşüşü olayı için veriyi toplar (S2 sahne istatistikleri, ERA5-Land, istasyon/kamu kaydı, kullanıcı yanıtı, radar), `motor`a verir,
«görüntü kaynaklı olabilir» kapısını uygular ve kullanıcının «sebep buydu» yanıtını Saha Defteri'ne + etiket tablosuna yazar. Sentetik veri yok: veri yoksa kanıt satırı da yoktur."""

from __future__ import annotations

import json
import statistics
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.agro.catalog import SebepKurali, load_catalog
from bahcelab_backend.domain.evidence import service as evidence
from bahcelab_backend.domain.sebep import motor
from bahcelab_backend.domain.weather.service import snap
from bahcelab_backend.shared.clock import bahce_bugunu

S2 = "sentinel2-l2a"
SEBEP_AD = {
    "don": "Don",
    "su": "Su (kuraklık/fazla su)",
    "goruntu": "Görüntü kaynaklı (bulut gölgesi/sis/sınıflandırma)",
    "besin": "Besin eksikliği",
    "hastalik": "Hastalık/zararlı",
    "mekanik": "Budama/hasat/mekanik",
}
#: kullanıcı yanıtı → motor sebebi (görüntü kaynaklı kullanıcıya sorulmaz; budama-hasat motorun «mekanik» sınıfıdır)
YANIT_SEBEP = {
    "su": "su",
    "don": "don",
    "besin": "besin",
    "hastalik_zararli": "hastalik",
    "budama_hasat": "mekanik",
    "bilmiyorum": None,
}
KAPI_MESAJ = "Görüntü kaynaklı olabilir — bir sonraki net görüntüyü bekleyin."


@dataclass(frozen=True)
class OlayBaglam:
    anahtar: str
    sahne_tarihi: date
    onceki_tarih: date
    pencere_bas: date  # don penceresi başı = önceki sahne + 1 − don_hasar_gun


async def _sahneler(session: AsyncSession, garden_id: uuid.UUID, as_of: date | None) -> list[Any]:
    sql = (
        "SELECT a.tarih, a.bulut_orani, MAX(s.medyan) FILTER (WHERE s.indeks = 'ndvi') ndvi, MAX(s.medyan) FILTER (WHERE s.indeks = 'ndmi') ndmi "
        "FROM acquisitions a LEFT JOIN acquisition_stats s ON s.acquisition_id = a.id WHERE a.garden_id = :g AND a.source_id = :s AND a.durum = 'net' "
        + ("AND a.tarih <= :t " if as_of else "")
        + "GROUP BY a.id, a.tarih, a.bulut_orani ORDER BY a.tarih"
    )
    p: dict[str, Any] = {"g": garden_id, "s": S2}
    if as_of:
        p["t"] = as_of
    return list((await session.execute(text(sql), p)).all())


async def _hucre(session: AsyncSession, garden_id: uuid.UUID) -> uuid.UUID | None:
    row = (
        await session.execute(
            text(
                "SELECT ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"
            ),
            {"g": garden_id},
        )
    ).first()
    if row is None:
        return None
    step = get_settings().weather_cell_degrees
    return (
        await session.execute(
            text("SELECT id FROM weather_cells WHERE enlem = :a AND boylam = :b"),
            {"a": snap(float(row[0]), step), "b": snap(float(row[1]), step)},
        )
    ).scalar()


async def _pencere_nem(session: AsyncSession, cell: uuid.UUID, gun: date) -> float | None:
    r = (
        await session.execute(
            text("SELECT AVG(sm1) FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :a AND :b"),
            {"c": cell, "a": gun - timedelta(days=30), "b": gun},
        )
    ).scalar()
    return None if r is None else float(r)


def _z(deger: float | None, diger: list[float]) -> float | None:
    if deger is None or len(diger) < 5:
        return None
    sd = statistics.pstdev(diger)
    return None if sd == 0 else (deger - statistics.mean(diger)) / sd


def doy_farki(a: date, b: date) -> int:
    """Yılın gününe göre dairesel fark (gün)."""
    d = abs(a.timetuple().tm_yday - b.timetuple().tm_yday)
    return min(d, 365 - d)


async def halka_z(session: AsyncSession, garden_id: uuid.UUID, tarih: date, pencere_gun: int, min_n: int = 5) -> dict[str, float | None] | None:
    """Komşu halka (bahçe sınırından 100–300 m, yalnız ağaçlık; `sk_halka` önbelleği) NDVI/NDMI'sinin, AYNI sahnede, aynı dönemin (±`pencere_gun`) DİĞER yılları temelinde z-skoru.
    Halka verisi yoksa ya da bu tarihte ölçüm yoksa None. Panel isteği ağ kullanmaz (önbellek tablo)."""
    rows = (await session.execute(text("SELECT tarih, ndvi, ndmi FROM sk_halka WHERE garden_id = :g AND ndvi IS NOT NULL AND ndmi IS NOT NULL"), {"g": garden_id})).all()
    bu = next((r for r in rows if r.tarih == tarih), None)
    if bu is None:
        return None
    taban = [r for r in rows if r.tarih.year != tarih.year and doy_farki(r.tarih, tarih) <= pencere_gun]
    return {"ndvi": _z(float(bu.ndvi), [float(r.ndvi) for r in taban]) if len(taban) >= min_n else None, "ndmi": _z(float(bu.ndmi), [float(r.ndmi) for r in taban]) if len(taban) >= min_n else None, "n": float(len(taban))}


async def _bagimsiz_kanit(
    session: AsyncSession, garden_id: uuid.UUID, bas: date, bit: date, k: SebepKurali
) -> list[motor.HazirKanit]:
    """Bağımsız don kanıtı: Meteostat/MGM istasyon gözlemi + kamu kaydı (evidence) ve kullanıcının «Don oldu mu?» yanıtı."""
    out: list[motor.HazirKanit] = []
    ctx = await evidence.load_context(session, garden_id)
    on = evidence.prior_of(ctx, "don", bas, bit)
    for x in on.kanitlar:
        if x.kaynak == "istasyon" and x.yon in ("destek", "celisme"):
            out.append(
                motor.HazirKanit(
                    "don_istasyon_destek" if x.yon == "destek" else "don_istasyon_celisme",
                    "bagimsiz:istasyon",
                    x.metin,
                    x.baglanti,
                )
            )
        elif x.kaynak == "dis_kayit" and x.yon == "destek":
            out.append(
                motor.HazirKanit(
                    "don_dis_kayit_destek",
                    "bagimsiz:dis_kayit",
                    x.metin + (" (il düzeyi kayıt)" if x.il_duzeyi else ""),
                    x.baglanti,
                )
            )
    yanit = {
        r[0]: r[1]
        for r in (
            await session.execute(
                text(
                    "SELECT gece, yanit FROM don_geri_bildirim WHERE garden_id = :g AND gece BETWEEN :a AND :b"
                ),
                {"g": garden_id, "a": bas, "b": bit},
            )
        ).all()
    }
    oldu = sorted(g for g, y in yanit.items() if y == "oldu")
    olmadi = sorted(g for g, y in yanit.items() if y == "olmadi")
    if oldu:
        out.append(
            motor.HazirKanit(
                "don_kullanici_oldu",
                "bagimsiz:kullanici",
                f"Kullanıcı «Don oldu mu?» sorusuna {oldu[0]:%d.%m.%Y} gecesi için «oldu» dedi",
            )
        )
    elif olmadi:
        out.append(
            motor.HazirKanit(
                "don_kullanici_olmadi",
                "bagimsiz:kullanici",
                f"Kullanıcı «Don oldu mu?» sorusuna {olmadi[0]:%d.%m.%Y} gecesi için «olmadı» dedi",
            )
        )
    return out


async def girdi_olustur(
    session: AsyncSession,
    garden_id: uuid.UUID,
    sahne_tarihi: date,
    k: SebepKurali,
    ayrinti: dict[str, Any] | None,
    as_of: date | None = None,
    dusen_pay: float | None = None,
) -> tuple[motor.Girdi, OlayBaglam | None]:
    """Bir S2 düşüş olayı için motor girdisi. `as_of`: yalnız o güne kadarki veri (geriye dönük «uyarı anı» ölçümü); None: eldeki tüm veri."""
    sahneler = await _sahneler(session, garden_id, as_of)
    idx = next((i for i, r in enumerate(sahneler) if r.tarih == sahne_tarihi), None)
    if idx is None or idx == 0:
        return motor.Girdi(ay=sahne_tarihi.month), None
    onceki, simdi = sahneler[idx - 1], sahneler[idx]
    sonraki = (
        sahneler[idx + 1]
        if idx + 1 < len(sahneler) and (sahneler[idx + 1].tarih - sahne_tarihi).days <= 30
        else None
    )
    hasar = load_catalog().olay.don_hasar_gun
    bas = onceki.tarih + timedelta(days=1) - timedelta(days=hasar)
    d = ayrinti or {}
    d_ndvi = None if onceki.ndvi is None or simdi.ndvi is None else simdi.ndvi - onceki.ndvi
    d_ndmi = None if onceki.ndmi is None or simdi.ndmi is None else simdi.ndmi - onceki.ndmi
    ev_delta = d.get("s2_dusus.delta_ndvi")
    toparlanma = None
    kalici: bool | None = None
    if sonraki is not None and sonraki.ndvi is not None and simdi.ndvi is not None:
        kayip = -(float(ev_delta) if isinstance(ev_delta, (int, float)) else (d_ndvi or 0.0))
        if kayip > 0:
            toparlanma = (sonraki.ndvi - simdi.ndvi) / kayip
            kalici = toparlanma < k.toparlanma_orani
    if sonraki is not None and d.get("s2_dusus.kalici") in (True, False, "True", "False"):
        kalici = d["s2_dusus.kalici"] in (True, "True")  # olay motorunun yama düzeyi kalıcılık ölçüsü (bahçe ortancası küçük yamaları görmez); yalnız sonraki net sahne VARSA
    cell = await _hucre(session, garden_id)
    tmin = z = None
    if cell is not None:
        r = (
            await session.execute(
                text(
                    "SELECT MIN(t_min) FROM era5_daily WHERE cell_id = :c AND tarih BETWEEN :a AND :b"
                ),
                {"c": cell, "a": bas, "b": sahne_tarihi},
            )
        ).scalar()
        tmin = None if r is None else float(r)
        bu = await _pencere_nem(session, cell, sahne_tarihi)
        diger = [
            x
            for kk in range(1, 12)
            if sahne_tarihi.year - kk >= 2015
            and (
                x := await _pencere_nem(
                    session, cell, sahne_tarihi.replace(year=sahne_tarihi.year - kk)
                )
            )
            is not None
        ]
        z = _z(bu, diger)
    radar = bool(
        (
            await session.execute(
                text(
                    "SELECT 1 FROM events WHERE garden_id = :g AND turler ? 'radar_degisim' AND baslangic BETWEEN :a AND :b LIMIT 1"
                ),
                {"g": garden_id, "a": onceki.tarih, "b": sahne_tarihi + timedelta(days=5)},
            )
        ).first()
    )
    if as_of is not None and as_of < sahne_tarihi + timedelta(days=5):
        radar = False  # uyarı anında henüz görülemeyen radar olayı sayılmaz
    pay = (
        dusen_pay
        if dusen_pay is not None
        else (
            float(d["s2_dusus.dusen_pay"])
            if isinstance(d.get("s2_dusus.dusen_pay"), (int, float))
            else None
        )
    )
    hazir = await _bagimsiz_kanit(session, garden_id, bas, sahne_tarihi, k)
    g = motor.Girdi(
        ay=sahne_tarihi.month,
        tmin_pencere=tmin,
        d_ndmi=d_ndmi,
        z_nem30=z,
        dusen_pay=pay,
        kalici=kalici,
        toparlanma_orani=toparlanma,
        sahne_bulut=None if simdi.bulut_orani is None else float(simdi.bulut_orani),
        radar_degisim=radar,
        hazir=tuple(hazir),
    )
    return g, OlayBaglam("", sahne_tarihi, onceki.tarih, bas)


def beklenen_gecis(sahne_tarihleri: list[date], bugun: date) -> date | None:
    """Sonraki Sentinel-2 geçişinin TAHMİNİ tarihi: bu bahçenin son 10 net sahnesi arası ortanca aralık (gün) son sahneye eklenir; geçmişte kalırsa aralık eklenerek bugünden sonrasına ilerletilir."""
    if len(sahne_tarihleri) < 3:
        return None
    son = sahne_tarihleri[-11:]
    aralik = int(statistics.median((b - a).days for a, b in zip(son, son[1:], strict=False)))
    if aralik < 1:
        return None
    tarih = sahne_tarihleri[-1] + timedelta(days=aralik)
    while tarih <= bugun:
        tarih += timedelta(days=aralik)
    return tarih


def _kanit_dict(x: motor.Kanit) -> dict[str, Any]:
    return {
        "kod": x.kod,
        "yon": x.yon,
        "metin": x.metin,
        "bagimsizlik": x.bagimsizlik,
        "tur": x.tur,
        "agirlik": round(x.agirlik, 2),
        "baglanti": x.baglanti,
    }


def cikti(s: motor.Sonuc, k: SebepKurali, gecis: date | None) -> dict[str, Any]:
    return {
        "surum": k.surum,
        "durum": k.durum,
        "aciklama": "Kesin değil: kural tabanlı sıralama; ağırlıklar ön değer · mühendis onayı bekliyor.",
        "secim": s.secim,
        "secim_ad": SEBEP_AD.get(s.secim) if s.secim else None,
        "guven": s.guven,
        "belirsiz_nedeni": s.belirsiz_nedeni,
        "kararlilik": s.kararlilik,
        "guven_dusuruldu": s.guven_dusuruldu,
        "kapi": {
            "kapali": s.kapi,
            "mesaj": KAPI_MESAJ if s.kapi else None,
            "beklenen_gecis": gecis.isoformat() if (s.kapi and gecis) else None,
            "beklenen_gecis_tahmini": True,
        },
        "siralama": [
            {
                "sebep": p.sebep,
                "ad": SEBEP_AD[p.sebep],
                "puan": p.puan,
                "dogrudan_kanit": p.dogrudan_lehte,
                "bagimsiz_kanit": p.bagimsiz_lehte,
                "kanitlar": [
                    _kanit_dict(x) for x in sorted(p.kanitlar, key=lambda y: -abs(y.agirlik))
                ],
            }
            for p in s.siralama
        ],
        "kontrol_listesi": {
            ad: {"ad": SEBEP_AD[ad], "maddeler": [m.model_dump() for m in maddeler]}
            for ad, maddeler in k.kontrol_listesi.items()
        },
        "secilemeyen": ["besin", "hastalik", "mekanik"],
    }


async def olay_sebep(
    session: AsyncSession, garden_id: uuid.UUID, olay_id: uuid.UUID
) -> dict[str, Any] | None:
    """Olay için «Olası sebepler (kesin değil)». S2 düşüşü içermeyen olay (hava/radar) için None: ayrıştırılacak canlılık düşüşü yok."""
    k = load_catalog().sebep
    row = (
        await session.execute(
            text(
                "SELECT anahtar, turler, bitis, ayrinti, alan_da FROM events WHERE id = :i AND garden_id = :g"
            ),
            {"i": olay_id, "g": garden_id},
        )
    ).first()
    if row is None or "s2_dusus" not in row.turler:
        return None
    g, baglam = await girdi_olustur(session, garden_id, row.bitis, k, row.ayrinti)
    if baglam is None:
        return None
    s = motor.degerlendir_tam(g, k)
    sahneler = [r.tarih for r in await _sahneler(session, garden_id, None)]
    out = cikti(
        s,
        k,
        beklenen_gecis(sahneler, await bahce_bugunu(session, garden_id)),
    )
    out["olay"] = {
        "id": str(olay_id),
        "anahtar": row.anahtar,
        "tarih": row.bitis.isoformat(),
        "pencere": {"bas": baglam.pencere_bas.isoformat(), "bit": row.bitis.isoformat()},
    }
    etiket = (
        await session.execute(
            text("SELECT sebep FROM sebep_etiket WHERE garden_id = :g AND olay_anahtar = :a"),
            {"g": garden_id, "a": row.anahtar},
        )
    ).scalar()
    out["kullanici_yaniti"] = etiket
    return out


async def kapi_karari(session: AsyncSession, garden_id: uuid.UUID, e: Any, as_of: date | None = None) -> dict[str, Any] | None:
    """«Görüntü kaynaklı olabilir» kapısı kapalıysa {mesaj, beklenen_gecis (tahmini)}, açıksa None. Yalnız SAF optik düşüş olayı (tur=s2_dusus, olay/bekliyor) kapıya girer; don bağlantılı
    (tur=don) ya da başka tür olaylara dokunmaz."""
    if e.tur != "s2_dusus" or e.durum not in ("olay", "bekliyor"):
        return None
    k = load_catalog().sebep
    g, baglam = await girdi_olustur(session, garden_id, e.bitis, k, e.ayrinti, as_of=as_of)
    if baglam is None or not motor.degerlendir_tam(g, k).kapi:
        return None
    sahneler = [r.tarih for r in await _sahneler(session, garden_id, as_of)]
    gecis = beklenen_gecis(sahneler, await bahce_bugunu(session, garden_id))
    return {"mesaj": KAPI_MESAJ, "beklenen_gecis": gecis}


async def kapi_bastir(session: AsyncSession, garden_id: uuid.UUID, e: Any, as_of: date | None = None) -> bool:
    """Bu olay için uyarı/bildirim bastırılsın mı? (kapı kapalıysa True)"""
    return await kapi_karari(session, garden_id, e, as_of) is not None


# ------------------------------------------------------------------ kullanıcı yanıtı → Saha Defteri + etiket tablosu
async def yanit_yaz(
    session: AsyncSession,
    garden_id: uuid.UUID,
    olay_id: uuid.UUID,
    yanit: str,
    user_id: uuid.UUID | None,
) -> bool:
    """«Sebep buydu» yanıtı. Etiket tablosuna (model çıktısıyla birlikte) + Saha Defteri'ne «gözlem» kaydı. Olay yoksa False. Eğitimde kullanım için rıza alanı vardır (varsayılan YOK, rıza metni Adım 19–20)."""
    k = load_catalog().sebep
    sonuc = await olay_sebep(session, garden_id, olay_id)
    row = (
        await session.execute(
            text("SELECT anahtar, bitis FROM events WHERE id = :i AND garden_id = :g"),
            {"i": olay_id, "g": garden_id},
        )
    ).first()
    if row is None:
        return False
    siralama = [{"sebep": p["sebep"], "puan": p["puan"]} for p in (sonuc or {}).get("siralama", [])]
    await session.execute(
        text(
            "INSERT INTO sebep_etiket (id, garden_id, olay_anahtar, sebep, model_secim, model_guven, model_surum, model_siralama, created_by) "
            "VALUES (gen_random_uuid(), :g, :a, :s, :m, :c, :v, CAST(:o AS jsonb), :u) "
            "ON CONFLICT (garden_id, olay_anahtar) DO UPDATE SET sebep = :s, model_secim = :m, model_guven = :c, model_surum = :v, model_siralama = CAST(:o AS jsonb), created_by = :u, updated_at = clock_timestamp()"
        ),
        {
            "g": garden_id,
            "a": row.anahtar,
            "s": yanit,
            "m": (sonuc or {}).get("secim"),
            "c": (sonuc or {}).get("guven"),
            "v": k.surum,
            "o": json.dumps(siralama),
            "u": user_id,
        },
    )
    await session.execute(
        text(
            "DELETE FROM field_records WHERE garden_id = :g AND tur = 'gozlem' AND ayrinti->>'konu' = 'sebep_yaniti' AND ayrinti->>'olay' = :a"
        ),
        {"g": garden_id, "a": row.anahtar},
    )
    etiket = {
        "su": "su",
        "don": "don",
        "besin": "besin",
        "hastalik_zararli": "hastalık/zararlı",
        "budama_hasat": "budama/hasat",
        "bilmiyorum": "bilmiyorum",
    }[yanit]
    kayit_id = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO field_records (id, garden_id, tur, tarih, aciklama, ayrinti, created_by) VALUES (:i, :g, 'gozlem', :d, :a, CAST(:y AS jsonb), :u)"
        ),
        {
            "i": kayit_id,
            "g": garden_id,
            "d": row.bitis,
            "a": f"Canlılık düşüşünün sebebi ({row.bitis:%d.%m.%Y}): {etiket}",
            "y": json.dumps({"konu": "sebep_yaniti", "olay": row.anahtar, "sebep": yanit}),
            "u": user_id,
        },
    )
    from bahcelab_backend.domain.fieldbook import sistem

    await sistem.etiket_yaz(session, kayit_id, "sebep_yaniti", yanit, row.anahtar)  # «Sebep buydu» → gözlem etiketi (katalog eşlemesi; eşleşmeyen etiketsiz kalır)
    return True
