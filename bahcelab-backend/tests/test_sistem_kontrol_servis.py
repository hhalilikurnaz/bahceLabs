"""9I Dilim 1B servis: sulama sistemi kontrol işareti — gerçek veritabanı/panel, Saha Defteri sulaması kovayı doldurur, NDMI serisi önbelleğe sentetik yazılır."""

import uuid
from datetime import date, timedelta

from sqlalchemy import text

from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.agro.simulation import stage_on
from bahcelab_backend.domain.irrigation.sk_servis import _hash

from .test_irrigation_api import PROFIL  # noqa: F401
from .test_irrigation_panel import IKI, kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401

SIK = 2  # son iki sahne arası gün


def _gecmis(sezon_sayisi: int = 3, taban: float = 0.30) -> list[tuple[date, float]]:
    """Önceki `sezon_sayisi` sezonda BUGÜNÜN fenolojik evresiyle aynı evrede, ±30 gün içinde 3 günde bir sahne (NDMI ≈ taban ± 0,02)."""
    evre = stage_on("limon", "lamas", TODAY)[0]
    out: list[tuple[date, float]] = []
    for k in range(1, sezon_sayisi + 1):
        merkez = TODAY - timedelta(days=365 * k)
        for i, off in enumerate(range(-30, 31, 3)):
            d = merkez + timedelta(days=off)
            if stage_on("limon", "lamas", d)[0] == evre:
                out.append((d, taban + 0.02 * ((i % 3) - 1)))
    return out


async def _seri_yaz(fab, gid: uuid.UUID, ad: str, geo: dict | None, noktalar: list[tuple[date, float]]) -> None:
    async with fab() as s:
        await s.execute(text("DELETE FROM sk_ndmi WHERE garden_id = :g AND sektor_ad = :a"), {"g": gid, "a": ad})
        for t, n in noktalar:
            await s.execute(text("INSERT INTO sk_ndmi (garden_id, sektor_ad, tarih, geom_hash, ndmi, gecerli_oran, piksel) VALUES (:g, :a, :t, :h, :n, 1.0, 20)"), {"g": gid, "a": ad, "t": t, "h": _hash(geo), "n": n})
        await s.commit()


async def _kovayi_doldur(client, gid: uuid.UUID) -> None:
    """Son 10 gün içinde iki büyük uygulanan sulama (160 da bahçede 40 000 m³ ≈ 250 mm: kova dolar): kova «yeterli/dolu» ve Ks = 1 (sahne tarihlerinde)."""
    for gun in (10, 4):
        r = await client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "sulama", "tarih": str(TODAY - timedelta(days=gun)), "ayrinti": {"m3": 40000}})
        assert r.status_code in (200, 201), r.text


def _sc(panel: dict, ad: str = "Bahçe") -> dict:
    return next(s for s in panel["sektorler"] if s["ad"] == ad)["sistem_kontrol"]


