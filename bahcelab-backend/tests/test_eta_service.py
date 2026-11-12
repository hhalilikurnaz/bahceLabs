"""9I Dilim 1A servis: sentetik Landsat sahneleri (gerçek hesap, sahte sağlayıcı) → c-faktörü, ETf, tutarlılık kapısı. Ağ yok (ERA5/Meteostat yamalı)."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import numpy as np
import pytest
from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.eta import meteo
from bahcelab_backend.domain.eta.provider import (
    SahneRef,
    TermalSahne,
)
from bahcelab_backend.domain.eta.service import EtaService, sahne_olcumu

from .support.fake_eta import H, SahteBaglam, SahteDogrulama, SahteTermal, W, sahte_meteo
from .test_multiyear_api import factory, new_garden, user_client  # noqa: F401  (fikstürler)


def _haftalik(hedefler: list[float], bas: date = date(2025, 6, 2)) -> dict[date, float]:
    return {bas + timedelta(days=7 * i): h for i, h in enumerate(hedefler)}


@pytest.fixture
def yama(monkeypatch):
    monkeypatch.setattr(meteo, "era5_gunluk", lambda lat, lon, bas, bit, **k: sahte_meteo(bas, bit))
    monkeypatch.setattr(meteo, "meteostat_gunluk", lambda kod, **k: {})
    return None


async def _coz(factory, user_client, hedefler, *, gecerli=1.0, min_alan=1.0):  # noqa: F811
    g = await new_garden(user_client)
    gid = uuid.UUID(g["id"])
    kural = load_catalog().eta_ic.model_copy(update={"kullanici_min_alan_dekar": min_alan})
    async with factory() as session:
        svc = EtaService(session, termal=SahteTermal(hedefler, 36.66, gecerli), baglam=SahteBaglam(), dogrulama=SahteDogrulama(), kural=kural)
        bas, bit = min(hedefler) - timedelta(days=3), max(hedefler) + timedelta(days=3)
        aranan, yazilan = await svc.olc(gid, bas, bit)
        ozet = await svc.hesapla(gid)
        await session.commit()
    return gid, aranan, yazilan, ozet


async def test_tutarli_seri_kapiyi_acar_ve_etf_hedefi_geri_verir(user_client, factory, yama):  # noqa: F811
    hedef = _haftalik([0.50, 0.52, 0.48, 0.51, 0.49, 0.50, 0.53, 0.47, 0.50, 0.51, 0.49, 0.50, 0.52, 0.48, 0.50, 0.51, 0.49, 0.50])  # 18 haftalık sezon (her ay penceresi ≥ 8 sahne)
    gid, aranan, yazilan, ozet = await _coz(factory, user_client, hedef)
    assert (aranan, yazilan) == (18, 18) and ozet.hesaplanan == 18 and ozet.elenen == 0
    assert ozet.kapi == "acik", ozet.neden
    async with factory() as s:
        r = (await s.execute(text("SELECT etf, etf_ic, eta_mm, et0_mm, c_uzun, c_sahne, karisik_pay, bahce_piksel, ic_piksel, etf_sigma, tc_k FROM eta_sahneler WHERE garden_id=:g ORDER BY tarih"), {"g": gid})).mappings().all()
        d = (await s.execute(text("SELECT * FROM eta_durum WHERE garden_id=:g"), {"g": gid})).mappings().one()
    for x, h in zip(r, hedef.values(), strict=True):
        assert x["etf"] == pytest.approx(h, abs=0.03)  # c = 1,02 sabit → uzun dönem c de 1,02 → ETf hedefe döner
        assert x["c_uzun"] == pytest.approx(1.02, abs=1e-6) and x["c_sahne"] == pytest.approx(1.02, abs=1e-6)
        assert x["eta_mm"] == pytest.approx(x["etf"] * x["et0_mm"]) and x["et0_mm"] == 5.0
        assert x["bahce_piksel"] == 400 and x["ic_piksel"] == 256 and x["karisik_pay"] == pytest.approx(1 - 256 / 400)
        assert x["etf_sigma"] > 0 and x["etf_ic"] is not None
    assert d["kapi"] == "acik" and d["cift_sayisi"] >= 8 and d["tutarlilik_p90"] <= 0.15


async def test_tutarsiz_seri_kapiyi_kapali_tutar(user_client, factory, yama):  # noqa: F811
    hedef = _haftalik([0.3, 0.7] * 9)  # Dilim 0'daki 0,33 ↔ 0,90 türü sıçrama
    _, _, _, ozet = await _coz(factory, user_client, hedef)
    assert ozet.kapi == "kapali" and "> eşik" in ozet.neden


async def test_alan_alt_siniri_kapiyi_kapali_tutar_tutarli_olsa_bile(user_client, factory, yama):  # noqa: F811
    hedef = _haftalik([0.5] * 18)
    _, _, _, ozet = await _coz(factory, user_client, hedef, min_alan=500.0)  # test bahçesi 160 da
    assert ozet.kapi == "kapali" and "kullanıcıya açılma alt sınırı" in ozet.neden and "≤" in ozet.neden


async def test_bulutlu_sahneler_elenir_nedeniyle(user_client, factory, yama):  # noqa: F811
    hedef = _haftalik([0.5] * 10)
    gid, _, _, ozet = await _coz(factory, user_client, hedef, gecerli=0.2)
    assert ozet.hesaplanan == 0 and ozet.elenen == 10 and ozet.kapi == "kapali"
    async with factory() as s:
        n = (await s.execute(text("SELECT neden FROM eta_sahneler WHERE garden_id=:g LIMIT 1"), {"g": gid})).scalar_one()
    assert "geçerli piksel oranı" in n


async def test_yetersiz_sahne_c_faktoru_uydurulmaz(user_client, factory, yama):  # noqa: F811
    hedef = _haftalik([0.5, 0.5, 0.5])  # c_min_sahne = 8
    _, _, _, ozet = await _coz(factory, user_client, hedef)
    assert ozet.hesaplanan == 0 and ozet.kapi == "kapali"


async def test_baglam_ve_dogrulama_saklanir_kullaniciya_donmez(user_client, factory, yama):  # noqa: F811
    hedef = _haftalik([0.5] * 10)
    gid, *_ = await _coz(factory, user_client, hedef)
    async with factory() as s:
        b = (await s.execute(text("SELECT kaynak, et_mm_gun, piksel_m FROM eta_baglam WHERE garden_id=:g"), {"g": gid})).mappings().all()
        d = (await s.execute(text("SELECT kaynak, et_mm_gun FROM eta_dogrulama WHERE garden_id=:g"), {"g": gid})).mappings().all()
    assert [x["kaynak"] for x in b] == ["wapor-l1"] and b[0]["et_mm_gun"] == 2.5
    assert [x["kaynak"] for x in d] == ["ecostress-v003"]
    # kullanıcı uç noktalarında ETa yok (iç kalite): panel yanıtında 'eta' alanı bulunmaz
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    assert "eta" not in json_str(p)


def json_str(x: object) -> str:
    import json

    return json.dumps(x)


def test_sahne_olcumu_soguk_referans_kurali():
    kural = load_catalog().eta_ic
    lst = np.full((H, W), 300.0)
    ndvi = np.full((H, W), 0.8)
    bahce = np.zeros((H, W), dtype=bool)
    bahce[20:40, 20:40] = True
    ndvi[bahce] = 0.6
    ref = SahneRef(date(2025, 7, 1), "X", "landsat-9")
    s = TermalSahne(ref, 100.0, lst, None, ndvi, np.ones((H, W), dtype=bool), np.full((H, W), 45.0), bahce, bahce.copy(), 30.0)
    o = sahne_olcumu(s, kural)
    assert o["n_soguk"] == H * W - 400 and o["tc_soguk_k"] == 300.0 and o["sigma_lst_k"] is None
    # rakım toleransı dışındaki soğuk piksel sayılmaz
    dem = np.full((H, W), 45.0)
    dem[:, :30] = 400.0
    s2 = TermalSahne(ref, 100.0, lst, None, ndvi, np.ones((H, W), dtype=bool), dem, bahce, bahce.copy(), 30.0)
    assert sahne_olcumu(s2, kural)["n_soguk"] < H * W - 400
    # az soğuk piksel → referans yok (uydurma yok)
    ndvi2 = np.full((H, W), 0.3)
    s3 = TermalSahne(ref, 100.0, lst, None, ndvi2, np.ones((H, W), dtype=bool), np.full((H, W), 45.0), bahce, bahce.copy(), 30.0)
    assert sahne_olcumu(s3, kural)["tc_soguk_k"] is None


# ---------------------------------------------------------------- iç kalite uç noktası (yalnız iç ekip)
async def test_ic_uc_nokta_yalniz_ic_ekip_ve_kullanici_panelinde_eta_yok(user_client, factory, yama, monkeypatch):  # noqa: F811
    from bahcelab_backend.config import get_settings

    hedef = _haftalik([0.5] * 18)
    gid, *_ = await _coz(factory, user_client, hedef)
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", "")
    assert (await user_client.get("/ic/eta/bahceler")).status_code == 403  # boş liste: kimse erişemez
    monkeypatch.setattr(get_settings(), "internal_emails", f"baska@x.com, {me['email']}")
    ozet = (await user_client.get("/ic/eta/bahceler")).json()
    assert [o["garden_id"] for o in ozet] == [str(gid)] and ozet[0]["kapi"] in ("acik", "kapali") and ozet[0]["hesaplanan"] == 18
    d = (await user_client.get(f"/ic/eta/bahceler/{gid}")).json()
    assert len(d["sahneler"]) == 18 and d["sahneler"][1]["delta_etf"] is not None and d["baglam"][0]["kaynak" if False else "piksel_m"] == 262.0
    assert any(k["tur"] == "c_faktoru" for k in d["kalibrasyon"]) and d["notlar"]
    assert (await user_client.get(f"/ic/eta/bahceler/{uuid.uuid4()}")).status_code == 404
