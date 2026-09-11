"""Satellite pipeline diagnostic script — run from farmtwin/backend/ with venv."""
import asyncio, logging, os, sys

for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

logging.basicConfig(level=logging.WARNING, format='%(levelname)s %(name)s %(message)s')

from shapely.geometry import Polygon
import app.data.providers.satellite as sat
import httpx
from datetime import datetime, timedelta, timezone

cx, cy = 36.803093477604854, -2.513260153370466
d = 0.05
farm_polygon = Polygon([
    (cx-d, cy-d), (cx+d, cy-d), (cx+d, cy+d), (cx-d, cy+d), (cx-d, cy-d)
])

cdse_user = os.environ.get('CDSE_USERNAME', '')
cdse_pass = os.environ.get('CDSE_PASSWORD', '')
print(f"CDSE_USERNAME: {'configured' if cdse_user else 'MISSING'}")
print(f"CDSE_PASSWORD: {'configured' if cdse_pass else 'MISSING'}")
print(f"Farm bounds:   {farm_polygon.bounds}")
print(f"STAC_URL:      {sat.STAC_SEARCH_URL}")
print(f"TOKEN_URL:     {sat.CDSE_TOKEN_URL}")
print(f"COLLECTION:    {sat.COLLECTION}")
print()


async def main():
    async with httpx.AsyncClient() as client:
        # ── Step 1: token ──────────────────────────────────────────
        print("── STEP 1: CDSE token ─────────────────────────────────")
        token = await sat._fetch_cdse_token(cdse_user, cdse_pass, client)
        if token:
            print(f"  Token: YES  len={len(token)}")
        else:
            print("  Token: FAILED — trying direct call for error detail")
            try:
                resp = await client.post(
                    sat.CDSE_TOKEN_URL,
                    data={'grant_type': 'password', 'client_id': sat.CDSE_CLIENT_ID,
                          'username': cdse_user, 'password': cdse_pass},
                    timeout=15,
                )
                print(f"  HTTP {resp.status_code}: {resp.text[:300]}")
            except Exception as ex:
                print(f"  Exception: {type(ex).__name__}: {ex}")
            return

        # ── Step 2: STAC search ────────────────────────────────────
        print("\n── STEP 2: STAC search (30 days, cloud<30%) ───────────")
        try:
            feats = await sat._search_scenes(farm_polygon, client)
            print(f"  Scenes: {len(feats)}")
            for f in feats[:5]:
                p = f.get('properties', {})
                print(f"    {f['id'][:58]}  cloud={p.get('eo:cloud_cover')}  dt={str(p.get('datetime',''))[:20]}")
        except Exception as e:
            print(f"  STAC FAILED: {type(e).__name__}: {e}")
            return

        if not feats:
            print("\n── STEP 2b: 90 days, cloud<30% ────────────────────────")
            feats = await sat._search_scenes(farm_polygon, client, max_age_days=90)
            print(f"  Scenes: {len(feats)}")

        if not feats:
            print("\n── STEP 2c: 90 days, no cloud filter ──────────────────")
            now = datetime.now(tz=timezone.utc)
            start = now - timedelta(days=90)
            resp = await client.post(
                sat.STAC_SEARCH_URL,
                json={"collections": [sat.COLLECTION], "bbox": list(farm_polygon.bounds),
                      "datetime": f"{start.strftime('%Y-%m-%dT%H:%M:%SZ')}/{now.strftime('%Y-%m-%dT%H:%M:%SZ')}",
                      "limit": 5},
                timeout=30, headers={"Content-Type": "application/json"},
            )
            print(f"  HTTP {resp.status_code}")
            data = resp.json()
            feats = data.get('features', [])
            print(f"  Scenes (no cloud filter): {len(feats)}")
            for f in feats[:5]:
                p = f.get('properties', {})
                print(f"    {f['id'][:58]}  cloud={p.get('eo:cloud_cover')}  dt={str(p.get('datetime',''))[:20]}")

        if not feats:
            print("\n  NO SCENES — checking bbox order")
            print(f"  bbox sent: {list(farm_polygon.bounds)}")
            print(f"  (STAC expects [minLon, minLat, maxLon, maxLat] — GeoJSON order)")
            return

        # ── Step 3: assets ─────────────────────────────────────────
        print("\n── STEP 3: Asset resolution ────────────────────────────")
        scene = feats[0]
        assets = scene.get('assets', {})
        print(f"  Scene: {scene['id']}")
        print(f"  Asset keys: {sorted(assets.keys())}")
        b4_href = sat._find_asset_href(assets, sat._BAND_ASSET_KEYS['B04'])
        b8_href = sat._find_asset_href(assets, sat._BAND_ASSET_KEYS['B08'])
        print(f"  B04 href: {'found  ' + b4_href[:55] if b4_href else 'NOT FOUND'}")
        print(f"  B08 href: {'found  ' + b8_href[:55] if b8_href else 'NOT FOUND'}")
        if not b4_href or not b8_href:
            return

        # ── Step 4: download ───────────────────────────────────────
        print("\n── STEP 4: Band download ───────────────────────────────")
        b4 = await sat._download_band_bytes(b4_href, client, token)
        print(f"  B04: {'OK  bytes=' + str(len(b4)) if b4 else 'FAILED'}")
        b8 = await sat._download_band_bytes(b8_href, client, token)
        print(f"  B08: {'OK  bytes=' + str(len(b8)) if b8 else 'FAILED'}")

        if not b4 or not b8:
            print("  Diagnosing auth on B04...")
            r_noauth = await client.get(b4_href, timeout=15, follow_redirects=False)
            print(f"  No-auth redirect/status: {r_noauth.status_code}")
            r_auth = await client.get(b4_href, timeout=15, follow_redirects=True,
                                      headers={"Authorization": f"Bearer {token}"})
            print(f"  With-auth HTTP: {r_auth.status_code}")
            if r_auth.status_code != 200:
                print(f"  Error body: {r_auth.text[:200]}")
            return

        # ── Step 5: NDVI ───────────────────────────────────────────
        print("\n── STEP 5: Clip and NDVI ───────────────────────────────")
        b4_arr = sat._clip_and_read_band(b4, farm_polygon)
        b8_arr = sat._clip_and_read_band(b8, farm_polygon)
        print(f"  B04 array: {'shape=' + str(b4_arr.shape) if b4_arr is not None else 'CLIP FAILED'}")
        print(f"  B08 array: {'shape=' + str(b8_arr.shape) if b8_arr is not None else 'CLIP FAILED'}")
        if b4_arr is not None and b8_arr is not None:
            ndvi = sat.compute_ndvi(b8_arr, b4_arr)
            mean, std, valid, total = sat._pixel_stats(ndvi)
            print(f"  NDVI: mean={mean}  std={std}  valid={valid}/{total}")

        print("\n── STEP 6: Full fetch() ────────────────────────────────")
        result = await sat.fetch(farm_polygon, data_mode='live',
                                 cdse_username=cdse_user, cdse_password=cdse_pass)
        print(f"  evidence_status: {result.evidence_status}")
        print(f"  error_message:   {result.error_message}")
        if result.payload:
            print(f"  NDVI: {result.payload.get('ndvi', {}).get('value')}")
            print(f"  NDMI: {result.payload.get('ndmi', {}).get('value')}")
            print(f"  scene_id: {result.payload.get('scene_id')}")


asyncio.run(main())
