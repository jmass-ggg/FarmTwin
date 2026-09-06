"""Mandatory Phase 1 API and OpenAPI contract tests.

Feature: backend-foundation
Property 11: Versioned API contract
Requirements: 7.1-7.7, 8.1-8.6, 14.3
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from geoalchemy2.shape import from_shape
from httpx import ASGITransport, AsyncClient
from shapely.geometry import Point, Polygon

from app.api.dependencies import (
    get_app_session_factory,
    get_current_principal,
    get_farm_service,
    get_request_session,
)
from app.core.config import Settings
from app.core.exceptions import NotFoundError
from app.core.security import Principal
from app.main import create_app


USER_ID = UUID("10000000-0000-4000-8000-000000000001")
OWNED_FARM_ID = UUID("20000000-0000-4000-8000-000000000001")
INVISIBLE_FARM_ID = UUID("20000000-0000-4000-8000-000000000002")
ABSENT_FARM_ID = UUID("20000000-0000-4000-8000-000000000003")


def _settings(*, oidc: bool = False) -> Settings:
    auth = (
        {
            "mode": "oidc",
            "issuer": "https://issuer.example",
            "audience": "farmtwin-api",
            "jwks_url": "https://issuer.example/jwks.json",
            "algorithms": ["RS256"],
        }
        if oidc
        else {"mode": "local_demo"}
    )
    return Settings(
        environment="development",
        data_mode="demonstration",
        auth=auth,
        demo={"local_only": not oidc, "isolated_database": not oidc},
        database={"host": "localhost", "name": "test", "user": "test"},
        cors={"origins": []},
    )


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value


class _ProfileSession:
    def __init__(self, user):
        self.user = user

    async def execute(self, statement):
        return _Result(self.user)


class _FarmService:
    def __init__(self, farms):
        self.farms = farms
        self.list_call = None

    async def list_farms(self, *, limit, offset, sort_by):
        self.list_call = (limit, offset, sort_by)
        return self.farms[offset : offset + limit], len(self.farms)

    async def get_farm(self, farm_id):
        if farm_id != OWNED_FARM_ID:
            raise NotFoundError("not visible")
        return self.farms[0]


def _farm(farm_id: UUID, name: str, created_at: datetime):
    polygon = from_shape(
        Polygon([(36.8, -1.3), (36.81, -1.3), (36.81, -1.29), (36.8, -1.3)]),
        srid=4326,
    )
    point = from_shape(Point(36.805, -1.295), srid=4326)
    geometry = SimpleNamespace(
        id=uuid4(),
        revision=1,
        geometry=polygon,
        centroid=point,
        label_point=point,
        hectares=1.25,
        created_at=created_at,
    )
    return SimpleNamespace(
        id=farm_id,
        name=name,
        current_geometry_revision=1,
        current_geometry=geometry,
        created_at=created_at,
        updated_at=None,
    )


@pytest.fixture
def contract_app():
    app = create_app(_settings())
    principal = Principal(
        user_id=USER_ID,
        issuer="https://issuer.example",
        subject="subject-1",
        permissions=frozenset(),
    )
    offset = timezone(timedelta(hours=5, minutes=45))
    created = datetime(2025, 6, 1, 12, 0, 0, 123456, tzinfo=offset)
    user = SimpleNamespace(
        id=USER_ID,
        issuer=principal.issuer,
        subject=principal.subject,
        email=None,
        display_name=None,
        preferences={},
        created_at=created,
        updated_at=None,
    )
    farms = [
        _farm(OWNED_FARM_ID, "Alpha", created),
        _farm(UUID("20000000-0000-4000-8000-000000000004"), "Beta", created),
        _farm(UUID("20000000-0000-4000-8000-000000000005"), "Gamma", created),
    ]
    service = _FarmService(farms)

    async def principal_override():
        return principal

    async def session_override():
        yield _ProfileSession(user)

    async def service_override():
        return service

    app.dependency_overrides[get_current_principal] = principal_override
    app.dependency_overrides[get_request_session] = session_override
    app.dependency_overrides[get_farm_service] = service_override
    app.state.contract_service = service
    return app


async def _request(app, method: str, path: str, **kwargs):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.request(method, path, **kwargs)


def test_openapi_contains_only_phase_1_operations_and_common_errors(contract_app):
    schema = contract_app.openapi()
    expected_paths = {
        "/health",
        "/ready",
        "/api/v1/me",
        "/api/v1/farms",
        "/api/v1/farms/{farm_id}",
        # Phase 2 Conduit endpoints
        "/api/v1/conduit/current",
        "/api/v1/conduit/features",
        "/api/v1/conduit/history",
        "/api/v1/data-sources",
    }
    assert schema["info"]["version"] == "1.0.0"
    assert set(schema["paths"]) == expected_paths
    assert schema["components"]["securitySchemes"]["BearerAuth"] == {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT bearer token from identity provider",
    }

    for path, path_item in schema["paths"].items():
        operations = {
            name
            for name in path_item
            if name in {"get", "post", "put", "patch", "delete"}
        }
        assert operations == {"get"}
        operation = path_item["get"]
        if path.startswith("/api/v1"):
            assert operation["security"] == [{"BearerAuth": []}]
            assert {"401", "403", "404", "422", "503"} <= set(
                operation["responses"]
            )
            for status_code in ("401", "403", "404", "422", "503"):
                content = operation["responses"][status_code]["content"]
                assert content["application/json"]["schema"]["$ref"].endswith(
                    "/ErrorResponse"
                )
        else:
            assert "security" not in operation


@pytest.mark.asyncio
async def test_missing_bearer_token_is_401_even_without_browser_origin():
    app = create_app(_settings(oidc=True))
    app.state.session_factory = object()
    async def factory_override():
        return object()

    app.dependency_overrides[get_app_session_factory] = factory_override
    response = await _request(app, "GET", "/api/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_TOKEN_MISSING"


@pytest.mark.asyncio
async def test_profile_serializes_exact_utc_and_explicit_nulls(contract_app):
    response = await _request(contract_app, "GET", "/api/v1/me")
    assert response.status_code == 200
    body = response.json()
    assert body["created_at"] == "2025-06-01T06:15:00.123456Z"
    assert body["updated_at"] is None
    assert body["email"] is None
    assert body["display_name"] is None


@pytest.mark.asyncio
async def test_farm_pagination_bounds_order_and_scoped_count(contract_app):
    response = await _request(
        contract_app, "GET", "/api/v1/farms", params={"limit": 2, "offset": 1}
    )
    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body["items"]] == ["Beta", "Gamma"]
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert body["total"] == 3
    assert contract_app.state.contract_service.list_call == (2, 1, "created_at")

    for params in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        rejected = await _request(
            contract_app, "GET", "/api/v1/farms", params=params
        )
        assert rejected.status_code == 422
        assert rejected.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_owned_farm_includes_current_geometry_and_utc(contract_app):
    response = await _request(contract_app, "GET", f"/api/v1/farms/{OWNED_FARM_ID}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(OWNED_FARM_ID)
    assert body["current_geometry"]["revision"] == 1
    assert body["current_geometry"]["geometry"]["type"] == "Polygon"
    assert body["created_at"].endswith("Z")
    assert body["updated_at"] is None


@pytest.mark.asyncio
async def test_invisible_and_absent_farms_have_equivalent_404_contract(contract_app):
    invisible = await _request(
        contract_app, "GET", f"/api/v1/farms/{INVISIBLE_FARM_ID}"
    )
    absent = await _request(contract_app, "GET", f"/api/v1/farms/{ABSENT_FARM_ID}")
    assert invisible.status_code == absent.status_code == 404
    for response in (invisible, absent):
        error = response.json()["error"]
        assert error["code"] == "RESOURCE_NOT_FOUND"
        assert error["message"] == "Resource not found"
        assert error["details"] == []


@pytest.mark.asyncio
async def test_malformed_uuid_and_unsupported_version_use_common_errors(contract_app):
    malformed = await _request(contract_app, "GET", "/api/v1/farms/not-a-uuid")
    unsupported = await _request(contract_app, "GET", "/api/v2/farms")
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "VALIDATION_ERROR"
    assert malformed.json()["error"]["details"][0]["field"] == "path.farm_id"
    assert unsupported.status_code == 404
    assert unsupported.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
