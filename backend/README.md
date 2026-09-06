# FarmTwin Backend - Phase 1 Foundation

Python 3.12 FastAPI service with PostgreSQL/PostGIS for agricultural field management.

## Phase 1 Scope

This foundation implements:
- Configuration with validated settings
- PostgreSQL/PostGIS persistence with Alembic migrations
- Bearer token authentication (OIDC) or local demo mode
- Ownership-aware repositories
- Protected farm read endpoints
- Health and readiness probes
- Privacy-safe structured logging
- Bounded service lifecycle

**Not Implemented in Phase 1:**
- Farm creation/editing (Phase 4)
- Environmental data ingestion (Phase 5)
- Decision engines (Phases 6-9)
- Rate limiting (Phase 11/M4)

## Prerequisites

- Python 3.12+
- Docker and Docker Compose
- PostgreSQL 16 with PostGIS 3.4 (provided via Docker)

## Quick Start - Local Demo Mode

1. **Copy environment configuration:**
   ```bash
   cd farmtwin/backend
   cp .env.example .env
   ```

2. **Start PostgreSQL with PostGIS:**
   ```bash
   cd farmtwin
   docker compose up -d db-demo
   ```

3. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Run database migrations:**
   ```bash
   # Set migration credentials
   export DATABASE__USER=farmtwin_admin
   export DATABASE__PASSWORD=admin_dev_password
   export DATABASE__NAME=farmtwin_demo
   export DATABASE__PORT=5433
   
   # Run migrations
   alembic upgrade head
   ```

5. **Initialize demo fixtures:**
   ```bash
   # Run demo setup command (to be implemented in later tasks)
   python -m app.cli setup-demo
   ```

6. **Start the API:**
   ```bash
   # Ensure .env points to demo database (farmtwin_demo on port 5433)
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload \
     --no-proxy-headers --timeout-graceful-shutdown 20
   ```

7. **Verify health:**
   ```bash
   curl http://127.0.0.1:8000/health
   curl http://127.0.0.1:8000/ready
   ```

`/health` is process-only and remains independent of PostgreSQL. `/ready`
checks connectivity, PostGIS, the exact Alembic head, and the installation
marker inside one bounded probe. Startup performs the same verification and
fails instead of migrating or serving against an incompatible database.

SIGTERM removes readiness and allows at most 20 seconds for in-flight requests;
request cancellation, database/identity-client disposal, and log flushing use
the remaining shutdown budget. Container stop grace is 30 seconds.

## Configuration

See `.env.example` for all available settings. Key configuration modes:

### Local Demo Mode
- `AUTH__MODE=local_demo`
- `DATA_MODE=demonstration`
- `DEMO__LOCAL_ONLY=true`
- `DEMO__ISOLATED_DATABASE=true`
- Bind API to `127.0.0.1` only
- Use isolated demo database (`farmtwin_demo`)

### OIDC Authentication Mode
- `AUTH__MODE=oidc`
- Configure `AUTH__ISSUER`, `AUTH__AUDIENCE`, `AUTH__JWKS_URL`, `AUTH__ALGORITHMS`
- Requires verified identity provider integration
- Frontend-to-backend trust mechanism must be documented
- Use HTTPS for every non-loopback authenticated connection
- Keep provider credentials and signing material on backend infrastructure

### Browser and Reverse-Proxy Policy

- `CORS__ORIGINS` is a JSON list of exact `http://` or `https://` origins. An
  empty list disables cross-origin browser grants. Wildcards, URL paths, and
  credential-bearing origins are rejected at startup.
- Browser authentication is bearer-header only. Cookie authentication is
  prohibited until a CSRF design and its tests are approved.
- `PROXY__TRUSTED_IPS` is a JSON list of the exact proxy IPs or canonical CIDR
  networks allowed to affect the request client/scheme using forwarding
  headers. It defaults to no trusted proxies and rejects `"*"`.
- Always launch Uvicorn with `--no-proxy-headers`; FarmTwin applies its own
  configured trust list. The included Docker and Compose commands already do
  this.

See [deployment.md](../../docs/deployment.md) for the TLS termination,
forwarding-header, secret-storage, and verification boundaries.

### Database Roles

**Migration role (farmtwin_admin):**
- Has full schema privileges
- Used only for `alembic` commands
- Never used by running API

**Runtime role (farmtwin_runtime):**
- Read/write data access only
- Cannot create/alter schema or extensions
- Used by API application

## Development

### Running Tests
```bash
# All tests
pytest

# With coverage
pytest --cov=app

# Specific test file
pytest tests/test_config.py

# Property-based tests (minimum 100 iterations configured)
pytest -v tests/test_properties.py
```

### Database Migrations

**Create new migration:**
```bash
alembic revision -m "description"
```

**Apply migrations:**
```bash
alembic upgrade head
```

**Downgrade (test only, not for production):**
```bash
alembic downgrade -1
```

### Code Quality
```bash
# Format
black app/ tests/

# Lint
ruff check app/ tests/

# Type check
mypy app/
```

## Docker Compose Services

**db:** Main PostgreSQL database (port 5432)
**db-demo:** Isolated demo database (port 5433, profile: demo)
**api:** FastAPI backend (port 8000)

Start all services:
```bash
docker compose up -d
```

Start with demo database:
```bash
docker compose --profile demo up -d
```

## API Documentation

When running:
- OpenAPI spec: http://localhost:8000/openapi.json
- Interactive docs: http://localhost:8000/docs

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/          # API version 1 routes
│   ├── core/            # Config, security, database, logging
│   ├── models/          # SQLAlchemy ORM models
│   ├── repositories/    # Data access with ownership
│   ├── services/        # Business logic and transactions
│   └── db/
│       └── migrations/  # Alembic migrations
├── tests/               # Test suite
├── scripts/             # Database initialization scripts
├── pyproject.toml       # Project metadata
├── requirements.txt     # Locked dependencies
├── Dockerfile           # Container definition
└── alembic.ini         # Migration configuration
```

## Phase Gates

Phase 1 is complete when:
1. Clean startup from documented instructions succeeds
2. Alembic installs schema on empty PostgreSQL/PostGIS database
3. Unauthorized farm access is rejected with test evidence
4. All mandatory tests pass

See `docs/build-log.md` for implementation progress and evidence.

## References

- Requirements: `.kiro/specs/backend-foundation/requirements.md`
- Design: `.kiro/specs/backend-foundation/design.md`
- Master Plan: `project_build.md`
- Dependency Decisions: `DEPENDENCIES.md`
