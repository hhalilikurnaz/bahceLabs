"""ALTIN BAHÇE (9J-6, ADR 0030): jlnnlk'in DONMUŞ girdileriyle (tests/golden/jlnnlk_girdi.json; sabit tarih BUGÜN = 2026-10-09) kova/plan, sistem kontrol işareti ve güven çıktılarının
snapshot'ı. Çıktı eşikten fazla değişirse test KIRMIZI olur: model kayması koda yakalanır. Değişiklik BİLİNÇLİYSE snapshot şöyle güncellenir ve gerekçeli commit'le gönderilir:
    ALTIN_GUNCELLE=1 PYTHONPATH=src .venv/bin/python -m pytest tests/test_altin_bahce.py -q
(commit mesajı: «golden: <ne değişti ve neden>»). Girdi dosyasını yenilemek için scripts/altin_bahce_uret.py."""

import gzip
import json
import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.irrigation.service import IrrigationService
from bahcelab_backend.domain.izleme import guven as gv
from bahcelab_backend.domain.water.era5_sync import garden_cell

from .test_gardens_api import garden_body
from .test_water_api import factory, user_client  # noqa: F401

GIRDI = Path(__file__).parent / "golden" / "jlnnlk_girdi.json.gz"
BEKLENEN = Path(__file__).parent / "golden" / "jlnnlk_beklenen.json"
PROFIL = {"sistem": "damla", "damlatici_sayisi": 4, "damlatici_debi_lh": 4.0, "sira_aralik_m": 5.0, "agac_aralik_m": 4.0, "pompa_kw": 7.5, "pompa_debi_m3h": 40.0, "enerji": "sebeke"}
TOL_PCT = 0.6  # % birimli değerler (doluluk, ihtiyaç karşılandı) için mutlak tolerans
TOL_REL = 0.02  # diğer sayılar için göreli tolerans (≥ 1 değer) ya da 0,02 mutlak


