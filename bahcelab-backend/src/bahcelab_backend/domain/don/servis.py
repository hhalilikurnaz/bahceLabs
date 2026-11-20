"""Gece don riski servisi: bahçe için önümüzdeki 3 gecenin riskini hesaplar/saklar ve okur; olasılık sözcükleriyle yanıt üretir."""

from __future__ import annotations

import json
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import DonKurali, load_catalog
from bahcelab_backend.domain.agro.simulation import stage_on
from bahcelab_backend.domain.don import risk, topografya
from bahcelab_backend.domain.don.tahmin import TahminSaglayici, varsayilan
from bahcelab_backend.shared.clock import bahce_bugunu

GECE_SAYISI = 3


async def hesapla_ve_yaz(session: AsyncSession, garden_id: uuid.UUID, saglayici: TahminSaglayici | None = None, kural: DonKurali | None = None, bugun: date | None = None) -> list[dict[str, Any]]:
    """Önümüzdeki 3 gece (bugün akşamı dahil) için riski hesaplar, `don_risk`'e yazar (aynı gece yeniden hesaplanırsa üzerine yazılır). Dönüş: yazılan satırlar."""
    k = kural or load_catalog().don
    g = (await session.execute(text("SELECT urun, cesit_kodu, ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).first()
    if g is None:
        return []
    urun, cesit, lat, lng = g
    gun0 = bugun or await bahce_bugunu(session, garden_id)
    modeller = await (saglayici or varsayilan()).saatlik(float(lat), float(lng), k.modeller)
    out: list[dict[str, Any]] = []
    for i in range(GECE_SAYISI):
        gece = gun0 + timedelta(days=i)
        evre, _ = stage_on(urun, cesit, gece + timedelta(days=1))
        kr = risk.kritik_sicaklik(evre, k)
        if kr is None:
            continue
        kritik, organlar = kr
        o = risk.gece_ozeti(modeller, gece, kritik, k)
        if o is None:
            continue
        d = risk.karar(o, kritik, k)
        satir = {"garden_id": garden_id, "gece": gece, "kritik_c": kritik, "evre": evre, "organlar": json.dumps(organlar), "en_soguk_c": o.en_soguk_c, "tmin_model": json.dumps(o.tmin_model), "uzlasi": o.kac_model_uzlasi,
                 "bulut": o.bulut_ort, "ruzgar": o.ruzgar_ort, "saat": o.saat_kritik_alti, "en_saat": o.en_soguk_saat, "seviye": d.seviye, "olasilik": d.olasilik, "neden": d.neden, "surum": k.surum}
        await session.execute(
            text("INSERT INTO don_risk (garden_id, gece, uretildi, kritik_c, evre, organlar, en_soguk_c, tmin_model, uzlasi, bulut, ruzgar, saat_kritik_alti, en_soguk_saat, seviye, olasilik, neden, kural_surum) "
                 "VALUES (:garden_id, :gece, clock_timestamp(), :kritik_c, :evre, CAST(:organlar AS jsonb), :en_soguk_c, CAST(:tmin_model AS jsonb), :uzlasi, :bulut, :ruzgar, :saat, :en_saat, :seviye, :olasilik, :neden, :surum) "
                 "ON CONFLICT (garden_id, gece) DO UPDATE SET uretildi = clock_timestamp(), kritik_c = :kritik_c, evre = :evre, organlar = CAST(:organlar AS jsonb), en_soguk_c = :en_soguk_c, tmin_model = CAST(:tmin_model AS jsonb), "
                 "uzlasi = :uzlasi, bulut = :bulut, ruzgar = :ruzgar, saat_kritik_alti = :saat, en_soguk_saat = :en_saat, seviye = :seviye, olasilik = :olasilik, neden = :neden, kural_surum = :surum"),
            satir,
        )
        out.append(satir)
    return out


def _onlemler(k: Any) -> list[dict[str, Any]]:
    return [o.model_dump() for o in k.onlemler]


async def oku(session: AsyncSession, garden_id: uuid.UUID, bugun: date | None = None) -> dict[str, Any]:
    """API yanıtı: önümüzdeki 3 gece (olasılık sözcüğü, en soğuk saat, kritik eşik + organ), orta/yüksekse «ne yapmalı» (kaynaklı), dünkü gece sorusu, topografya profili + konum sınıfı, «nasıl hesaplandı». Veri yoksa nedeni yazılır (uydurma yok)."""
    k = load_catalog().don
    gun0 = bugun or await bahce_bugunu(session, garden_id)
    rows = (await session.execute(text("SELECT gece, kritik_c, evre, organlar, en_soguk_c, tmin_model, uzlasi, seviye, olasilik, neden, uretildi, saat_kritik_alti, en_soguk_saat FROM don_risk WHERE garden_id = :g AND gece >= :b ORDER BY gece LIMIT :n"), {"g": garden_id, "b": gun0, "n": GECE_SAYISI})).all()
    geri = {r[0]: r[1] for r in (await session.execute(text("SELECT gece, yanit FROM don_geri_bildirim WHERE garden_id = :g AND gece >= :b"), {"g": garden_id, "b": gun0 - timedelta(days=3)})).all()}
    dun = (await session.execute(text("SELECT gece, en_soguk_c FROM don_risk WHERE garden_id = :g AND gece = :d AND seviye = 'uyari'"), {"g": garden_id, "d": gun0 - timedelta(days=1)})).first()
    topo = (await session.execute(text("SELECT profil, bahce_ici, hesaplandi, kaynak FROM bahce_topografya WHERE garden_id = :g"), {"g": garden_id})).first()
    bi = dict(topo[1]) if topo else None
    if bi is not None:
        bi.pop("hucreler", None)  # hücre listesi harita katmanı için ayrı uçta (goreli-soguk)
    tetik = any(r[7] in ("izle", "uyari") for r in rows)
    return {
        "geceler": [{"gece": r[0], "sabah": r[0] + timedelta(days=1), "olasilik_sozu": risk.SOZ[r[7]], "seviye": r[7], "kritik_c": r[1], "evre": r[2], "organlar": r[3], "organ_adlari": [risk.ORGAN_AD.get(o, o) for o in r[3]], "en_soguk_c": r[4], "en_soguk_saat": r[12], "model_tmin": r[5], "uzlasi_model": r[6],
                     "neden": r[9], "uretildi": r[10], "saat_kritik_alti": r[11], "geri_bildirim": geri.get(r[0])} for r in rows],
        "onlemler": _onlemler(k) if tetik else [],
        "onlem_notu": "Genel literatür bilgisidir (kaynakları her maddede); bahçenize uygunluğunu ve güvenliğini ziraat mühendisiyle doğrulayın." if tetik else None,
        "dun_soru": None if dun is None or dun[0] in geri else {"gece": dun[0], "soru": "Dün gece don oldu mu?", "secenekler": ["oldu", "olmadi", "bilmiyorum"]},
        "topografya": None if topo is None else {"profil": topo[0], "konum": topografya.konum_sinifi(topo[0], k), "bahce_ici": bi, "hesaplandi": topo[2], "kaynak": topo[3], "not": "Arazi betimleyicidir; sıcaklığa °C olarak eklenmez."},
        "temkin_notu": risk.TEMKIN_NOTU, "nasil": risk.NASIL, "esik_durumu": "ön değer · mühendis onayı bekliyor" if k.durum == "dogrulanmadi" else "mühendis onaylı", "kural_surum": k.surum,
        "veri_yok_nedeni": None if rows else "Henüz gece tahmini hesaplanmadı (günlük iş çalışınca oluşur) ya da bu ürün/evre için kritik sıcaklık tanımlı değil.",
    }


async def bugun_maddesi(session: AsyncSession, garden_id: uuid.UUID, bugun: date) -> tuple[str, str, str] | None:
    """«Bugün» listesi için: bu geceki risk orta/yüksekse (öncelik, başlık, metin); düşükse None. Bildirim kapısından BAĞIMSIZ (uygulama içi)."""
    r = (await session.execute(text("SELECT seviye, en_soguk_c, kritik_c FROM don_risk WHERE garden_id = :g AND gece = :n"), {"g": garden_id, "n": bugun})).first()
    if r is None or r[0] == "yok":
        return None
    soz = risk.SOZ[r[0]]
    return ("kritik" if r[0] == "uyari" else "onemli", f"Bu gece don olasılığı: {soz}", f"En soğuk model tahmini {r[1]:.1f} °C (bu dönemde hassas organ için kritik ≈ {r[2]:.1f} °C). Uyarılarımız bilerek temkinlidir. Ayrıntı ve önlemler Durum ekranında.")


async def goreli_hucreler(session: AsyncSession, garden_id: uuid.UUID) -> dict[str, Any]:
    """Bahçe içi göreli soğuk hücreler (harita katmanı): yalnız koşul sağlanmışsa GeoJSON (30 m kareler); değilse pasif + neden."""
    r = (await session.execute(text("SELECT bahce_ici FROM bahce_topografya WHERE garden_id = :g"), {"g": garden_id})).scalar()
    if r is None:
        return {"uygun": False, "neden": "Topografya profili henüz hesaplanmadı.", "aciklama": None, "geojson": None, "hucre_sayisi": 0, "rolyef_m": None, "egim_ort_der": None, "rolyef_min_m": None, "egim_min_der": None}
    uygun = bool(r.get("uygun"))
    k = load_catalog().don
    return {"rolyef_min_m": k.rolyef_min_m, "egim_min_der": k.egim_min_der, "uygun": uygun, "neden": r.get("neden"), "aciklama": r.get("aciklama"), "geojson": topografya.hucreler_geojson(r) if uygun else None, "hucre_sayisi": len(r.get("hucreler", [])) if uygun else 0, "rolyef_m": r.get("rolyef_m"), "egim_ort_der": r.get("egim_ort_der")}


YANIT_AD = {"oldu": "oldu", "olmadi": "olmadı", "bilmiyorum": "bilmiyorum"}


async def geri_bildirim_yaz(session: AsyncSession, garden_id: uuid.UUID, gece: date, yanit: str, user_id: uuid.UUID | None) -> None:
    """«Don oldu mu?» yanıtı: `don_geri_bildirim` (9J kural performansı) + Saha Defteri'ne «gözlem» kaydı (aynı gece için tek kayıt, yanıt değişirse güncellenir)."""
    await session.execute(
        text("INSERT INTO don_geri_bildirim (garden_id, gece, yanit, created_by) VALUES (:g, :n, :y, :u) ON CONFLICT (garden_id, gece) DO UPDATE SET yanit = :y, created_by = :u, created_at = clock_timestamp()"),
        {"g": garden_id, "n": gece, "y": yanit, "u": user_id},
    )
    await session.execute(text("DELETE FROM field_records WHERE garden_id = :g AND tur = 'gozlem' AND ayrinti->>'konu' = 'don_uyarisi' AND ayrinti->>'gece' = :n"), {"g": garden_id, "n": gece.isoformat()})
    kayit_id = uuid.uuid4()
    await session.execute(
        text("INSERT INTO field_records (id, garden_id, tur, tarih, aciklama, ayrinti, created_by) VALUES (:i, :g, 'gozlem', :d, :a, CAST(:y AS jsonb), :u)"),
        {"i": kayit_id, "g": garden_id, "d": gece + timedelta(days=1), "a": f"Don uyarısı geri bildirimi ({gece:%d.%m.%Y} gecesi): {YANIT_AD[yanit]}", "y": json.dumps({"konu": "don_uyarisi", "gece": gece.isoformat(), "yanit": yanit}), "u": user_id},
    )
    from bahcelab_backend.domain.fieldbook import sistem

    await sistem.etiket_yaz(session, kayit_id, "don_yaniti", yanit, gece.isoformat())  # «oldu» → Çevre/fizyolojik · Don; «olmadı»/«bilmiyorum» etiketsiz (don_geri_bildirim'de kalır)
