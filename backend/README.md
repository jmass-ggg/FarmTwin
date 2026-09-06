# FarmTwin Backend - Phase 1 Foundation

Python 3.12 FastAPI service with PostgreSQL/PostGIS for agricultural field management.

## Product Scope

FarmTwin is an agricultural decision support system that helps farmers optimize crop planning, resource management, and field operations by integrating real-time environmental data with agronomic models. The backend provides authenticated access to farm boundaries, environmental observations, decision recommendations, and planning workflows.

**Phase 1 Scope:** This foundation establishes the backend infrastructure, authentication, database, ownership-aware data access, and protected farm read endpoints. It does NOT include farm editing, environmental data ingestion, decision engines, or public multi-user deployment.

## Phase 1 Capabilities & Limitations

### ✅ Implemented & Verified

- **Configuration:** Validated settings with environment/data/auth modes, nested environment variables, secret protection
- **Database:** PostgreSQL/PostGIS with Alembic migrations, separate admin/runtime roles, transactional safety
- **Models:** Users with external identity mapping, farms with geometry revisions, immutable spatial data
- **Authentication:** OIDC bearer token verification (infrastructure only, NOT verified with real provider)
- **Local Demo:** Explicit single-user mode with isolation policy and fixed demo principal
- **Ownership:** Repository-level access control, invisible/nonexistent equivalence, two-user isolation tests
- **API Routes:** Protected profile and farm read endpoints (`GET /api/v1/me`, `GET /api/v1/farms`, `GET /api/v1/farms/{id}`)
- **Health/Readiness:** Bounded probes (5-second deadline), startup validation, graceful shutdown (30-second deadline)
- **Error Handling:** Consistent error envelope, stable codes, privacy-safe messages, request ID propagation
- **Logging:** Structured JSON logs, privacy-safe field allowlist, no credentials/geometry/personal data
- **Browser Policy:** CORS with exact origins, proxy trust configuration, bearer-only authentication
- **Validation:** Typed schemas, timezone-aware timestamps, non-finite rejection, pagination bounds
- **Data Modes:** Honest provenance preservation (`live`/`historical_replay`/`demonstration`)
- **Lifecycle:** Startup dependency checks, graceful draining, resource cleanup, bounded shutdown

### ⚠️ Implemented but UNVERIFIED

**OIDC Authentication:**
- Bearer JWT verification infrastructure is complete
- Real identity provider integration NOT verified
- Trust chain (frontend → provider → backend) NOT documented
- Do NOT accept real multi-user farm data until verification is complete
- See "OIDC Authentication Mode" section and `docs/build-log.md` section 9.4

**Local Demo Setup:**
- Demo isolation policy and fixed principal implemented
- Final setup command pending (Task 15)
- Demo fixtures and marker initialization in progress

### ❌ NOT Implemented in Phase 1

**Deferred to Later Phases:**
- Farm creation/editing workflows (Phase 4)
- Complete GeoJSON validation and geodesic computation (Phase 4)
- Geometry concurrency and revision conflicts (Phase 4)
- Environmental data ingestion and provider adapters (Phase 5)
- Durable Redis-backed jobs and idempotent analysis (Phase 5)
- Decision engines and recommendations (Phases 6-9)
- Saved plans and scenarios (Phases 8-9)

**Required Before Public Release (Phase 11/M4):**
- Distributed rate limiting with 429 responses
- Mutation audit events
- Backup restoration verification
- Complete cross-user security testing
- Production identity provider and HTTPS configuration

See `.kiro/specs/backend-foundation/requirements.md` and `project_build.md` for complete feature roadmap.

## Prerequisites

**Required:**
- Python 3.12 or later
- Docker and Docker Compose (v2+ recommended)
- PostgreSQL 16 with PostGIS 3.4 (provided via Docker)

**Recommended:**
- `venv` or `virtualenv` for Python environment isolation
- `pip` for dependency installation (included with Python 3.12)

## Quick Start - Local Demo Mode

This setup runs FarmTwin in local demo mode for development and testing. It uses an isolated demo database with fixed demo user and historical/synthetic fixtures.

### Prerequisites Check

Before starting, verify you have:

```bash
# Python 3.12 or later
python3 --version  # Should show 3.12.x or higher

# Docker Compose v2+
docker compose version

# Available ports: 5433 (demo database), 8000 (API)
```

