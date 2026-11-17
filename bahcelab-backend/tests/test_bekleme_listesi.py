import pytest
from httpx import AsyncClient
from sqlalchemy import text

from bahcelab_backend.api.bekleme.router import get_bekleme_limiter
from bahcelab_backend.config import get_settings
from bahcelab_backend.shared.rate_limit import SlidingWindowLimiter

from .conftest import TEST_EMAIL_DOMAIN, unique_email


@pytest.fixture(autouse=True)
async def temiz(test_engine):
    s = get_settings()
    onceki = (s.kvkk_taslak, s.api_debug)
    s.kvkk_taslak = False  # taslak kapısı kendi testlerinde açılır
    get_bekleme_limiter().reset()
    yield
    s.kvkk_taslak, s.api_debug = onceki
    async with test_engine.begin() as conn:
        await conn.execute(text("DELETE FROM bekleme_listesi WHERE email LIKE :p"), {"p": f"%{TEST_EMAIL_DOMAIN}"})
    get_bekleme_limiter().reset()


def govde(email: str | None = None, **ek):
    return {"email": email or unique_email(), "il": "Mersin", "urun": "limon", "riza": True, **ek}


async def satirlar(test_engine, email: str):
    async with test_engine.connect() as conn:
        return (await conn.execute(text("SELECT email, il, urun, aydinlatma_surumu, riza_zamani FROM bekleme_listesi WHERE email = :e"), {"e": email})).all()


@pytest.mark.asyncio
@pytest.mark.integration
async def test_basvuru_kaydedilir_ve_eposta_kucuk_harfe_cevrilir(client: AsyncClient, test_engine):
    email = unique_email()
    r = await client.post("/bekleme-listesi", json=govde(email.upper(), il="  Mersin  "))
    assert r.status_code == 201
    assert r.json() == {"kayit": "alindi"}
    (satir,) = await satirlar(test_engine, email)
    assert satir.il == "Mersin"
    assert satir.urun == "limon"
    assert satir.aydinlatma_surumu == "2026-11"
    assert satir.riza_zamani is not None


@pytest.mark.asyncio
@pytest.mark.integration
async def test_ayni_eposta_ikinci_kez_yazilmaz_ve_yanit_ayni(client: AsyncClient, test_engine):
    email = unique_email()
    ilk = await client.post("/bekleme-listesi", json=govde(email, il="Mersin"))
    ikinci = await client.post("/bekleme-listesi", json=govde(email.upper(), il="Adana", urun="portakal"))
    assert ilk.status_code == ikinci.status_code == 201
    assert ilk.json() == ikinci.json()  # e-posta listesi yoklanamaz
    (satir,) = await satirlar(test_engine, email)
    assert (satir.il, satir.urun) == ("Mersin", "limon")  # ilk kayıt korunur


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize("riza", [False, None])
async def test_riza_olmadan_kayit_alinmaz(client: AsyncClient, test_engine, riza):
    email = unique_email()
    govdesi = govde(email)
    if riza is None:
        del govdesi["riza"]
    else:
        govdesi["riza"] = riza
    r = await client.post("/bekleme-listesi", json=govdesi)
    assert r.status_code == 422
    assert await satirlar(test_engine, email) == []


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize(
    "ek",
    [{"urun": "elma"}, {"email": "gecersiz"}, {"il": " "}, {"il": "x" * 81}],
)
async def test_gecersiz_alanlar_reddedilir(client: AsyncClient, ek):
    r = await client.post("/bekleme-listesi", json=govde(**ek))
    assert r.status_code == 422


@pytest.mark.asyncio
@pytest.mark.integration
async def test_hiz_siniri_asilinca_429_ve_baska_istemci_etkilenmez(client: AsyncClient, test_engine):
    s = get_settings()
    onceki = s.bekleme_vekil_guven
    s.bekleme_vekil_guven = True
    try:
        for _ in range(s.bekleme_limit_adet):
            assert (await client.post("/bekleme-listesi", json=govde(), headers={"x-forwarded-for": "203.0.113.7"})).status_code == 201
        asan = await client.post("/bekleme-listesi", json=govde(), headers={"x-forwarded-for": "203.0.113.7"})
        assert asan.status_code == 429
        assert asan.json()["error"]["code"] == "RATE_LIMITED"
        assert asan.json()["error"]["details"]["retry_after_s"] >= 1
        baska = await client.post("/bekleme-listesi", json=govde(), headers={"x-forwarded-for": "198.51.100.9"})
        assert baska.status_code == 201
    finally:
        s.bekleme_vekil_guven = onceki


@pytest.mark.asyncio
@pytest.mark.integration
async def test_vekil_guveni_kapaliyken_x_forwarded_for_yok_sayilir(client: AsyncClient):
    """Sahte X-Forwarded-For ile sınır atlatılamaz: varsayılanda anahtar bağlantının kendi adresidir."""
    s = get_settings()
    for i in range(s.bekleme_limit_adet):
        assert (await client.post("/bekleme-listesi", json=govde(), headers={"x-forwarded-for": f"10.0.0.{i}"})).status_code == 201
    assert (await client.post("/bekleme-listesi", json=govde(), headers={"x-forwarded-for": "10.9.9.9"})).status_code == 429


def test_kayan_pencere_suresi_dolunca_yeniden_izin_verir():
    t = [0.0]
    limiter = SlidingWindowLimiter(limit=2, window_s=60, now=lambda: t[0])
    assert limiter.allow("a") and limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.retry_after("a") == 60
    t[0] = 59.9
    assert not limiter.allow("a")
    t[0] = 60.0
    assert limiter.allow("a")
    assert limiter.allow("b")  # anahtarlar ayrı


@pytest.mark.asyncio
@pytest.mark.integration
async def test_kvkk_taslak_acikken_canlida_basvuru_alinmaz(client: AsyncClient, test_engine):
    s = get_settings()
    s.kvkk_taslak, s.api_debug = True, False  # canlı + metin hukuki onay bekliyor
    email = unique_email()
    r = await client.post("/bekleme-listesi", json=govde(email))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "FORBIDDEN"
    assert await satirlar(test_engine, email) == []  # hiçbir kişisel veri yazılmadı


@pytest.mark.asyncio
@pytest.mark.integration
async def test_kvkk_taslak_kapaliyken_canlida_basvuru_alinir(client: AsyncClient):
    s = get_settings()
    s.kvkk_taslak, s.api_debug = False, False  # hukuki onay geldi
    assert (await client.post("/bekleme-listesi", json=govde())).status_code == 201


@pytest.mark.asyncio
@pytest.mark.integration
async def test_kvkk_taslak_acik_olsa_da_gelistirmede_form_calisir(client: AsyncClient):
    s = get_settings()
    s.kvkk_taslak, s.api_debug = True, True  # yerel geliştirme ve e2e
    assert (await client.post("/bekleme-listesi", json=govde())).status_code == 201
