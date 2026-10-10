from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from bahcelab_backend.config import get_settings

from .conftest import TEST_PASSWORD, make_client, register, unique_email


@pytest.mark.asyncio
@pytest.mark.integration
async def test_register_creates_session_with_httponly_cookies(client: AsyncClient, cleanup_users):
    email, response = await register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email
    assert "password" not in body and "password_hash" not in body

    set_cookies = response.headers.get_list("set-cookie")
    assert len(set_cookies) == 2
    for header in set_cookies:
        assert "HttpOnly" in header
        assert "SameSite=lax" in header

    me = await client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["id"] == body["id"]
    assert me.json()["workspace_id"] == body["workspace_id"]


@pytest.mark.asyncio
@pytest.mark.integration
async def test_password_is_stored_as_argon2_hash(client: AsyncClient, test_engine, cleanup_users):
    email, _ = await register(client)
    async with test_engine.connect() as conn:
        stored = (
            await conn.execute(
                text("SELECT password_hash FROM users WHERE email = :e"), {"e": email}
            )
        ).scalar_one()
    assert stored.startswith("$argon2")
    assert TEST_PASSWORD not in stored


@pytest.mark.asyncio
@pytest.mark.integration
async def test_register_duplicate_email_conflicts(client: AsyncClient, app, cleanup_users):
    email, first = await register(client)
    assert first.status_code == 201

    async with make_client(app) as other:
        _, second = await register(other, email=email.upper())
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_register_rejected_when_disabled(client: AsyncClient):
    settings = get_settings()
    settings.registration_enabled = False
    _, response = await register(client, email=unique_email())
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_register_validates_input(client: AsyncClient):
    response = await client.post(
        "/auth/register", json={"name": "A", "email": "gecersiz", "password": "kisa"}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.integration
async def test_login_success_and_wrong_password_rejected(
    client: AsyncClient, app, cleanup_users
):
    email, _ = await register(client)

    async with make_client(app) as fresh:
        wrong = await fresh.post("/auth/login", json={"email": email, "password": "yanlis-sifre"})
        assert wrong.status_code == 401
        assert wrong.json()["error"]["code"] == "UNAUTHORIZED"
        assert (await fresh.get("/auth/me")).status_code == 401

        unknown = await fresh.post(
            "/auth/login", json={"email": unique_email(), "password": TEST_PASSWORD}
        )
        assert unknown.status_code == 401
        # E-posta var/yok bilgisi sızdırılmaz
        assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]

        ok = await fresh.post(
            "/auth/login", json={"email": email.upper(), "password": TEST_PASSWORD}
        )
        assert ok.status_code == 200
        assert (await fresh.get("/auth/me")).status_code == 200


@pytest.mark.asyncio
async def test_protected_endpoints_require_token(client: AsyncClient):
    for method, path in [
        ("GET", "/auth/me"),
        ("GET", "/planning/plans"),
        ("GET", "/planning/products"),
    ]:
        response = await client.request(method, path)
        assert response.status_code == 401, path


@pytest.mark.asyncio
async def test_invalid_and_expired_tokens_rejected(client: AsyncClient):
    settings = get_settings()
    expired = jwt.encode(
        {
            "sub": "00000000-0000-4000-8000-000000000001",
            "type": "access",
            "exp": datetime.now(UTC) - timedelta(minutes=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    forged = jwt.encode(
        {
            "sub": "00000000-0000-4000-8000-000000000001",
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        "baska-bir-anahtar-yeterince-uzun-olsun-32b",
        algorithm="HS256",
    )
    for token in (expired, forged, "bozuk.token.degeri"):
        client.cookies.set("bahcelab_access", token)
        assert (await client.get("/auth/me")).status_code == 401


@pytest.mark.asyncio
@pytest.mark.integration
async def test_refresh_rotates_token_and_reuse_is_rejected(
    client: AsyncClient, app, cleanup_users
):
    await register(client)
    old_refresh = client.cookies.get("bahcelab_refresh")

    refreshed = await client.post("/auth/refresh")
    assert refreshed.status_code == 200
    new_refresh = client.cookies.get("bahcelab_refresh")
    assert new_refresh != old_refresh
    assert (await client.get("/auth/me")).status_code == 200

    # Eski refresh token tekrar kullanılırsa reddedilir ve tüm oturumlar kapanır
    async with make_client(app) as attacker:
        attacker.cookies.set("bahcelab_refresh", old_refresh)
        assert (await attacker.post("/auth/refresh")).status_code == 401
    assert (await client.post("/auth/refresh")).status_code == 401


@pytest.mark.asyncio
async def test_refresh_without_cookie_is_rejected(client: AsyncClient):
    assert (await client.post("/auth/refresh")).status_code == 401


@pytest.mark.asyncio
@pytest.mark.integration
async def test_logout_clears_cookies_and_revokes_refresh_token(
    client: AsyncClient, app, cleanup_users
):
    await register(client)
    refresh_token = client.cookies.get("bahcelab_refresh")

    response = await client.post("/auth/logout")
    assert response.status_code == 204
    assert (await client.get("/auth/me")).status_code == 401

    async with make_client(app) as other:
        other.cookies.set("bahcelab_refresh", refresh_token)
        assert (await other.post("/auth/refresh")).status_code == 401


@pytest.mark.asyncio
@pytest.mark.integration
async def test_user_cannot_access_another_users_plan(client: AsyncClient, app, cleanup_users):
    await register(client)
    created = await client.post("/planning/plans", json={"name": "Kullanıcı A planı"})
    plan_id = created.json()["id"]

    async with make_client(app) as other:
        await register(other)
        assert (await other.get(f"/planning/plans/{plan_id}")).status_code == 404
        assert (
            await other.patch(f"/planning/plans/{plan_id}", json={"name": "ele geçirildi"})
        ).status_code == 404
        assert (await other.delete(f"/planning/plans/{plan_id}")).status_code == 404
        assert (await other.get("/planning/plans")).json() == []

    still_there = await client.get(f"/planning/plans/{plan_id}")
    assert still_there.status_code == 200
    assert still_there.json()["name"] == "Kullanıcı A planı"
