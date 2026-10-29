"""Fotoğraf EXIF önerisi: çekim tarihi ve konum silinmeden ÖNCE okunur (öneri); saklanan dosyada EXIF yine yoktur."""

import io
from datetime import date, timedelta

from PIL import Image

from bahcelab_backend.domain.fieldbook import exif as fx
from bahcelab_backend.shared.storage import get_storage

from .test_events_service import GEOMETRY, TODAY, factory, seed, user_client  # noqa: F401, F811
from .test_fieldbook_api import CENTER, jpeg  # noqa: F401


def dms(value: float) -> tuple[float, float, float]:
    d = int(abs(value))
    m = int((abs(value) - d) * 60)
    return float(d), float(m), round(((abs(value) - d) * 60 - m) * 60, 4)


def exif_jpeg(lng: float | None, lat: float | None, taken: str | None) -> bytes:
    image = Image.new("RGB", (40, 30), (100, 150, 80))
    exif = Image.Exif()
    if taken:
        exif[0x8769] = {36867: taken}  # DateTimeOriginal
    if lng is not None and lat is not None:
        exif[0x8825] = {1: "N" if lat >= 0 else "S", 2: dms(lat), 3: "E" if lng >= 0 else "W", 4: dms(lng)}
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def test_exif_reader_returns_date_and_location_and_handles_hemispheres():
    found = fx.read_exif(exif_jpeg(34.4, 36.65, "2026:10:05 08:12:40"), today=date(2026, 10, 10))
    assert found.tarih == date(2026, 10, 5) and abs(found.lng - 34.4) < 1e-3 and abs(found.lat - 36.65) < 1e-3
    south_west = fx.read_exif(exif_jpeg(-58.38, -34.6, None), today=date(2026, 10, 10))
    assert south_west.lng < 0 and south_west.lat < 0 and south_west.tarih is None


def test_exif_reader_refuses_future_or_absurd_dates_and_null_island_and_junk():
    assert fx.read_exif(exif_jpeg(None, None, "2027:01:01 10:00:00"), today=date(2026, 10, 10)).tarih is None  # gelecek tarih önerilmez
    assert fx.read_exif(exif_jpeg(None, None, "1980:01:01 10:00:00"), today=date(2026, 10, 10)).tarih is None
    assert fx.read_exif(exif_jpeg(None, None, "bozuk"), today=date(2026, 10, 10)).tarih is None
    assert fx.read_exif(exif_jpeg(0.0, 0.0, None), today=date(2026, 10, 10)).lng is None  # 0,0 «konum yok» demektir
    assert fx.read_exif(b"bu bir fotograf degil", today=date(2026, 10, 10)) == fx.ExifOneri(None, None, None)
    assert fx.read_exif(jpeg(), today=date(2026, 10, 10)) == fx.ExifOneri(None, None, None)  # EXIF yok


async def test_the_suggestion_endpoint_proposes_date_and_nearby_location_without_storing_anything(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    taken = (TODAY - timedelta(days=2)).strftime("%Y:%m:%d 07:45:00")
    before = set(p.name for p in getattr(get_storage(), "root").glob("field/*/*")) if (getattr(get_storage(), "root") / "field").exists() else set()
    response = await user_client.post(f"/gardens/{gid}/saha-fotograf-oneri", files={"file": ("a.jpg", exif_jpeg(CENTER[0], CENTER[1], taken), "image/jpeg")})
    body = response.json()
    assert response.status_code == 200 and body["tarih"] == str(TODAY - timedelta(days=2))
    assert body["konum"]["type"] == "Point" and body["konum_bahceden_uzak"] is False and body["konum_mesafe_m"] <= 500 and "çekim tarihi" in body["aciklama"]
    after = set(p.name for p in getattr(get_storage(), "root").glob("field/*/*")) if (getattr(get_storage(), "root") / "field").exists() else set()
    assert after == before  # öneri dosya SAKLAMAZ


async def test_a_far_location_is_reported_but_not_proposed_and_junk_is_refused(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    far = (await user_client.post(f"/gardens/{gid}/saha-fotograf-oneri", files={"file": ("a.jpg", exif_jpeg(CENTER[0] + 0.1, CENTER[1], None), "image/jpeg")})).json()
    assert far["konum"] is None and far["konum_bahceden_uzak"] is True and far["konum_mesafe_m"] > 5000 and "uzakta" in far["aciklama"]
    none = (await user_client.post(f"/gardens/{gid}/saha-fotograf-oneri", files={"file": ("a.jpg", jpeg(), "image/jpeg")})).json()
    assert none["tarih"] is None and none["konum"] is None and none["konum_mesafe_m"] is None and "yok" in none["aciklama"]
    assert (await user_client.post(f"/gardens/{gid}/saha-fotograf-oneri", files={"file": ("a.txt", b"degil", "image/jpeg")})).status_code == 422


async def test_the_stored_photo_has_no_exif_even_though_the_suggestion_read_it(user_client, factory):  # noqa: F811
    gid = await seed(user_client, factory)
    raw = exif_jpeg(CENTER[0], CENTER[1], "2026:10:05 08:00:00")
    assert (await user_client.post(f"/gardens/{gid}/saha-fotograf-oneri", files={"file": ("a.jpg", raw, "image/jpeg")})).json()["tarih"] == "2026-10-05"
    rid = (await user_client.post(f"/gardens/{gid}/saha-kayitlari", json={"tur": "gozlem", "tarih": str(TODAY), "aciklama": "x"})).json()["id"]
    up = await user_client.post(f"/gardens/{gid}/saha-kayitlari/{rid}/foto", files={"file": ("a.jpg", raw, "image/jpeg")})
    stored = (await user_client.get(up.json()["url"])).content
    image = Image.open(io.BytesIO(stored))
    assert not image.getexif().get_ifd(0x8825) and not image.getexif().get_ifd(0x8769) and fx.read_exif(stored, today=TODAY) == fx.ExifOneri(None, None, None)
