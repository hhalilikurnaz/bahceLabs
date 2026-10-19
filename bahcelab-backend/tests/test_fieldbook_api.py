"""Saha Defteri API'si (ADR 0019): konumlu kayıtlar, fotoğraf, «Uydu haklı mıydı?» doğrulaması, doğruluk özeti, saha turu. Gerçek tablolar, ağsız."""

import io
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.events.models import EventModel
from bahcelab_backend.domain.fieldbook.models import (
    EventVerificationModel,
    FieldPhotoModel,
    FieldRecordModel,
)
from bahcelab_backend.shared.storage import get_storage

from .conftest import register
from .test_events_service import (  # noqa: F401, F811
    GEOMETRY,
    TODAY,
    add_s2,
    factory,
    seed,
    user_client,
)
from .test_status_v2_api import add_acquisition

CENTER = (GEOMETRY["coordinates"][0][0][0] + 0.0013, GEOMETRY["coordinates"][0][0][1] + 0.0013)  # bahçenin içinde bir nokta


def point(dx: float = 0.0, dy: float = 0.0) -> dict:
    return {"type": "Point", "coordinates": [CENTER[0] + dx, CENTER[1] + dy]}


def jpeg(size: tuple[int, int] = (64, 48), exif_gps: bool = False) -> bytes:
    image = Image.new("RGB", size, (120, 160, 90))
    buffer = io.BytesIO()
    if exif_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "N", 2: (36.0, 39.0, 0.0), 3: "E", 4: (34.0, 24.0, 0.0)}  # GPS IFD: konum etiketi
        image.save(buffer, format="JPEG", exif=exif)
    else:
        image.save(buffer, format="JPEG")
    return buffer.getvalue()


async def add_event(factory, gid, key, tur, day, *, durum="olay", turler=None, guven="orta", ayrinti=None):  # noqa: ANN001, ANN201, F811
    async with factory() as session:
        row = EventModel(garden_id=gid, anahtar=key, tur=tur, turler=turler or [tur], baslangic=day, bitis=day, guven=guven, durum=durum, tahmin=False, ayrinti=ayrinti, formul_surumu="t")
        session.add(row)
        await session.commit()
        return row.id


async def new_record(client, gid, **over):  # noqa: ANN001, ANN201
    body = {"tur": "gozlem", "tarih": str(TODAY), "konum": point(), "aciklama": "Yaprak ucunda sararma"} | over
    return await client.post(f"/gardens/{gid}/saha-kayitlari", json=body)


