import math

import pytest
from httpx import AsyncClient
from pyproj import Geod, Transformer
from shapely.geometry import Polygon

from .conftest import make_client, register

_TO_UTM = Transformer.from_crs(4326, 32636, always_xy=True)
_TO_LL = Transformer.from_crs(32636, 4326, always_xy=True)
_GEOD = Geod(ellps="WGS84")

# Erdemli / Tömük civarı
LNG, LAT = 34.38, 36.66


def square(side_m: float, lng: float = LNG, lat: float = LAT) -> dict:
    """Merkezi verilen, kenarı side_m metre olan kare (UTM'de kare, EPSG:4326'ya çevrilmiş)."""
    cx, cy = _TO_UTM.transform(lng, lat)
    h = side_m / 2
    corners = [(cx - h, cy - h), (cx + h, cy - h), (cx + h, cy + h), (cx - h, cy + h)]
    ring = [list(_TO_LL.transform(x, y)) for x, y in corners]
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def garden_body(**overrides) -> dict:
    body = {
        "ad": "Deneme Bahçesi",
        "urun": "limon",
        "geometry": square(161),  # ≈ 26 dekar
        "il": "Mersin",
        "ilce": "Erdemli",
    }
    body.update(overrides)
    return body


def reference_dekar(geometry: dict) -> float:
    ring = geometry["coordinates"][0]
    return Polygon([_TO_UTM.transform(x, y) for x, y in ring]).area / 1000


@pytest.fixture
async def user_client(client: AsyncClient, cleanup_users):
    await register(client)
    return client


@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_garden_computes_area_on_server_in_utm(user_client: AsyncClient):
    geometry = square(161)
    response = await user_client.post(
        "/gardens",
        # İstemcinin gönderdiği alan değerleri dikkate alınmaz
        json=garden_body(geometry=geometry, alan_dekar=99999, area_m2=1),
    )
    assert response.status_code == 201
    garden = response.json()

    expected = reference_dekar(geometry)  # UTM 36N, ST_Transform(..., 32636) ile aynı yöntem
    assert garden["alan_dekar"] == pytest.approx(expected, rel=1e-4)
    assert garden["alan_dekar"] == pytest.approx(25.9, abs=0.3)
    geodesic = abs(_GEOD.geometry_area_perimeter(Polygon(geometry["coordinates"][0]))[0]) / 1000
    assert garden["alan_dekar"] == pytest.approx(geodesic, rel=0.005)

    # Planlama ekranının beklediği alanlar
    assert garden["name"] == "Deneme Bahçesi"
    assert garden["location_label"] == "Erdemli, Mersin"
    assert garden["area_m2"] == pytest.approx(garden["alan_dekar"] * 1000, abs=0.1)
    assert garden["geometry"]["type"] == "Polygon"
    assert garden["urun"] == "limon"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_measure_endpoint_returns_area_without_saving(user_client: AsyncClient):
    geometry = square(100)  # 10 dekar
    response = await user_client.post("/gardens/measure", json={"geometry": geometry})
    assert response.status_code == 200
    assert response.json()["alan_dekar"] == pytest.approx(10.0, rel=0.01)
    assert (await user_client.get("/gardens")).json() == []


@pytest.mark.asyncio
@pytest.mark.integration
async def test_self_intersecting_polygon_is_rejected(user_client: AsyncClient):
    bowtie = {
        "type": "Polygon",
        "coordinates": [
            [[34.38, 36.66], [34.382, 36.662], [34.382, 36.66], [34.38, 36.662], [34.38, 36.66]]
        ],
    }
    response = await user_client.post("/gardens", json=garden_body(geometry=bowtie))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "INVALID_GEOMETRY"
    assert "kesiyor" in error["message"]
    assert (await user_client.get("/gardens")).json() == []


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize(
    ("side_m", "fragment"),
    [
        (20, "en az 0,5 dekar"),  # 0,4 dekar
        (8000, "en fazla 5.000 dekar"),  # 64.000 dekar
    ],
)
async def test_area_limits_are_enforced(user_client: AsyncClient, side_m: float, fragment: str):
    response = await user_client.post("/gardens", json=garden_body(geometry=square(side_m)))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_GEOMETRY"
    assert fragment in response.json()["error"]["message"]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_area_limit_boundaries_are_accepted(user_client: AsyncClient):
    side_min = math.sqrt(0.55 * 1000)  # 0,55 dekar
    side_max = math.sqrt(4900 * 1000)  # 4.900 dekar
    for side in (side_min, side_max):
        response = await user_client.post("/gardens", json=garden_body(geometry=square(side)))
        assert response.status_code == 201, response.text