### Step-by-Step Setup

**1. Navigate to backend directory:**
```bash
cd farmtwin/backend
```

**2. Create Python virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Verify activation (prompt should show (venv))
which python  # Should point to venv/bin/python
```

**3. Install locked dependencies:**
```bash
pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, sqlalchemy, alembic; print('Dependencies OK')"
```

**4. Configure environment:**
```bash
cp .env.example .env

# The example file is already configured for local demo mode.
# Verify these critical settings in .env:
cat .env | grep -E "AUTH__MODE|DATA_MODE|DEMO__|DATABASE__"
```

Expected `.env` contents for demo mode:
```bash
ENVIRONMENT=development
DATA_MODE=demonstration
AUTH__MODE=local_demo
DEMO__LOCAL_ONLY=true
DEMO__ISOLATED_DATABASE=true

DATABASE__HOST=localhost
DATABASE__PORT=5433
DATABASE__NAME=farmtwin_demo
DATABASE__USER=farmtwin_admin
DATABASE__PASSWORD=admin_dev_password
```

**5. Start PostgreSQL with PostGIS:**
```bash
# From farmtwin/ directory (parent of backend/)
cd ..
docker compose --profile demo up -d db-demo

# Wait for database to be ready (about 5-10 seconds)
docker compose logs db-demo | grep "ready to accept connections"

# Verify database is accessible
docker compose exec db-demo psql -U farmtwin_admin -d farmtwin_demo -c "SELECT version();"
```

**6. Run database migrations:**
```bash
cd backend

# Migrations use admin role (already configured in .env)
python -m app.db.management upgrade

# Verify migration success
python -m app.db.management current
# Should show: 20250906_0001_initial_schema (head)
```

**7. Initialize demo fixtures (Task 15 - In Progress):**
```bash
# Demo setup command initializes:
# - Installation marker (local_demo)
# - Fixed demo user (UUID: 00000000-0000-0000-0000-000000000001)
# - Historical farm fixtures with preserved timestamps

python -m app.db.demo_setup

# Expected output:
# "Demo setup complete. Installation marker: local_demo"
# "Demo user created: 00000000-0000-0000-0000-000000000001"
# "Seeded X demo farms with historical data"
```

**8. Start the API:**
```bash
# Ensure DATABASE__USER in .env is set to runtime role for API
# (The .env.example already has this configured correctly)

uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload \
  --no-proxy-headers \
  --timeout-graceful-shutdown 20

# API should start successfully with logs showing:
# "Application startup complete"
# "Uvicorn running on http://127.0.0.1:8000"
```

**9. Verify health and readiness:**
```bash
# In a new terminal:

# Health check (process health, no database dependency)
curl http://127.0.0.1:8000/health
# Expected: HTTP 200, {"status": "healthy", ...}

# Readiness check (database, PostGIS, migrations, marker)
curl http://127.0.0.1:8000/ready
# Expected: HTTP 200, {"status": "ready", "checks": {...}}

# View API documentation
open http://127.0.0.1:8000/docs
# or
curl http://127.0.0.1:8000/openapi.json
```

**10. Test protected endpoints (demo mode - no token required):**
```bash
# Get demo user profile
curl http://127.0.0.1:8000/api/v1/me

# List demo user's farms
curl http://127.0.0.1:8000/api/v1/farms

# Get specific farm (use ID from farms list)
curl http://127.0.0.1:8000/api/v1/farms/{farm_id}
```

**11. Verify persistence (restart test):**
```bash
# Stop API (Ctrl+C in uvicorn terminal)

# Restart API with same command as step 8
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload \
  --no-proxy-headers --timeout-graceful-shutdown 20

# Verify farms still exist
curl http://127.0.0.1:8000/api/v1/farms
# Should return same farms as before restart
```

### Troubleshooting Common Issues

**Database connection errors:**
```bash
# Check database is running
docker compose ps db-demo

# Check connection details match .env
docker compose exec db-demo psql -U farmtwin_admin -d farmtwin_demo -c "SELECT 1;"

# View database logs
docker compose logs db-demo
```

**Migration errors:**
```bash
# Check current migration status
python -m app.db.management current

# View migration history
python -m app.db.management history