async def _yukle(client, fab) -> tuple[uuid.UUID, uuid.UUID, dict]:  # noqa: ANN001
    v = json.loads(gzip.decompress(GIRDI.read_bytes()))
    b = v["bahce"]
    r = await client.post("/gardens", json=garden_body(ad=b["ad"], geometry=b["geometry"], il=b["il"], ilce=b["ilce"], urun=b["urun"], cesit=b["cesit"]))
    assert r.status_code == 201, r.text
    gid = uuid.UUID(r.json()["id"])
    async with fab() as s:
        cell, _, _ = await garden_cell(s, gid)
        await s.execute(text("DELETE FROM era5_daily WHERE cell_id = :c"), {"c": cell})
        await s.execute(text("DELETE FROM veri_bayrak WHERE kaynak = 'era5' AND anahtar = :c"), {"c": str(cell)})  # önceki testlerden kalan bayrak golden'ı etkilemesin
        await s.execute(text("DELETE FROM izleme_uyum WHERE garden_id IS NULL"))
        await s.execute(text("INSERT INTO era5_daily (cell_id, tarih, sm0, sm1, sm2, sm3, et0_mm, yagis_mm, t_ort, t_min, t_max, toprak_kaynak, hava_kaynak, saatlik) VALUES (:c, :tarih, :sm0, :sm1, :sm2, :sm3, :et0_mm, :yagis_mm, :t_ort, :t_min, :t_max, :toprak_kaynak, :hava_kaynak, '{}'::jsonb)"), [{"c": cell, **{k: (date.fromisoformat(x) if k == "tarih" else x) for k, x in d.items()}} for d in v["era5"]])
        so = v["soil"]
        await s.execute(text("INSERT INTO soil_profiles (garden_id, kum_yuzde, kil_yuzde, silt_yuzde, organik_karbon_g_kg, tarla_kapasitesi, solma_noktasi, kaynak) VALUES (:g, :kum_yuzde, :kil_yuzde, :silt_yuzde, :organik_karbon_g_kg, :tarla_kapasitesi, :solma_noktasi, :kaynak) ON CONFLICT (garden_id) DO UPDATE SET kum_yuzde = EXCLUDED.kum_yuzde, kil_yuzde = EXCLUDED.kil_yuzde, silt_yuzde = EXCLUDED.silt_yuzde, organik_karbon_g_kg = EXCLUDED.organik_karbon_g_kg, tarla_kapasitesi = EXCLUDED.tarla_kapasitesi, solma_noktasi = EXCLUDED.solma_noktasi"), {"g": gid, **so})
        for a in v["acquisitions"]:
            aid = uuid.uuid4()
            await s.execute(text("INSERT INTO acquisitions (id, garden_id, source_id, scene_id, tarih, durum, gecerli_oran) VALUES (:i, :g, 'sentinel2-l2a', :s, :t, 'net', :o)"), {"i": aid, "g": gid, "s": f"{a['scene_id']}-{aid}"[:120], "t": date.fromisoformat(a["tarih"]), "o": a["gecerli_oran"]})
            await s.execute(text("INSERT INTO acquisition_stats (acquisition_id, indeks, ortalama, medyan, p10, p25, p75, p90, minimum, maksimum, gecerli_piksel) VALUES (:i, 'ndvi', :v, :v, :v, :v, :v, :v, :v, :v, 150)"), {"i": aid, "v": a["ndvi"]})
        for x in v["sk_ndmi"]:
            await s.execute(text("INSERT INTO sk_ndmi (garden_id, sektor_ad, tarih, geom_hash, ndmi, gecerli_oran, piksel) VALUES (:g, 'Bahçe', :t, 'bahce', :n, :o, :p)"), {"g": gid, "t": date.fromisoformat(x["tarih"]), "n": x["ndmi"], "o": x["gecerli_oran"], "p": x["piksel"]})
        for x in v["sk_halka"]:
            await s.execute(text("INSERT INTO sk_halka (garden_id, tarih, geom_hash, ndmi, ndvi, piksel, halka_piksel) VALUES (:g, :t, 'x', :n, :v, :p, :h)"), {"g": gid, "t": date.fromisoformat(x["tarih"]), "n": x["ndmi"], "v": x["ndvi"], "p": x["piksel"], "h": x["halka_piksel"]})
        await s.execute(text("INSERT INTO dogrulama_gozlem (garden_id, source_id, indeks, tarih, deger, guncelleme) VALUES (:g, 'imerg-daily', 'yagis_mm', :t, :d, now())"), [{"g": gid, "t": date.fromisoformat(x["tarih"]), "d": x["deger"]} for x in v["imerg"]])
        await s.execute(text("UPDATE gardens SET agac_sayisi = 800, dikim_yili = :y WHERE id = :g"), {"g": gid, "y": v["bahce"]["dikim_yili"]})
        await s.commit()
    assert (await client.put(f"/gardens/{gid}/sulama-profili", json=PROFIL)).status_code == 200
    me = (await client.get("/auth/me")).json()
    return gid, uuid.UUID(me["workspace_id"]), v


