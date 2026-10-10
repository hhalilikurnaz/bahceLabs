import pytest
from httpx import AsyncClient

from .conftest import register


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_create_plan_requires_login(client: AsyncClient):
    response = await client.post("/planning/plans", json={"name": "Test Plan"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_plan_crud_lifecycle(client: AsyncClient, cleanup_users):
    _email, registered = await register(client)
    workspace_id = registered.json()["workspace_id"]

    create_resp = await client.post("/planning/plans", json={"name": "Test Bahçe Planı"})
    assert create_resp.status_code == 201
    plan = create_resp.json()
    plan_id = plan["id"]
    assert plan["name"] == "Test Bahçe Planı"
    assert plan["status"] == "draft"
    assert plan["workspace_id"] == workspace_id

    get_resp = await client.get(f"/planning/plans/{plan_id}")
    assert get_resp.status_code == 200

    list_resp = await client.get("/planning/plans")
    assert list_resp.status_code == 200
    assert [p["id"] for p in list_resp.json()] == [plan_id]

    patch_resp = await client.patch(
        f"/planning/plans/{plan_id}",
        json={"name": "Güncellenmiş Plan", "status": "saved"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Güncellenmiş Plan"
    assert patch_resp.json()["status"] == "saved"

    delete_resp = await client.delete(f"/planning/plans/{plan_id}")
    assert delete_resp.status_code == 204