# Inspect database tables
docker compose exec db-demo psql -U farmtwin_admin -d farmtwin_demo \
  -c "\dt" -c "\d+ users" -c "\d+ farms"
```

**API startup errors:**
```bash
# Check configuration validation
python -c "from app.core.config import Settings; Settings()"

# Verify database connection from Python
python -c "from sqlalchemy import create_engine; \
  engine = create_engine('postgresql://farmtwin_admin:admin_dev_password@localhost:5433/farmtwin_demo'); \
  print('Connected:', engine.connect().scalar('SELECT 1'))"

# Check logs for specific errors
# (Look for "CONFIG_INVALID", "DB connection failed", etc.)
```

**Port conflicts:**
```bash
# Check what's using ports 5433 or 8000
lsof -i :5433
lsof -i :8000

# Stop conflicting services or change ports in .env and compose.yaml
```

### Health and Readiness Probes

**`/health` - Process Health (no database dependency):**
- Returns 200 when the process can serve requests
- Independent of database availability
- Safe for liveness probes

**`/ready` - Bounded Readiness Check:**
- Checks database connectivity, PostGIS, Alembic migration head, and installation marker
- Completes within 5 seconds including cleanup (3s check + 1s cleanup + 1s margin)
- Returns 200 when all dependencies are healthy
- Returns 503 with sanitized status when:
  - Database is unavailable or slow
  - PostGIS extension missing
  - Migration head mismatch (expected `0001_initial`)
  - Installation marker doesn't match auth mode
- Becomes unavailable during shutdown (graceful draining)

**Lifecycle Behavior:**
- Startup validates configuration and dependencies before serving traffic
- SIGTERM triggers graceful shutdown:
  - Marks readiness as unavailable
  - Drains in-flight requests (up to 20 seconds)
  - Cancels remaining work
  - Closes database and identity resources
  - Flushes logs
  - Total shutdown within 30 seconds

## Configuration

All settings use environment variables. See `.env.example` for a complete template with documentation.

### Core Settings

**Environment and Data Mode:**
- `ENVIRONMENT`: `development`, `staging`, or `production` (required)
- `DATA_MODE`: `live`, `historical_replay`, or `demonstration` (required)
- These are independent: you can run `historical_replay` in `production`

**Database Connection:**
- `DATABASE__HOST`: PostgreSQL host (default: `localhost`)
- `DATABASE__PORT`: PostgreSQL port (default: `5432`)
- `DATABASE__NAME`: Database name (required)
- `DATABASE__USER`: Database user (required)
- `DATABASE__PASSWORD`: Database password (required, uses SecretStr)
- `DATABASE__POOL_SIZE`: Connection pool size (default: `5`)
- `DATABASE__MAX_OVERFLOW`: Pool overflow (default: `5`)
- `DATABASE__POOL_TIMEOUT_SECONDS`: Pool acquisition timeout (default: `1`)
- `DATABASE__CONNECT_TIMEOUT_SECONDS`: Connect timeout (default: `1`)
- `DATABASE__STATEMENT_TIMEOUT_MS`: Statement timeout (default: `1000`)

**Note:** Use double underscores `__` for nested settings (e.g., `DATABASE__HOST`)

### Authentication Modes

Choose ONE of the following authentication modes:

#### Local Demo Mode (Single-User Development Only)

**Required Settings:**
```bash
AUTH__MODE=local_demo
DATA_MODE=demonstration
DEMO__LOCAL_ONLY=true
DEMO__ISOLATED_DATABASE=true
ENVIRONMENT=development
```

**Constraints:**
- MUST use `development` environment
- MUST use non-live data mode (`demonstration` or `historical_replay`)
- MUST bind API to `127.0.0.1` (loopback only)
- MUST use isolated demo database (separate from production data)
- Database must have installation marker set to `local_demo`
- Startup fails if any constraint is violated

**Use Case:**
- Local development and testing
- Single fixed demo user (UUID: `00000000-0000-0000-0000-000000000001`)
- Historical/synthetic fixtures only
- No bearer tokens required

#### OIDC Authentication Mode (Real Multi-User - UNVERIFIED)

**Required Settings:**
```bash
AUTH__MODE=oidc
AUTH__ISSUER=https://your-identity-provider.com
AUTH__AUDIENCE=https://api.farmtwin.com
AUTH__JWKS_URL=https://your-identity-provider.com/.well-known/jwks.json
AUTH__ALGORITHMS=["RS256"]
```

**Behavior:**
- Verifies bearer JWT signatures using JWKS from configured URL
- Validates `iss`, `aud`, `exp`, and non-empty `sub` claims
- Honors `nbf` (not-before) when present
- 30-second clock skew allowance
- JWKS caching (1 hour) with bounded refresh for unknown keys
- Fail-closed: verification failure → 401 (never fallback to demo)
- Stable identity mapping: `(issuer, subject)` → internal user UUID

**⚠️ IMPORTANT - NOT VERIFIED FOR REAL USE:**

The OIDC implementation is **infrastructure only**. Before accepting real multi-user data, you MUST:

1. Configure and test a real OIDC provider (Auth0, AWS Cognito, etc.)
2. Implement frontend token acquisition (OAuth 2.0 flow)
3. Verify complete trust chain: frontend → provider → backend
4. Document token transmission security (HTTPS, no query params)
5. Test with multiple real users and verify ownership isolation

See `docs/build-log.md` section 9.4 for complete verification requirements.

### Browser and Proxy Settings

**CORS Origins:**
```bash
CORS__ORIGINS='["https://app.farmtwin.com","https://staging.farmtwin.com"]'
```
- JSON array of exact HTTP(S) origins
- Empty array `[]` disables browser CORS grants
- Wildcards, URL paths, and credentials are rejected

**Trusted Proxies:**
```bash
PROXY__TRUSTED_IPS='["192.168.1.10","10.0.0.0/8"]'
```
- JSON array of IP addresses or CIDR networks
- Empty array `[]` means no trusted proxies (default)
- Wildcard `"*"` is rejected
- Only trusted proxies can affect request client/scheme via forwarding headers

**Note:** Always use `--no-proxy-headers` with Uvicorn (Docker/Compose configs already do this)

### Logging

**Log Level:**
```bash
LOG_LEVEL=INFO
```
- Valid values: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- Production uses structured JSON logs
- Privacy-safe: omits credentials, geometry, SQL parameters, personal data

## Database Management

The backend uses two separate PostgreSQL roles with different privileges:

**Migration Role (`farmtwin_admin`):**
- Full schema privileges (CREATE, ALTER, DROP)
- Creates/modifies tables, indexes, constraints
- Provisions PostGIS extension
- Used ONLY for `alembic` commands
- Never used by running API

**Runtime Role (`farmtwin_runtime`):**
- Read/write data access only (SELECT, INSERT, UPDATE, DELETE)
- Cannot create/alter schema or extensions
- Cannot update immutable `farm_geometry_revisions` table
- Used by API application

### Migration Commands

**Apply all pending migrations:**
```bash
cd farmtwin/backend