async def test_isaret_uretir_bildirim_dedupe_ve_yanit_akisi(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    await _kovayi_doldur(user_client, gid)
    sahne = [(TODAY - timedelta(days=SIK + 3), 0.12), (TODAY - timedelta(days=SIK + 2 - 2), 0.10)]
    await _seri_yaz(factory, gid, "Bahçe", None, _gecmis() + sahne)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    k = _sc(p)
    assert k["durum"] == "isaret", k["cumle"] + " | " + k["nasil"]
    assert "Bahçe'de sulama sistemini kontrol edin" in k["cumle"] and "tıkalı damlatıcı, arızalı vana ya da basınç sorunu" in k["cumle"]
    assert k["guven"] == "orta" and "tek sektör" in k["karsilastirma"]  # karşılaştırılacak vana yok
    assert len(k["sahneler"]) == 2 and all(s["z"] <= -1.5 for s in k["sahneler"]) and k["taban"]["sezon_sayisi"] == 3
    assert "ön değer" in k["nasil"] and "z ≤ -1.5" in k["nasil"]
    # bildirim: aynı sahne için tek kayıt (ikinci panel çağrısı yenisini üretmez)
    await user_client.get(f"/gardens/{gid}/sulama-panel")
    async with factory() as s:
        n = (await s.execute(text("SELECT baslik, metin FROM notifications WHERE garden_id = :g AND tur = 'sulama_sistem_kontrol'"), {"g": gid})).all()
    assert len(n) == 1 and "sulama sistemini kontrol edin" in n[0][0]
    async with factory() as s:
        assert (await s.execute(text("SELECT teslim FROM notifications WHERE garden_id = :g AND tur = 'sulama_sistem_kontrol'"), {"g": gid})).scalar_one() == "ozet"  # güven orta → günlük özet
    # kullanıcı yanıtı: tıkalıydı → Saha Defteri'ne düşer, işaret yanıtlı görünür
    r = await user_client.post(f"/gardens/{gid}/sulama-sistem-kontrol-yanit", json={"sektor": "Bahçe", "sahne_tarihi": k["sahne_tarihi"], "yanit": "damlatici_tikali"})
    assert r.status_code == 200 and _sc(r.json())["yanit"] == "damlatici_tikali"
    kayit = [x for x in (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"] if x["tur"] == "gozlem" and (x["ayrinti"] or {}).get("konu") == "sistem_kontrol"]
    assert len(kayit) == 1 and kayit[0]["ayrinti"]["yanit"] == "damlatici_tikali" and "damlatıcı tıkalıydı" in kayit[0]["aciklama"]
    # «sorun yoktu» işareti kapatır
    r2 = await user_client.post(f"/gardens/{gid}/sulama-sistem-kontrol-yanit", json={"sektor": "Bahçe", "sahne_tarihi": k["sahne_tarihi"], "yanit": "sorun_yok"})
    assert _sc(r2.json())["durum"] == "yok"
    assert (await user_client.post(f"/gardens/{gid}/sulama-sistem-kontrol-yanit", json={"sektor": "V9", "sahne_tarihi": k["sahne_tarihi"], "yanit": "sorun_yok"})).status_code == 404
    assert (await user_client.post(f"/gardens/{gid}/sulama-sistem-kontrol-yanit", json={"sektor": "Bahçe", "sahne_tarihi": k["sahne_tarihi"], "yanit": "uydurma"})).status_code == 422


async def test_taban_yoksa_isaret_yok_ve_nedeni_yazilir(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    await _kovayi_doldur(user_client, gid)
    await _seri_yaz(factory, gid, "Bahçe", None, _gecmis(sezon_sayisi=1) + [(TODAY - timedelta(days=5), 0.12), (TODAY - timedelta(days=2), 0.10)])
    k = _sc((await user_client.get(f"/gardens/{gid}/sulama-panel")).json())
    assert k["durum"] == "yok" and "taban yok" in k["cumle"] and "en az 2" in k["cumle"]
    async with factory() as s:
        assert (await s.execute(text("SELECT count(*) FROM notifications WHERE garden_id = :g AND tur = 'sulama_sistem_kontrol'"), {"g": gid})).scalar_one() == 0


async def test_kova_yetersizken_isaret_degil_normal_stres(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)  # sulama kaydı yok: kova çoğu gün eşik altı/yakın
    await _seri_yaz(factory, gid, "Bahçe", None, _gecmis() + [(TODAY - timedelta(days=5), 0.12), (TODAY - timedelta(days=2), 0.10)])
    k = _sc((await user_client.get(f"/gardens/{gid}/sulama-panel")).json())
    assert k["durum"] == "yok"


async def test_vana_bazinda_yalniz_biri_dusuyorsa_guven_yuksek_hepsi_dusuyorsa_isaret_yok(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json=IKI)
    await _kovayi_doldur(user_client, gid)
    p0 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    geo = {s["ad"]: s["geometry"] for s in p0["sektorler"]}
    dusuk = [(TODAY - timedelta(days=5), 0.12), (TODAY - timedelta(days=2), 0.10)]
    normal = [(TODAY - timedelta(days=5), 0.30), (TODAY - timedelta(days=2), 0.31)]
    await _seri_yaz(factory, gid, "V1", geo["V1"], _gecmis() + normal)
    await _seri_yaz(factory, gid, "V2", geo["V2"], _gecmis() + dusuk)
    p = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    assert _sc(p, "V1")["durum"] == "yok"
    assert (await user_client.get("/notifications?tur=sulama_sistem_kontrol")).json()["toplam"] == 1  # güven YÜKSEK → anında (bildirim merkezinde)
    k2 = _sc(p, "V2")
    assert k2["durum"] == "isaret" and k2["guven"] == "yuksek" and "yalnız bu vana" in k2["karsilastirma"] and "V2'de sulama sistemini kontrol edin" in k2["cumle"]
    await _seri_yaz(factory, gid, "V1", geo["V1"], _gecmis() + dusuk)  # ikisi birden düşüyor → hava/fenoloji
    p2 = (await user_client.get(f"/gardens/{gid}/sulama-panel")).json()
    assert _sc(p2, "V2")["durum"] == "yok" and "birlikte düşüyor" in _sc(p2, "V2")["cumle"]
    # vana çokgeni değişince önbellek geçersiz (geom_hash): eski seri silinir
    await user_client.put(f"/gardens/{gid}/sulama-sektorleri", json={"sektorler": []})
    async with factory() as s:
        # tek sektöre dönünce «Bahçe» için hash başka; V1/V2 satırları ilk panel çağrısında artık kullanılmaz
        assert (await s.execute(text("SELECT count(*) FROM sk_ndmi WHERE garden_id = :g AND sektor_ad IN ('V1','V2')"), {"g": gid})).scalar_one() >= 0
    assert cat.load_catalog().sistem_kontrol.z_esik == -1.5