# ----------------------------------------------------------------------------- kayıtlar
async def test_a_point_record_is_saved_with_its_location_and_listed_newest_first(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    first = await new_record(user_client, gid, tarih=str(TODAY - timedelta(days=3)), tur="ilaclama")
    second = await new_record(user_client, gid, konum=None, tur="hasat", aciklama="İlk kasa")
    assert first.status_code == 201 and second.status_code == 201
    body = first.json()
    assert body["konum_tur"] == "nokta" and body["konum"]["type"] == "Point" and body["fotograflar"] == []
    listed = (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"]
    assert [r["tur"] for r in listed] == ["hasat", "ilaclama"] and listed[0]["konum"] is None and listed[0]["konum_tur"] is None
    assert [r["tur"] for r in (await user_client.get(f"/gardens/{gid}/saha-kayitlari?tur=ilaclama")).json()["kayitlar"]] == ["ilaclama"]


async def test_an_area_record_is_accepted_and_far_or_invalid_locations_are_refused(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    d = 0.0004
    area = {"type": "Polygon", "coordinates": [[[CENTER[0], CENTER[1]], [CENTER[0] + d, CENTER[1]], [CENTER[0] + d, CENTER[1] + d], [CENTER[0], CENTER[1]]]]}
    ok = await new_record(user_client, gid, konum=area, tur="sulama")
    assert ok.status_code == 201 and ok.json()["konum_tur"] == "alan"
    far = await new_record(user_client, gid, konum={"type": "Point", "coordinates": [CENTER[0] + 0.05, CENTER[1]]})  # ~4,5 km
    assert far.status_code == 422 and "uzakta" in far.json()["error"]["message"]
    assert (await new_record(user_client, gid, konum={"type": "LineString", "coordinates": [[0, 0], [1, 1]]})).status_code == 422
    assert (await new_record(user_client, gid, konum={"type": "Point", "coordinates": [500, 0]})).status_code == 422
    assert (await new_record(user_client, gid, tur="icki")).status_code == 422  # tanımsız tür
    assert (await new_record(user_client, gid, aciklama="x" * 1001)).status_code == 422


async def test_a_record_can_be_updated_and_deleted_and_belongs_only_to_its_owner(user_client, factory, client):  # noqa: F811
    gid = await seed(user_client, factory)
    rid = (await new_record(user_client, gid)).json()["id"]
    patched = (await user_client.patch(f"/gardens/{gid}/saha-kayitlari/{rid}", json={"tur": "gubreleme", "aciklama": "  ", "konumu_sil": True})).json()
    assert patched["tur"] == "gubreleme" and patched["aciklama"] is None and patched["konum"] is None
    async with AsyncClient(transport=client._transport, base_url="http://test") as other:  # başka kullanıcı
        await register(other)
        assert (await other.get(f"/gardens/{gid}/saha-kayitlari")).status_code == 404  # bahçenin varlığı bile sızmaz
        assert (await other.delete(f"/gardens/{gid}/saha-kayitlari/{rid}")).status_code == 404
    assert (await user_client.delete(f"/gardens/{gid}/saha-kayitlari/{rid}")).status_code == 204
    assert (await user_client.delete(f"/gardens/{gid}/saha-kayitlari/{rid}")).status_code == 404


# ----------------------------------------------------------------------------- fotoğraf
async def test_a_photo_is_reencoded_without_exif_location_and_served_back(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    rid = (await new_record(user_client, gid)).json()["id"]
    raw = jpeg(exif_gps=True)
    assert Image.open(io.BytesIO(raw)).getexif().get_ifd(0x8825)  # girişte konum VAR
    response = await user_client.post(f"/gardens/{gid}/saha-kayitlari/{rid}/foto", files={"file": ("tarla.jpg", raw, "image/jpeg")})
    assert response.status_code == 201
    served = await user_client.get(response.json()["url"])
    assert served.status_code == 200 and served.headers["content-type"] == "image/jpeg" and served.headers["x-content-type-options"] == "nosniff"
    assert not Image.open(io.BytesIO(served.content)).getexif().get_ifd(0x8825)  # çıkışta konum YOK
    assert (await user_client.get(f"/gardens/{gid}/saha-kayitlari")).json()["kayitlar"][0]["fotograflar"][0]["id"] == response.json()["id"]


async def test_bad_photos_are_refused_and_the_per_record_limit_holds(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    rid = (await new_record(user_client, gid)).json()["id"]
    url = f"/gardens/{gid}/saha-kayitlari/{rid}/foto"
    assert (await user_client.post(url, files={"file": ("a.txt", "bu bir fotoğraf değil".encode(), "image/jpeg")})).status_code == 422
    gif = io.BytesIO()
    Image.new("RGB", (8, 8)).save(gif, format="GIF")
    assert (await user_client.post(url, files={"file": ("a.gif", gif.getvalue(), "image/gif")})).status_code == 422  # yalnız JPEG/PNG/WebP
    big = get_settings().field_photo_max_bytes + 10
    assert (await user_client.post(url, files={"file": ("b.jpg", b"\xff\xd8" + b"0" * big, "image/jpeg")})).status_code == 422
    for _ in range(get_settings().field_photo_max_per_owner):
        assert (await user_client.post(url, files={"file": ("c.jpg", jpeg(), "image/jpeg")})).status_code == 201
    assert (await user_client.post(url, files={"file": ("d.jpg", jpeg(), "image/jpeg")})).status_code == 422
    assert (await user_client.post(f"/gardens/{gid}/saha-kayitlari/{uuid.uuid4()}/foto", files={"file": ("e.jpg", jpeg(), "image/jpeg")})).status_code == 404


async def test_deleting_a_record_removes_its_photo_files(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    rid = (await new_record(user_client, gid)).json()["id"]
    await user_client.post(f"/gardens/{gid}/saha-kayitlari/{rid}/foto", files={"file": ("a.jpg", jpeg(), "image/jpeg")})
    async with factory() as session:
        key = (await session.execute(select(FieldPhotoModel.dosya_yolu))).scalars().first()
    assert key and get_storage().exists(key)
    await user_client.delete(f"/gardens/{gid}/saha-kayitlari/{rid}")
    assert not get_storage().exists(key)


# ----------------------------------------------------------------------------- doğrulama
async def test_every_event_gets_a_card_and_the_farmers_answer_is_kept_by_event_key(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    day = TODAY - timedelta(days=20)
    await add_event(factory, gid, f"don:{day}", "don", day, turler=["don", "s2_dusus"], guven="yuksek")
    await add_event(factory, gid, f"s2_dusus:{TODAY}", "s2_dusus", TODAY - timedelta(days=4), durum="bekliyor")
    cards = (await user_client.get(f"/gardens/{gid}/dogrulama")).json()
    assert cards["bekleyen"] == 2 and [c["durum"] for c in cards["kartlar"]] == ["bekliyor", "olay"]  # doğrulama bekleyen önce
    assert cards["kartlar"][1]["baslik"] == "Don + optik hasar izi" and cards["kartlar"][1]["tur_grubu"] == "don" and cards["kartlar"][1]["sonuc"] is None
    answered = await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"don:{day}", "sonuc": "gerceklesti", "aciklama": "Sabah çiğ donmuştu"})
    assert answered.status_code == 200 and answered.json()["sonuc"] == "gerceklesti" and answered.json()["aciklama"] == "Sabah çiğ donmuştu"
    again = (await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"don:{day}", "sonuc": "gerceklesmedi"})).json()
    assert again["sonuc"] == "gerceklesmedi" and again["aciklama"] is None  # üzerine yazılır; tek kayıt
    assert (await user_client.get(f"/gardens/{gid}/dogrulama")).json()["bekleyen"] == 1
    async with factory() as session:  # olay motoru olayı yeniden kurunca silindi: çiftçinin yargısı ve özeti KALIR
        await session.execute(EventModel.__table__.delete().where(EventModel.anahtar == f"don:{day}"))
        await session.commit()
    kept = [c for c in (await user_client.get(f"/gardens/{gid}/dogrulama")).json()["kartlar"] if c["hedef_anahtar"] == f"don:{day}"]
    assert len(kept) == 1 and kept[0]["sonuc"] == "gerceklesmedi" and kept[0]["olay_id"] is None and kept[0]["baslik"]
    assert (await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": "yok:2020-01-01", "sonuc": "bilinmiyor"})).status_code == 404


async def test_the_event_list_marks_the_farmers_verdict(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    day = TODAY - timedelta(days=9)
    await add_event(factory, gid, f"ruzgar:{day}", "ruzgar", day)
    await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"ruzgar:{day}", "sonuc": "gerceklesmedi"})
    olaylar = (await user_client.get(f"/gardens/{gid}/olaylar")).json()["olaylar"]
    assert [o["dogrulama"] for o in olaylar] == ["gerceklesmedi"]


async def test_a_verification_photo_attaches_to_the_answer(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    day = TODAY - timedelta(days=5)
    await add_event(factory, gid, f"asiri_yagis:{day}", "asiri_yagis", day)
    card = (await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"asiri_yagis:{day}", "sonuc": "gerceklesti"})).json()
    up = await user_client.post(f"/gardens/{gid}/dogrulama/{card['dogrulama_id']}/foto", files={"file": ("k.jpg", jpeg(), "image/jpeg")})
    assert up.status_code == 201
    shown = [c for c in (await user_client.get(f"/gardens/{gid}/dogrulama")).json()["kartlar"] if c["hedef_anahtar"] == f"asiri_yagis:{day}"][0]
    assert len(shown["fotograflar"]) == 1
    assert (await user_client.post(f"/gardens/{gid}/dogrulama/{uuid.uuid4()}/foto", files={"file": ("k.jpg", jpeg(), "image/jpeg")})).status_code == 404


async def test_accuracy_summary_withholds_ratios_until_enough_verifications(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    days = [TODAY - timedelta(days=10 + i * 3) for i in range(6)]
    for i, d in enumerate(days):
        await add_event(factory, gid, f"ruzgar:{d}", "ruzgar", d)
        if i < 4:
            await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"ruzgar:{d}", "sonuc": "gerceklesti" if i % 2 else "gerceklesmedi"})
    few = (await user_client.get(f"/gardens/{gid}/dogruluk-ozeti")).json()
    wind = [t for t in few["turler"] if t["tur"] == "ruzgar"][0]
    assert wind["dogrulanan"] == 4 and wind["yeterli"] is False and "henüz yeterli doğrulama yok" in wind["metin"] and wind["bekleyen"] == 2
    for d in days[4:]:
        await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"ruzgar:{d}", "sonuc": "gerceklesmedi"})
    many = [t for t in (await user_client.get(f"/gardens/{gid}/dogruluk-ozeti")).json()["turler"] if t["tur"] == "ruzgar"][0]
    assert many["yeterli"] and many["gerceklesti"] == 2 and many["gerceklesmedi"] == 4 and many["metin"] == "6 doğrulama: 2 gerçekleşti, 4 yanlış alarm"