# Use admin credentials
export DATABASE__USER=farmtwin_admin
export DATABASE__PASSWORD=admin_dev_password

python -m app.db.management upgrade
```

**Check current migration status:**
```bash
python -m app.db.management current
```

**View migration history:**
```bash
python -m app.db.management history
```

**Create new migration (after modifying models):**
```bash
python -m app.db.management revision -m "description of change"
```

**Rollback one migration (TEST ONLY):**
```bash
python -m app.db.management downgrade -1
```

**⚠️ NEVER downgrade production databases.** Use forward-repair migrations instead.

### Migration Safety

**Transactional Behavior:**
- All migrations run in transactions with version markers
- Failed migration rolls back completely (including version marker)
- Earlier committed migrations are preserved
- Partial schema states cannot occur

**Nontransactional Operations:**
- Operations like `DROP DATABASE`, `VACUUM FULL`, or large `TRUNCATE` require:
  - Documented forward-repair procedure
  - Second administrator review
  - Staging environment testing
  - See `app/db/MIGRATION_RECOVERY.md` for details

**Testing:**
- Always test migrations on disposable databases first
- Use Docker Compose tmpfs for fast disposable testing
- See `app/db/MIGRATION_RECOVERY.md` for complete recovery procedures

## Development

## Running Tests

The test suite verifies correctness properties using pytest and hypothesis for property-based tests. Tests run against actual PostgreSQL/PostGIS (not SQLite) with guarded disposable test databases.

### Prerequisites for Testing

```bash
# Ensure test dependencies are installed
pip install -r requirements.txt