async def _cikti(fab, gid: uuid.UUID, ws: uuid.UUID, bugun: date) -> dict:  # noqa: ANN001
    async with fab() as s:
        svc = IrrigationService(s, ws, today=bugun)
        p = await svc.panel(gid)
        plan = await svc.plan(gid)
        sektor = p.sektorler[0]
        sk = sektor.sistem_kontrol
        guv = await gv.topla(s, gid, bugun, "sulama", ndvi_tarih=None, agac_beyan=True, profil_tam=True)
        return {
            "kova": {"doluluk_pct": sektor.doluluk_pct, "etiket": sektor.etiket, "sonraki_sulama": str(sektor.sonraki_sulama), "stres_7g": sektor.stres_7g, "fazla_su_7g_mm": sektor.fazla_su_7g_mm, "taw_mm": p.taw_mm, "raw_mm": p.raw_mm, "tetik_pct": p.tetik_pct},
            "kc": None if sektor.kc is None else {"kaynak": sektor.kc.kaynak, "orten_yuzde": sektor.kc.orten_yuzde, "kc_bugun": sektor.kc.kc_bugun},
            "plan": {"durum": plan.durum, "ilk_sulamalar": [{"tarih": str(x.tarih), "brut_mm": x.brut_mm} for x in plan.sulamalar[:5]], "sezon_planlanan_m3": plan.planlanan_bugune_kadar_m3},
            "panel_kpi": {"ihtiyac_karsilandi_pct": p.kpi.ihtiyac_karsilandi_pct if p.kpi else None, "sonraki": None if not p.kpi or not p.kpi.sonraki else str(p.kpi.sonraki.tarih)},
            "sistem_kontrol": None if sk is None else {"durum": sk.durum, "guven": sk.guven, "cumle": sk.cumle[:120], "halka_durum": None if sk.halka is None else sk.halka.durum, "z": [round(x.z, 2) for x in sk.sahneler]},
            "guven": {"etiket": guv.etiket, "puan": guv.puan, "toplam": guv.toplam, "kosullar": [{"ad": c.ad, "ok": c.ok} for c in guv.kosullar]},
        }


def _farklar(yeni: object, eski: object, yol: str = "") -> list[str]:
    if isinstance(eski, dict) and isinstance(yeni, dict):
        out = []
        for k in sorted(set(eski) | set(yeni)):
            out += _farklar(yeni.get(k, "<yok>"), eski.get(k, "<yok>"), f"{yol}.{k}" if yol else k)
        return out
    if isinstance(eski, list) and isinstance(yeni, list):
        if len(eski) != len(yeni):
            return [f"{yol}: eleman sayısı {len(eski)} → {len(yeni)}"]
        return [f for a, b in zip(yeni, eski, strict=True) for f in _farklar(a, b, yol + "[]")]
    if isinstance(eski, (int, float)) and isinstance(yeni, (int, float)) and not isinstance(eski, bool):
        tol = TOL_PCT if any(a in yol for a in ("pct", "doluluk")) else max(0.02, abs(eski) * TOL_REL)
        return [] if abs(yeni - eski) <= tol else [f"{yol}: {eski} → {yeni} (tolerans {tol:.3g})"]
    return [] if yeni == eski else [f"{yol}: {eski!r} → {yeni!r}"]


async def test_altin_bahce_cikti_snapshot(user_client, factory):  # noqa: F811
    gid, ws, v = await _yukle(user_client, factory)
    bugun = date.fromisoformat(v["bugun"])
    cikti = await _cikti(factory, gid, ws, bugun)
    assert load_catalog().surum >= 2
    if os.environ.get("ALTIN_GUNCELLE") == "1":
        BEKLENEN.write_text(json.dumps(cikti, indent=1, ensure_ascii=False, sort_keys=True) + "\n")
        pytest.skip("snapshot güncellendi (gerekçeli commit gerekir)")
    assert BEKLENEN.exists(), "snapshot yok: ALTIN_GUNCELLE=1 ile üretin"
    eski = json.loads(BEKLENEN.read_text())
    fark = _farklar(json.loads(json.dumps(cikti, default=str)), eski)
    assert not fark, "ALTIN BAHÇE ÇIKTISI DEĞİŞTİ (model kayması?):\n  " + "\n  ".join(fark) + "\nBilinçli değişiklikse: ALTIN_GUNCELLE=1 ile snapshot'ı güncelleyin ve gerekçeli commit atın."


async def test_altin_bahce_karsilastirici_esik_ve_kirmizi_kural():
    eski = {"kova": {"doluluk_pct": 80.0, "stres_7g": 0}, "guven": {"etiket": "yuksek"}, "sk": {"z": [1.0, 2.0]}}
    assert _farklar({"kova": {"doluluk_pct": 80.4, "stres_7g": 0}, "guven": {"etiket": "yuksek"}, "sk": {"z": [1.01, 2.0]}}, eski) == []  # eşik içi: yeşil
    fark = _farklar({"kova": {"doluluk_pct": 83.0, "stres_7g": 2}, "guven": {"etiket": "orta"}, "sk": {"z": [1.0, 2.0, 3.0]}}, eski)
    assert len(fark) == 4 and any("doluluk_pct" in f for f in fark) and any("etiket" in f for f in fark) and any("eleman sayısı" in f for f in fark)  # eşik dışı: kırmızı


