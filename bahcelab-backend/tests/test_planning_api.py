import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from bahcelab_backend.config import get_settings
from bahcelab_backend.main import create_app

WORKSPACE_ID = "11111111-1111-4111-8111-111111111111"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    settings = get_settings()
    settings.require_workspace_header = True
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def workspace_headers():
    return {"X-Workspace-Id": WORKSPACE_ID}


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_create_plan_requires_workspace(client: AsyncClient):
    response = await client.post("/planning/plans", json={"name": "Test Plan"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_plan_crud_lifecycle(client: AsyncClient, workspace_headers: dict):
    create_resp = await client.post(
        "/planning/plans",
        json={"name": "Test Bahçe Planı"},
        headers=workspace_headers,
    )
    assert create_resp.status_code == 201
    plan = create_resp.json()
    plan_id = plan["id"]
    assert plan["name"] == "Test Bahçe Planı"
    assert plan["status"] == "draft"
    assert plan["workspace_id"] == WORKSPACE_ID

    get_resp = await client.get(f"/planning/plans/{plan_id}", headers=workspace_headers)
    assert get_resp.status_code == 200

    list_resp = await client.get("/planning/plans", headers=workspace_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    patch_resp = await client.patch(
        f"/planning/plans/{plan_id}",
        json={"name": "Güncellenmiş Plan", "status": "saved"},
        headers=workspace_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Güncellenmiş Plan"
    assert patch_resp.json()["status"] == "saved"

    delete_resp = await client.delete(
        f"/planning/plans/{plan_id}", headers=workspace_headers
    )
    assert delete_resp.status_code == 204


@pytest.mark.asyncio
@pytest.mark.integration
async def test_workspace_isolation(client: AsyncClient):
    headers_a = {"X-Workspace-Id": WORKSPACE_ID}
    headers_b = {"X-Workspace-Id": "22222222-2222-4222-8222-222222222222"}

    create_resp = await client.post(
        "/planning/plans",
        json={"name": "Workspace A Plan"},
        headers=headers_a,
    )
    plan_id = create_resp.json()["id"]

    cross_resp = await client.get(f"/planning/plans/{plan_id}", headers=headers_b)
    assert cross_resp.status_code == 404