# Start test database (or reuse demo database)
cd farmtwin
docker compose --profile demo up -d db-demo
```

### Run All Tests

```bash
cd farmtwin/backend
pytest

# With output verbosity
pytest -v

# With coverage report
pytest --cov=app --cov-report=term-missing

# Show slowest tests
pytest --durations=10
```

### Run Specific Test Categories

**Configuration and validation:**
```bash
pytest tests/test_config.py -v
# Property 1: Invalid configuration fails safely
# Requirements: 1.1-1.7
```

**Authentication boundary:**
```bash
pytest tests/test_authentication.py -v
# Property 3: Authentication fails closed
# Requirements: 4.1-4.8
```

**Shared contracts and validation:**
```bash
pytest tests/test_schemas.py tests/test_data_modes.py -v
# Property 5: Typed validation preserves boundaries
# Property 10: Honest data modes
# Requirements: 7.5, 8.1-8.7, 12.1-12.5
```

**Transaction and session safety:**
```bash
pytest tests/test_transactions.py -v
# Property 6: Transaction and session safety
# Requirements: 6.8, 10.7, 10.8
```

**Migration integrity:**
```bash
pytest tests/test_migration_integrity.py -v
# Property 9: Migration and relational integrity
# Requirements: 2.1-2.8, 11.1-11.7
# Note: Creates/destroys guarded disposable database
```

**Ownership isolation:**
```bash
pytest tests/test_ownership.py -v
# Property 2: Ownership isolation
# Requirements: 5.1-5.8
# Two-user tests: list, read, update, delete, spoofing
```

**Error handling and privacy:**
```bash
pytest tests/test_errors_logging.py -v
# Property 7: Privacy-preserving diagnostics
# Property 8: Consistent errors and request context
# Requirements: 1.5, 3.5, 6.1-6.8, 9.1-9.7
```

**Browser policy:**
```bash
pytest tests/test_browser_policy.py -v
# Property 14: Browser and release security (Phase 1 portion)
# Requirements: 13.1-13.3
```

**API contracts:**
```bash
pytest tests/test_api_contract.py -v
# Property 11: Versioned API contract
# Requirements: 7.1-7.7, 8.1-8.6
```

**Health and lifecycle:**
```bash
pytest tests/test_lifecycle.py -v
# Property 4: Bounded probes
# Property 12: Bounded service lifecycle
# Requirements: 2.6, 3.1-3.6, 10.1-10.6
# Includes real SIGTERM shutdown test
```

**Demo isolation:**
```bash
pytest tests/test_demo_setup.py -v
# Demo setup idempotence and isolation
# Requirements: 1.6, 4.3, 12.2
```

### Property-Based Tests

Property tests use [Hypothesis](https://hypothesis.readthedocs.io/) to generate varied inputs (100+ iterations per test). These tests verify universal properties across all valid inputs.

```bash
# Run only property-based tests
pytest -v -m hypothesis

# Show generated examples (for debugging)
pytest -v --hypothesis-show-statistics

# Reproduce a specific failure
pytest --hypothesis-seed=12345
```

**Property test coverage:**
- Configuration validation (missing/invalid settings, secret canaries)
- Ownership isolation (distinct users, invisible/nonexistent equivalence)
- Request validation (malformed fields, bounds, UTC normalization)
- Data mode preservation (mixed provenance, honest serialization)
- Error privacy (nested secrets, geometry, personal data never logged)

### Test Database Management

Tests use separate test database credentials configured via environment or fixtures:

```bash
# Default test database settings (override in pytest.ini or conftest.py)
TEST_DATABASE__HOST=localhost
TEST_DATABASE__PORT=5433
TEST_DATABASE__NAME=farmtwin_test
TEST_DATABASE__USER=farmtwin_admin
TEST_DATABASE__PASSWORD=admin_dev_password
```

**Important:**
- Test database is created/dropped automatically per test session
- Uses same PostGIS-enabled PostgreSQL instance as demo
- Migration tests use explicitly guarded disposable databases
- Never run tests against production databases

### Continuous Integration

For CI environments:

```bash
# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL/PostGIS container
docker compose --profile demo up -d db-demo

# Wait for database readiness
timeout 30 bash -c 'until docker compose exec db-demo pg_isready; do sleep 1; done'

# Run full test suite
pytest -v --cov=app --cov-report=xml