DON_GIRDI = Path(__file__).parent / "golden" / "jlnnlk_don_girdi.json.gz"
DON_BEKLENEN = Path(__file__).parent / "golden" / "jlnnlk_don_beklenen.json"


def _don_cikti() -> dict:
    """ADIM 10 (ADR 0031): jlnnlk'in DONMUŞ DEM'i (Copernicus GLO-30, 3 km) ve Şubat 2025 gecelerinin 3 model SAATLİK tahmini (Open-Meteo historical-forecast; gerçek veri) → topografya profili,
    bahçe içi göreli soğuk nokta kararı ve gece don seviyeleri. Ağ yok."""
    import numpy as np
    from pyproj import Transformer
    from shapely.geometry import shape
    from shapely.ops import transform as shp_transform

    from bahcelab_backend.domain.agro.simulation import stage_on
    from bahcelab_backend.domain.don import risk, topografya
    from bahcelab_backend.domain.don.risk import SaatlikModel

    d = json.loads(gzip.decompress(DON_GIRDI.read_bytes()))
    v = json.loads(gzip.decompress(GIRDI.read_bytes()))
    kural = load_catalog().don
    dem = d["dem"]
    pencere = topografya.Pencere((np.array(dem["z_dm"], dtype="float32") / 10.0).reshape(dem["satir"], dem["sutun"]), dem["x0"], dem["y0"], dem["epsg"])
    poligon = shp_transform(Transformer.from_crs(4326, dem["epsg"], always_xy=True).transform, shape(v["bahce"]["geometry"]))
    topo = topografya.hesapla_saf(pencere, poligon, kural)
    t = d["tahmin"]
    modeller = [SaatlikModel(m, t["zaman"], x["t2m"], x["bulut"], x["ruzgar"]) for m, x in t["modeller"].items()]
    geceler = []
    for i in range(6):
        gece = date(2025, 2, 20) + timedelta(days=i)
        evre, _ = stage_on("limon", "lamas", gece + timedelta(days=1))
        kr = risk.kritik_sicaklik(evre, kural)
        assert kr is not None
        o = risk.gece_ozeti(modeller, gece, kr[0], kural)
        assert o is not None
        k = risk.karar(o, kr[0], kural)
        geceler.append({"gece": str(gece), "evre": evre, "kritik_c": kr[0], "en_soguk_c": o.en_soguk_c, "model_tmin": o.tmin_model, "uzlasi_model": o.kac_model_uzlasi, "seviye": k.seviye, "soz": k.soz})
    return {"topografya": topo, "geceler": geceler, "kural_surum": kural.surum}


def test_altin_bahce_don_snapshot():
    cikti = _don_cikti()
    if os.environ.get("ALTIN_GUNCELLE") == "1":
        DON_BEKLENEN.write_text(json.dumps(cikti, indent=1, ensure_ascii=False, sort_keys=True) + "\n")
        pytest.skip("don snapshot güncellendi (gerekçeli commit gerekir)")
    assert DON_BEKLENEN.exists(), "don snapshot yok: ALTIN_GUNCELLE=1 ile üretin"
    fark = _farklar(json.loads(json.dumps(cikti, default=str)), json.loads(DON_BEKLENEN.read_text()))
    assert not fark, "ALTIN BAHÇE DON ÇIKTISI DEĞİŞTİ:\n  " + "\n  ".join(fark)
    # bahçe içi göreli soğuk nokta: bu düz kıyı bahçesinde ÜRETİLMEZ ve nedeni yazılır
    assert cikti["topografya"]["bahce_ici"]["uygun"] is False and "yükseklik farkı" in cikti["topografya"]["bahce_ici"]["neden"]


def _tur(_: timedelta) -> None:  # tür bütünlüğü
    return None