# ----------------------------------------------------------------------------- saha turu
async def test_the_tour_lists_pending_drops_and_stress_patches_nearest_first_and_marks_visits(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    far, near = (CENTER[0] + 0.0012, CENTER[1]), (CENTER[0] - 0.0008, CENTER[1])
    day = TODAY - timedelta(days=3)
    await add_event(factory, gid, f"s2_dusus:a{day}", "s2_dusus", day, durum="bekliyor", ayrinti={"s2_dusus.merkez_lng": far[0], "s2_dusus.merkez_lat": far[1]})
    await add_event(factory, gid, f"s2_dusus:b{day}", "s2_dusus", day, durum="bekliyor", ayrinti={"s2_dusus.merkez_lng": near[0], "s2_dusus.merkez_lat": near[1]})
    tour = (await user_client.get(f"/gardens/{gid}/saha-turu?lng={near[0] - 0.0004}&lat={near[1]}")).json()
    assert [p["tur"] for p in tour["noktalar"]] == ["bekliyor", "bekliyor"] and tour["noktalar"][0]["lng"] == pytest.approx(near[0])  # başlangıca en yakın önce
    assert tour["toplam_m"] > 0 and tour["sure_dk"] >= 8 and len(tour["rota"]) == 3 and "gerçek yürüyüş yolu değildir" in tour["not_"]
    key = tour["noktalar"][0]["anahtar"]
    rid = (await new_record(user_client, gid, konum=point(-0.0008, 0.0))).json()["id"]
    assert (await user_client.put(f"/gardens/{gid}/saha-turu/ziyaret", json={"nokta_anahtar": key, "kayit_id": rid})).status_code == 204
    after = (await user_client.get(f"/gardens/{gid}/saha-turu")).json()
    assert after["ziyaret_edilen"] == 1 and [p["ziyaret_edildi"] for p in after["noktalar"]] == [False, True]  # ziyaret edilen sona, rotadan çıkar
    assert after["noktalar"][1]["kayit_id"] == rid and len(after["rota"]) == 2
    await user_client.put(f"/gardens/{gid}/saha-turu/ziyaret", json={"nokta_anahtar": key, "ziyaret_edildi": False})
    assert (await user_client.get(f"/gardens/{gid}/saha-turu")).json()["ziyaret_edilen"] == 0
    assert (await user_client.put(f"/gardens/{gid}/saha-turu/ziyaret", json={"nokta_anahtar": key, "kayit_id": str(uuid.uuid4())})).status_code == 404


async def test_the_tour_finds_a_stress_patch_in_the_latest_scene_and_is_empty_without_warnings(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    assert (await user_client.get(f"/gardens/{gid}/saha-turu")).json()["noktalar"] == []  # uyarı yok → uydurma nokta yok
    await add_s2(factory, gid, TODAY - timedelta(days=2), 0.3)  # 12×12 piksel = 14,4 da düşük yama
    tour = (await user_client.get(f"/gardens/{gid}/saha-turu")).json()
    assert [p["tur"] for p in tour["noktalar"]] == ["stres_yamasi"] and "bitişik yama" in tour["noktalar"][0]["neden"]


# ----------------------------------------------------------------------------- Geçmiş bağlantısı
async def test_harvest_records_fill_the_history_table_and_other_years_stay_no_record(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    await new_record(user_client, gid, tur="hasat", tarih="2024-10-20", konum=None)
    await new_record(user_client, gid, tur="hasat", tarih="2024-11-05", konum=None)
    await add_acquisition(factory, str(gid), date(2024, 7, 10), 0.6, 0.2, 0.3)
    await add_acquisition(factory, str(gid), date(2025, 7, 10), 0.6, 0.2, 0.3)
    by_year = {y["yil"]: y for y in (await user_client.get(f"/gardens/{gid}/gecmis-ozeti")).json()["yillar"]}
    assert by_year[2024]["hasat"] == {"durum": "kayit", "adet": 2, "son_tarih": "2024-11-05"}
    assert by_year[2025]["hasat"]["durum"] == "kayit_yok"


async def test_deleting_the_garden_removes_field_records_verifications_and_photo_files(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    rid = (await new_record(user_client, gid)).json()["id"]
    await user_client.post(f"/gardens/{gid}/saha-kayitlari/{rid}/foto", files={"file": ("a.jpg", jpeg(), "image/jpeg")})
    day = TODAY - timedelta(days=2)
    await add_event(factory, gid, f"don:{day}", "don", day)
    await user_client.put(f"/gardens/{gid}/dogrulama", json={"hedef_tur": "olay", "hedef_anahtar": f"don:{day}", "sonuc": "gerceklesti"})
    async with factory() as session:
        key = (await session.execute(select(FieldPhotoModel.dosya_yolu))).scalars().first()
    assert key and get_storage().exists(key)
    assert (await user_client.delete(f"/gardens/{gid}")).status_code == 204
    assert not get_storage().exists(key)
    async with factory() as session:
        for model in (FieldPhotoModel, EventVerificationModel, FieldRecordModel):
            assert (await session.execute(select(model).where(model.garden_id == gid))).first() is None
