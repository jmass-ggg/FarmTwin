"""
Unit tests for soil and terrain provider adapters.

Covers:
- Soil: unavailable provider → evidence_status="unavailable", no values
- Soil: small farm flag when area < one SoilGrids grid cell (< 0.625 ha)
- Terrain: flood_probability is always null

Requirements: 5.4, 5.5, 6.4
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from shapely.geometry import Polygon

from app.data.providers import soil, terrain
from app.data.providers.base import EVIDENCE_ACCEPTED, EVIDENCE_UNAVAILABLE
from app.data.providers.soil import SOILGRIDS_CELL_AREA_HA
from app.data.providers.terrain import (
    _build_terrain_payload,
    _build_unavailable_payload,
    _iso_now,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normal_polygon() -> Polygon:
    """A polygon roughly 1°×1°, covers multiple DEM tiles — used for terrain tests."""
    return Polygon([
        (36.80000, -1.28000),
        (36.80100, -1.28000),
        (36.80100, -1.28100),
        (36.80000, -1.28100),
        (36.80000, -1.28000),
    ])


def _make_mock_response(status_code: int, json_data: dict | None = None) -> MagicMock:
    """Build a mock httpx.Response."""
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = status_code
    if json_data is not None:
        mock_resp.json.return_value = json_data
    if status_code >= 400:
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=mock_resp,
        )
    else:
        mock_resp.raise_for_status.return_value = None
    return mock_resp


def _make_async_client(mock_response: MagicMock) -> MagicMock:
    """Return a mock async context manager that yields a client returning mock_response."""
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_async_cm = MagicMock()
    mock_async_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_async_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_async_cm


# ---------------------------------------------------------------------------
# Soil adapter — unavailable provider
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_soil_unavailable_on_http_error():
    """Soil: HTTP 500 from SoilGrids → evidence_status='unavailable', all values null.

    Requirements: 5.5
    """
    mock_resp = _make_mock_response(500)

    with patch("httpx.AsyncClient", return_value=_make_async_client(mock_resp)):
        result = await soil.fetch(
            centroid_lat=-1.28,
            centroid_lon=36.80,
            farm_area_ha=1.0,
            data_mode="live",
        )

    assert result.evidence_status == EVIDENCE_UNAVAILABLE
    assert result.error_message is not None

    # All mean values in the payload must be null
    payload = result.payload
    assert payload is not None
    for depth_key, depth_data in payload["depths"].items():
        for prop, prop_data in depth_data.items():
            mean_envelope = prop_data["mean"]
            assert mean_envelope["value"] is None, (
                f"Expected null value for {prop} at {depth_key} when unavailable, "
                f"got {mean_envelope['value']}"
            )
            assert mean_envelope["quality"] == EVIDENCE_UNAVAILABLE


@pytest.mark.asyncio
async def test_soil_unavailable_on_timeout():
    """Soil: timeout from SoilGrids → evidence_status='unavailable', all values null.

    Requirements: 5.5
    """
    mock_client = MagicMock()
    mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
    mock_async_cm = MagicMock()
    mock_async_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_async_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_async_cm):
        result = await soil.fetch(
            centroid_lat=-1.28,
            centroid_lon=36.80,
            farm_area_ha=1.0,
            data_mode="live",
        )

    assert result.evidence_status == EVIDENCE_UNAVAILABLE
    assert result.error_message is not None

    payload = result.payload
    assert payload is not None
    for depth_key, depth_data in payload["depths"].items():
        for prop, prop_data in depth_data.items():
            assert prop_data["mean"]["value"] is None


# ---------------------------------------------------------------------------
# Soil adapter — small farm flag
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_soil_small_farm_flag_when_below_cell_size():
    """Soil: farm_area_ha < SOILGRIDS_CELL_AREA_HA → smaller_than_grid_cell=True.

    Requirements: 5.6
    """
    mock_response_data = {"type": "Point", "properties": {"layers": []}}
    mock_resp = _make_mock_response(200, json_data=mock_response_data)

    with patch("httpx.AsyncClient", return_value=_make_async_client(mock_resp)):
        result = await soil.fetch(
            centroid_lat=-1.28,
            centroid_lon=36.80,
            farm_area_ha=SOILGRIDS_CELL_AREA_HA * 0.5,
            data_mode="live",
        )

    assert result.evidence_status == EVIDENCE_ACCEPTED
    assert result.payload is not None
    assert result.payload["smaller_than_grid_cell"] is True


@pytest.mark.asyncio
async def test_soil_no_small_farm_flag_when_above_cell_size():
    """Soil: farm_area_ha >= SOILGRIDS_CELL_AREA_HA → smaller_than_grid_cell=False.

    Requirements: 5.6
    """
    mock_response_data = {"type": "Point", "properties": {"layers": []}}
    mock_resp = _make_mock_response(200, json_data=mock_response_data)

    with patch("httpx.AsyncClient", return_value=_make_async_client(mock_resp)):
        result = await soil.fetch(
            centroid_lat=-1.28,
            centroid_lon=36.80,
            farm_area_ha=SOILGRIDS_CELL_AREA_HA * 2.0,
            data_mode="live",
        )

    assert result.evidence_status == EVIDENCE_ACCEPTED
    assert result.payload is not None
    assert result.payload["smaller_than_grid_cell"] is False


# ---------------------------------------------------------------------------
# Terrain adapter — flood_probability always null
# ---------------------------------------------------------------------------

def test_terrain_flood_probability_null_in_success_payload():
    """Terrain: flood_probability is null in a successful terrain payload.

    Requirements: 6.4
    """
    stats = {
        "mean_elevation_m": 1500.0,
        "min_elevation_m": 1480.0,
        "max_elevation_m": 1520.0,
        "mean_slope_deg": 3.5,
    }
    payload = _build_terrain_payload(stats, retrieved_at=_iso_now(), data_mode="live")

    assert payload["flood_probability"] is None, (
        "flood_probability must always be null — slope/elevation alone "
        "are insufficient to infer flood exposure"
    )


def test_terrain_flood_probability_null_in_unavailable_payload():
    """Terrain: flood_probability is null in the unavailable payload too.

    Requirements: 6.4
    """
    payload = _build_unavailable_payload(retrieved_at=_iso_now(), data_mode="live")

    assert payload["flood_probability"] is None


@pytest.mark.asyncio
async def test_terrain_flood_probability_null_on_fetch_failure():
    """Terrain: flood_probability=null even when all DEM downloads fail.

    Requirements: 6.4, 6.5
    """
    # Make all tile downloads return None (simulate network failure)
    with patch(
        "app.data.providers.terrain._download_tile",
        new=AsyncMock(return_value=None),
    ):
        result = await terrain.fetch(farm_polygon=_normal_polygon(), data_mode="live")

    assert result.evidence_status == EVIDENCE_UNAVAILABLE
    assert result.payload is not None
    assert result.payload["flood_probability"] is None
