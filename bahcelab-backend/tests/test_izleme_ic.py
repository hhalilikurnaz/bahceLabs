"""9J Dilim 2 iç izleme uç noktaları (/ic/izleme/*): yalnız iç ekip; seriler gerçek anlık görüntülerden; güven etiketi kullanıcı ekranlarıyla AYNI servisten."""

from datetime import date

from sqlalchemy import text

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.izleme import guven, isler

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401

YOLLAR = ["/ic/izleme/akislar", "/ic/izleme/uyum", "/ic/izleme/kurallar", "/ic/izleme/bahceler"]


async def test_yalniz_ic_ekip(user_client, monkeypatch):  # noqa: F811
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", "")
    for y in YOLLAR:
        assert (await user_client.get(y)).status_code == 403
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    for y in YOLLAR:
        assert (await user_client.get(y)).status_code == 200


async def test_akis_uyum_kural_ve_bahce_guveni(user_client, factory, monkeypatch):  # noqa: F811
    gid = await kur(user_client, factory)
    me = (await user_client.get("/auth/me")).json()
    monkeypatch.setattr(get_settings(), "internal_emails", me["email"])
    await isler.gunluk(factory, TODAY)
    await isler.haftalik(factory, TODAY, agdan=False)

    a = (await user_client.get("/ic/izleme/akislar")).json()
    assert len(a["guncel"]) == 11 and {x["durum"] for x in a["guncel"]} <= {"taze", "gecikmeli", "kopuk", "bos"}
    assert {z["akis"] for z in a["zaman"]} == {x["akis"] for x in a["guncel"]} and all(z["tarih"] == TODAY.isoformat() for z in a["zaman"])

    u = (await user_client.get("/ic/izleme/uyum")).json()
    k = {s["kontrol"]: s for s in u["seriler"] if s["garden_id"] == str(gid)}
    assert k["era5_imerg_aylik"]["son_durum"] == "yetersiz" and k["olcer_era5"]["noktalar"][0]["deger"] is None  # veri yok: uydurulmaz

    r = (await user_client.get("/ic/izleme/kurallar")).json()
    assert {o["kural"] for o in r["ozet"]} >= {"sistem_kontrol", "don"} and all(o["durum"] in ("olculuyor", "olculemiyor") for o in r["ozet"])

    b = (await user_client.get("/ic/izleme/bahceler")).json()
    assert b["toplam_bahce"] == 1 and sum(b["dagilim"].values()) == 1
    # tek güven servisi: iç ekran etiketi, doğrudan guven.topla çıktısıyla birebir aynı (ayrı eşik/hesap yok)
    async with factory() as s:
        g = await guven.topla(s, gid, b["bugun"] and date.fromisoformat(b["bugun"]), "durum", agac_beyan=True)
    assert b["en_dusuk"][0]["etiket"] == g.etiket and b["en_dusuk"][0]["nedeni"] == g.nedeni
    async with factory() as s:
        assert (await s.execute(text("SELECT count(*) FROM izleme_akis WHERE tarih = :t"), {"t": TODAY})).scalar() == 11