@pytest.mark.asyncio
@pytest.mark.integration
async def test_malformed_geometry_is_rejected_with_turkish_message(user_client: AsyncClient):
    open_ring = {
        "type": "Polygon",
        "coordinates": [[[34.38, 36.66], [34.39, 36.66], [34.39, 36.67], [34.38, 36.67]]],
    }
    response = await user_client.post("/gardens", json=garden_body(geometry=open_ring))
    assert response.status_code == 422
    message = response.json()["error"]["details"]["errors"][0]["msg"]
    assert "kapalı olmalı" in message

    out_of_range = square(161)
    out_of_range["coordinates"][0][1] = [200.0, 36.66]
    response = await user_client.post("/gardens", json=garden_body(geometry=out_of_range))
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.integration
async def test_field_validation_messages_are_turkish(user_client: AsyncClient):
    for overrides, fragment in [
        ({"ad": "   "}, "Bahçe adı boş olamaz"),
        ({"urun": "elma"}, "Ürün şunlardan biri"),
        ({"dikim_yili": 1850}, "Dikim yılı"),
    ]:
        response = await user_client.post("/gardens", json=garden_body(**overrides))
        assert response.status_code == 422, overrides
        assert fragment in response.json()["error"]["details"]["errors"][0]["msg"]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_multipolygon_and_altitude_are_accepted(user_client: AsyncClient):
    first = square(100, LNG, LAT)["coordinates"]
    second = square(100, LNG + 0.01, LAT)["coordinates"]
    multi = {"type": "MultiPolygon", "coordinates": [first, second]}
    response = await user_client.post("/gardens", json=garden_body(geometry=multi))
    assert response.status_code == 201
    assert response.json()["geometry"]["type"] == "MultiPolygon"
    assert response.json()["alan_dekar"] == pytest.approx(20.0, rel=0.01)

    with_z = square(100)
    with_z["coordinates"][0] = [[x, y, 123.0] for x, y in with_z["coordinates"][0]]
    response = await user_client.post("/gardens", json=garden_body(geometry=with_z))
    assert response.status_code == 201
    assert all(len(p) == 2 for p in response.json()["geometry"]["coordinates"][0])


@pytest.mark.asyncio
@pytest.mark.integration
async def test_garden_crud_lifecycle(user_client: AsyncClient):
    created = (await user_client.post("/gardens", json=garden_body(cesit="Interdonato"))).json()
    garden_id = created["id"]

    listed = (await user_client.get("/gardens")).json()
    assert [g["id"] for g in listed] == [garden_id]

    assert (await user_client.get(f"/gardens/{garden_id}")).json()["cesit"] == "Interdonato"

    renamed = await user_client.patch(
        f"/gardens/{garden_id}", json={"ad": "Yeni Ad", "il": None, "dikim_yili": 2015}
    )
    assert renamed.status_code == 200
    body = renamed.json()
    assert body["ad"] == "Yeni Ad" and body["name"] == "Yeni Ad"
    assert body["il"] is None and body["ilce"] == "Erdemli"
    assert body["cesit"] == "Interdonato"  # gönderilmeyen alan değişmez
    assert body["dikim_yili"] == 2015
    assert body["alan_dekar"] == created["alan_dekar"]

    bigger = await user_client.patch(f"/gardens/{garden_id}", json={"geometry": square(200)})
    assert bigger.status_code == 200
    assert bigger.json()["alan_dekar"] == pytest.approx(40.0, rel=0.01)

    invalid = await user_client.patch(f"/gardens/{garden_id}", json={"geometry": square(10)})
    assert invalid.status_code == 422
    assert (await user_client.get(f"/gardens/{garden_id}")).json()["alan_dekar"] == pytest.approx(
        40.0, rel=0.01
    )

    assert (await user_client.patch(f"/gardens/{garden_id}", json={"ad": None})).status_code == 422

    assert (await user_client.delete(f"/gardens/{garden_id}")).status_code == 204
    assert (await user_client.get(f"/gardens/{garden_id}")).status_code == 404


@pytest.mark.asyncio
@pytest.mark.integration
async def test_other_users_garden_is_not_accessible(user_client: AsyncClient, app):
    garden_id = (await user_client.post("/gardens", json=garden_body())).json()["id"]

    async with make_client(app) as other:
        await register(other)
        assert (await other.get("/gardens")).json() == []
        assert (await other.get(f"/gardens/{garden_id}")).status_code == 404
        assert (await other.patch(f"/gardens/{garden_id}", json={"ad": "x"})).status_code == 404
        assert (await other.delete(f"/gardens/{garden_id}")).status_code == 404

    assert (await user_client.get(f"/gardens/{garden_id}")).status_code == 200


@pytest.mark.asyncio
async def test_gardens_require_login(client: AsyncClient):
    for method, path in [("GET", "/gardens"), ("POST", "/gardens"), ("POST", "/gardens/measure")]:
        response = await client.request(method, path)
        assert response.status_code == 401, path


@pytest.mark.asyncio
@pytest.mark.integration
async def test_deleting_garden_unlinks_planning_drafts(user_client: AsyncClient):
    garden_id = (await user_client.post("/gardens", json=garden_body())).json()["id"]
    plan = (
        await user_client.post("/planning/plans", json={"name": "Plan", "garden_id": garden_id})
    ).json()
    assert plan["garden_id"] == garden_id

    await user_client.delete(f"/gardens/{garden_id}")

    still = await user_client.get(f"/planning/plans/{plan['id']}")
    assert still.status_code == 200
    assert still.json()["garden_id"] is None