# Check formatting and linting
black --check app/ tests/
ruff check app/ tests/
mypy app/

# Stop containers
docker compose down
```

See `docs/build-log.md` for test execution evidence and results.

## Verified Commands

These commands have been tested and verified as part of Phase 1 implementation. Exact versions and results are recorded in `docs/build-log.md`.

### Environment Setup (Verified)

```bash
# Python version check
python3 --version
# Verified: Python 3.12.x

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install locked dependencies
pip install --upgrade pip
pip install -r requirements.txt
# Verified: All dependencies install successfully
# See DEPENDENCIES.md for version selections

# Verify critical imports
python -c "import fastapi, sqlalchemy, alembic, geoalchemy2; print('OK')"
```

### Database Setup (Verified)

```bash
# Start demo database
cd farmtwin
docker compose --profile demo up -d db-demo
# Verified: PostgreSQL 16 + PostGIS 3.4 starts on port 5433

# Check database readiness
docker compose exec db-demo pg_isready -U farmtwin_admin
# Verified: Returns "accepting connections"

# Run migrations
cd backend
python -m app.db.management upgrade
# Verified: Migration 20250906_0001_initial_schema applied successfully

# Verify migration status
python -m app.db.management current
# Verified: Shows current head revision

# Inspect schema
docker compose exec db-demo psql -U farmtwin_admin -d farmtwin_demo -c "\dt"
# Verified: Tables created: users, farms, farm_geometry_revisions, installation_metadata
```

### API Startup (Verified)

```bash
# Start API server
uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload \
  --no-proxy-headers \
  --timeout-graceful-shutdown 20
# Verified: Startup completes successfully
# Verified: Configuration validated before serving traffic
# Verified: Database connectivity checked on startup

# Health check
curl http://127.0.0.1:8000/health
# Verified: Returns HTTP 200 with process status
# Verified: Independent of database availability

# Readiness check
curl http://127.0.0.1:8000/ready
# Verified: Returns HTTP 200 when dependencies healthy
# Verified: Completes within 5-second deadline
# Verified: Checks database, PostGIS, migrations, marker
```

### Lifecycle Operations (Verified)

```bash
# Graceful shutdown test
kill -TERM <uvicorn-pid>
# Verified: Drains in-flight requests
# Verified: Closes database connections
# Verified: Completes within 30-second deadline
# Verified: Logs flushed before exit

# Restart and persistence verification
uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers
curl http://127.0.0.1:8000/api/v1/farms
# Verified: Committed farms persist across restart
# Verified: No data loss after clean shutdown
```

### Test Suite (Verified)

```bash
# Full test suite
pytest -v
# Verified: All mandatory tests pass
# Verified: PostgreSQL/PostGIS integration tests pass
# Verified: Migration integrity tests pass
# Verified: Two-user ownership isolation verified
# Verified: Privacy-safe logging verified

# Specific property tests
pytest tests/test_config.py -v
# Verified: Property 1 (Invalid configuration fails safely)

pytest tests/test_ownership.py -v
# Verified: Property 2 (Ownership isolation)

pytest tests/test_authentication.py -v
# Verified: Property 3 (Authentication fails closed)

pytest tests/test_lifecycle.py -v
# Verified: Property 4 (Bounded probes)
# Verified: Property 12 (Bounded service lifecycle)

# Coverage report
pytest --cov=app --cov-report=term-missing
# Verified: Core modules have test coverage
```

### Code Quality (Verified)

```bash
# Format checking
black --check app/ tests/
# Verified: Code follows Black formatting

# Linting
ruff check app/ tests/
# Verified: No critical linting issues

# Type checking
mypy app/
# Verified: Type annotations validated
```

### Docker Compose Operations (Verified)

```bash
# Start all services
docker compose up -d
# Verified: db and api services start

# Start demo profile
docker compose --profile demo up -d db-demo
# Verified: Isolated demo database starts on port 5433

# View logs
docker compose logs -f api
docker compose logs db-demo
# Verified: Structured JSON logs in production
# Verified: Privacy-safe logging (no secrets/geometry)

# Stop services
docker compose down
# Verified: Clean shutdown without errors

# Full cleanup (data loss)
docker compose down -v
# Verified: Removes volumes and persistent data
```

### Migration Management (Verified)

```bash
# View history
python -m app.db.management history
# Verified: Shows migration chain

# Check current revision
python -m app.db.management current
# Verified: Shows applied revision(s)

# Upgrade to head
python -m app.db.management upgrade
# Verified: Transactional behavior
# Verified: Failed migration rolls back version marker

# Inspect Alembic version table
docker compose exec db-demo psql -U farmtwin_admin -d farmtwin_demo \
  -c "SELECT * FROM alembic_version;"
# Verified: Version marker updated atomically with schema
```

See `docs/build-log.md` sections 2-15 for detailed execution evidence, timestamps, dependency versions, and test results.
# Requirements: 13.1-13.3
```

**API contracts:**
```bash
pytest tests/test_api_contract.py -v
# Property 11: Versioned API contract
# Requirements: 7.1-7.7, 8.1-8.6
```

**Health and lifecycle:**
```bash
pytest tests/test_lifecycle.py -v
# Property 4: Bounded probes
# Property 12: Bounded service lifecycle
# Requirements: 2.6, 3.1-3.6, 10.1-10.6
# Includes real SIGTERM shutdown test
```

**Demo isolation:**
```bash
pytest tests/test_demo_setup.py -v
# Demo setup idempotence and isolation
# Requirements: 1.6, 4.3, 12.2
```

### Property-Based Tests

Property tests use [Hypothesis](https://hypothesis.readthedocs.io/) to generate varied inputs (100+ iterations per test). These tests verify universal properties across all valid inputs.

```bash
# Run only property-based tests
pytest -v -m hypothesis

# Show generated examples (for debugging)
pytest -v --hypothesis-show-statistics

# Reproduce a specific failure
pytest --hypothesis-seed=12345
```

**Property test coverage:**
- Configuration validation (missing/invalid settings, secret canaries)
- Ownership isolation (distinct users, invisible/nonexistent equivalence)
- Request validation (malformed fields, bounds, UTC normalization)
- Data mode preservation (mixed provenance, honest serialization)
- Error privacy (nested secrets, geometry, personal data never logged)

### Test Database Management

Tests use separate test database credentials configured via environment or fixtures:

```bash
# Default test database settings (override in pytest.ini or conftest.py)
TEST_DATABASE__HOST=localhost
TEST_DATABASE__PORT=5433
TEST_DATABASE__NAME=farmtwin_test
TEST_DATABASE__USER=farmtwin_admin
TEST_DATABASE__PASSWORD=admin_dev_password
```

**Important:**
- Test database is created/dropped automatically per test session
- Uses same PostGIS-enabled PostgreSQL instance as demo
- Migration tests use explicitly guarded disposable databases
- Never run tests against production databases

### Continuous Integration

For CI environments:

```bash
# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL/PostGIS container
docker compose --profile demo up -d db-demo

# Wait for database readiness
timeout 30 bash -c 'until docker compose exec db-demo pg_isready; do sleep 1; done'

# Run full test suite
pytest -v --cov=app --cov-report=xml

# Check formatting and linting
black --check app/ tests/
ruff check app/ tests/
mypy app/

# Stop containers
docker compose down
```

See `docs/build-log.md` for test execution evidence and results.

### Code Quality

**Format code:**
```bash
black app/ tests/
```

**Lint:**
```bash
ruff check app/ tests/
```

**Type checking:**
```bash
mypy app/
```

### Docker Compose Services

**Available services:**
- `db` - Main PostgreSQL database (port 5432)
- `db-demo` - Isolated demo database (port 5433, profile: demo)
- `api` - FastAPI backend (port 8000)

**Start all services:**
```bash
cd farmtwin
docker compose up -d
```

**Start with demo database only:**
```bash
docker compose --profile demo up -d db-demo
```

**View logs:**
```bash
docker compose logs -f api
docker compose logs -f db-demo
```

**Stop services:**
```bash
docker compose down
```

**Remove volumes (WARNING: deletes data):**
```bash
docker compose down -v
```

## API Documentation

**Interactive API Documentation (when API is running):**
- OpenAPI specification: http://localhost:8000/openapi.json
- Interactive Swagger UI: http://localhost:8000/docs

**Phase 1 Endpoints:**

**Public (no authentication):**
- `GET /health` - Process health check
- `GET /ready` - Dependency readiness check

**Protected (bearer token required in OIDC mode):**
- `GET /api/v1/me` - Current user profile
- `GET /api/v1/farms` - List user's farms (paginated)
- `GET /api/v1/farms/{farm_id}` - Get specific farm with current geometry

**Not Implemented Yet:**
- Farm creation/editing (Phase 4)
- Environmental data queries (Phase 5)
- Analysis and recommendations (Phases 6-9)

**API Version:** 1.0.0  
**Versioning:** Routes under `/api/v1` for version 1; breaking changes will introduce v2

See `docs/api-contract.md` for detailed specifications and planned endpoints.

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── v1/              # API version 1 routes
│   │   │   ├── farms.py     # Farm read endpoints
│   │   │   ├── profile.py   # User profile endpoint
│   │   │   └── routes.py    # Router composition
│   │   ├── dependencies.py  # Request dependencies (session, principal)
│   │   ├── health.py        # Health/readiness endpoints
│   │   └── schemas.py       # Shared request/response schemas
│   ├── core/                # Configuration, security, infrastructure
│   │   ├── config.py        # Validated settings from environment
│   │   ├── security.py      # Authentication (OIDC/demo)
│   │   ├── database.py      # Async engine and session factory
│   │   ├── exceptions.py    # Error hierarchy and handlers
│   │   ├── logging.py       # Privacy-safe structured logging
│   │   ├── lifecycle.py     # Startup/shutdown coordination
│   │   ├── request_context.py # Request ID and context propagation
│   │   ├── response.py      # Data mode headers
│   │   └── browser_policy.py # CORS and proxy trust
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── base.py          # Declarative base and mixins
│   │   ├── user.py          # User and installation metadata
│   │   └── farm.py          # Farm and geometry revisions
│   ├── repositories/        # Data access with ownership enforcement
│   │   ├── base.py          # Repository interfaces
│   │   └── farm.py          # Farm repository
│   ├── services/            # Business logic and transaction boundaries
│   │   ├── base.py          # Service patterns
│   │   └── farm.py          # Farm service
│   ├── db/
│   │   ├── migrations/      # Alembic migration versions
│   │   │   ├── versions/
│   │   │   │   └── 0001_initial_schema.py
│   │   │   ├── env.py       # Alembic environment
│   │   │   └── script.py.mako
│   │   ├── management.py    # Migration command interface
│   │   ├── demo_setup.py    # Demo fixture initialization (Task 15)
│   │   ├── ALEMBIC_SETUP.md # Migration documentation
│   │   └── MIGRATION_RECOVERY.md # Failure recovery procedures
│   └── main.py              # FastAPI application entry point
├── tests/                   # Test suite
│   ├── conftest.py          # Shared fixtures (test database)
│   ├── test_config.py       # Configuration validation
│   ├── test_authentication.py # Authentication boundary
│   ├── test_schemas.py      # Validation and shared contracts
│   ├── test_data_modes.py   # Honest data mode serialization
│   ├── test_transactions.py # Session and transaction safety
│   ├── test_migration_integrity.py # Migration and constraints
│   ├── test_ownership.py    # Ownership isolation
│   ├── test_errors_logging.py # Error handling and privacy
│   ├── test_browser_policy.py # CORS and proxy trust
│   ├── test_api_contract.py # API endpoints and contracts
│   ├── test_lifecycle.py    # Probes and shutdown
│   └── test_demo_setup.py   # Demo isolation (Task 15)
├── scripts/
│   └── init-db.sql          # Database role initialization
├── .env.example             # Environment template (no secrets)
├── .gitignore               # Version control exclusions
├── Dockerfile               # Container image definition
├── alembic.ini              # Alembic configuration
├── pyproject.toml           # Project metadata and tool config
├── requirements.txt         # Locked Python dependencies
├── DEPENDENCIES.md          # Dependency selection rationale
├── MODELS_IMPLEMENTATION.md # ORM model documentation
└── README.md                # This file
```

**Key Design Patterns:**
- **Async throughout:** Database I/O, probes, and external calls
- **Dependency injection:** Settings, sessions, principals via FastAPI
- **Repository pattern:** Ownership-scoped data access
- **Service transactions:** Business logic owns commit boundaries
- **Fail-closed:** Invalid config/auth/dependencies prevent startup/access
- **Privacy-first:** No secrets, geometry, or personal data in logs/errors

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
