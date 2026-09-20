# FarmTwin Docker System Testing Guide

Complete guide for testing all Docker containers, modules, and system integration.

## Quick Start

### 1. Start All Services

```bash
cd farmtwin
./start_services.sh
```

This script will:
- Start PostgreSQL database
- Start Redis cache
- Start the API server
- Start the worker service
- Verify each service becomes healthy

### 2. Run Comprehensive System Tests

```bash
# From the farmtwin directory
python3 test_docker_system.py
```

This will test:
- ✓ Docker installation
- ✓ Service health checks
- ✓ Database connectivity
- ✓ Redis operations
- ✓ API endpoints
- ✓ Network configuration
- ✓ Volume persistence

## Detailed Testing Procedures

### Test Category 1: Docker Installation

**What it tests:**
- Docker is installed and accessible
- Docker Compose is installed and working

**Manual verification:**
```bash
docker --version
docker compose version
```

**Expected output:**
```
Docker version 29.0.0 or later
Docker Compose version v2.x or later
```

---

### Test Category 2: Service Status

**What it tests:**
- All required services are running
- Services: db, redis, api, farmtwin-worker

**Manual verification:**
```bash
docker compose ps
```

**Expected output:**
```
NAME                  IMAGE                     STATUS
farmtwin-api          farmtwin-backend          Up (healthy)
farmtwin-db           postgis/postgis:16-3.4    Up (healthy)
farmtwin-redis        redis:7-alpine            Up (healthy)
farmtwin-worker       farmtwin-backend          Up
```

---

### Test Category 3: Health Checks

**What it tests:**
- Container health checks are passing
- Services respond to health probes

**Manual verification:**
```bash
# Database health
docker compose exec db pg_isready -U farmtwin_admin -d farmtwin

# Redis health
docker compose exec redis redis-cli PING

# API health
curl http://localhost:8000/health
```

**Expected output:**
```
Database: accepting connections
Redis: PONG
API: {"status":"healthy"}
```

---

### Test Category 4: Database Connectivity

**What it tests:**
- PostgreSQL connection works
- PostGIS extension is installed
- Migrations are applied
- Database roles exist

**Manual verification:**
```bash
# Test connection
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "SELECT 1;"

# Check PostGIS
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "SELECT PostGIS_version();"

# Check migrations
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "SELECT version_num FROM alembic_version;"

# List tables
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "\dt"
```

**Expected output:**
```
Connection: (1 row)
PostGIS: 3.4.x version string
Migration: Latest version (e.g., 20250908_0008_climate_scenarios)
Tables: users, farms, geometry_revisions, etc.
```

---

### Test Category 5: Redis Connectivity

**What it tests:**
- Redis connection works
- SET/GET operations succeed
- Data persistence is working

**Manual verification:**
```bash
# PING test
docker compose exec redis redis-cli PING

# SET/GET test
docker compose exec redis redis-cli SET test_key test_value
docker compose exec redis redis-cli GET test_key
docker compose exec redis redis-cli DEL test_key

# Check keys
docker compose exec redis redis-cli KEYS "*"
```

**Expected output:**
```
PING: PONG
SET: OK
GET: "test_value"
DEL: (integer) 1
```

---

### Test Category 6: API Endpoints

**What it tests:**
- API is responding to HTTP requests
- Health endpoints work
- Authentication mode is correct
- Data mode headers are present

**Manual verification:**
```bash
# Health check
curl http://localhost:8000/health

# Readiness check
curl http://localhost:8000/ready

# API documentation
curl http://localhost:8000/docs

# User profile (local-demo mode)
curl http://localhost:8000/api/v1/me

# Check response headers
curl -I http://localhost:8000/api/v1/me
```

**Expected output:**
```
Health: 200 OK
Ready: {"status":"ready", "database":"connected", ...}
Docs: HTML page
Me: {"id":"00000000-0000-0000-0000-000000000001", ...}
Headers: X-FarmTwin-Data-Mode, X-FarmTwin-Auth-Mode
```

---

### Test Category 7: Network Configuration

**What it tests:**
- Docker network exists
- Services are connected to the network
- Service-to-service communication works

**Manual verification:**
```bash
# List networks
docker network ls

# Inspect network
docker network inspect farmtwin_network

# Test API to DB connection
docker compose exec api python -c "from app.core.database import engine; print(engine.connect())"

# Test API to Redis connection
docker compose exec api python -c "import redis; r=redis.Redis(host='redis', port=6379); print(r.ping())"
```

**Expected output:**
```
Network: farmtwin_network exists
Containers: 4+ containers connected
API-DB: Connection successful
API-Redis: True
```

---

### Test Category 8: Volume Persistence

**What it tests:**
- PostgreSQL data volume exists
- Redis data volume exists
- Data persists across container restarts

**Manual verification:**
```bash
# List volumes
docker volume ls | grep farmtwin

# Create test data
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "CREATE TABLE IF NOT EXISTS test_table (id serial, data text);"
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "INSERT INTO test_table (data) VALUES ('test_data');"

# Restart database
docker compose restart db

# Wait for DB to be ready
sleep 10

# Verify data persists
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "SELECT * FROM test_table;"

# Cleanup
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "DROP TABLE test_table;"
```

**Expected output:**
```
Volumes: farmtwin_postgres_data, redis_data
Data: test_data row exists after restart
```

---

### Test Category 9: Backend Module Tests

**What it tests:**
- All Python backend modules
- Unit tests pass
- Property-based tests pass
- Integration tests pass

**Run backend tests:**
```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Run all tests
pytest

# Run with verbosity
pytest -v

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run only property tests
pytest -v -m hypothesis

# Run specific test file
pytest tests/test_config.py -v
```

**Expected output:**
```
420+ tests passed
0 failures
Coverage: 80%+
```

---

### Test Category 10: Frontend Tests

**What it tests:**
- Frontend builds successfully
- Frontend unit tests pass
- Component tests pass

**Run frontend tests:**
```bash
cd frontend

# Install dependencies (if needed)
npm install

# Run tests
npm test

# Build frontend
npm run build

# Run lint
npm run lint
```

**Expected output:**
```
Tests: All tests pass
Build: dist/ directory created
Lint: No errors
```

---

### Test Category 11: Integration Tests

**What it tests:**
- End-to-end farm creation workflow
- Data persistence across services
- API → Database → Redis chain

**Manual integration test:**
```bash
# Create a test farm
curl -X POST http://localhost:8000/api/v1/farms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farm",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [36.8, -1.3],
        [36.81, -1.3],
        [36.81, -1.31],
        [36.8, -1.31],
        [36.8, -1.3]
      ]]
    }
  }'

# Get the farm ID from response, then retrieve it
FARM_ID="<id-from-response>"
curl http://localhost:8000/api/v1/farms/$FARM_ID

# Get digital twin
curl http://localhost:8000/api/v1/farms/$FARM_ID/twin

# Get crops
curl http://localhost:8000/api/v1/farms/$FARM_ID/crops

# Delete farm
curl -X DELETE http://localhost:8000/api/v1/farms/$FARM_ID
```

**Expected output:**
```
Create: 201 Created with farm object
Get: 200 OK with full farm details
Twin: 200 OK with environmental data
Crops: 200 OK with crop suitability scores
Delete: 204 No Content
```

---

## Common Issues and Solutions

### Issue: Services won't start

**Solution:**
```bash
# Check if ports are already in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :8000  # API

# Stop any conflicting services
docker compose down

# Remove volumes and restart fresh
docker compose down -v
docker compose up -d
```

### Issue: Database migrations not applied

**Solution:**
```bash
cd backend
source venv/bin/activate
python -m app.db.management current
python -m app.db.management upgrade
python -m app.db.demo_setup
```

### Issue: API returns 502/503 errors

**Solution:**
```bash
# Check API logs
docker compose logs api

# Restart API
docker compose restart api

# Check environment variables
docker compose exec api env | grep -E "(DATABASE|AUTH|DATA_MODE)"
```

### Issue: Tests fail with database connection errors

**Solution:**
```bash
# Verify database is running
docker compose ps db

# Check database logs
docker compose logs db

# Verify environment variables
cat backend/.env
```

---

## Automated Test Execution

Run the full automated test suite:

```bash
# Navigate to farmtwin directory
cd farmtwin

# Run comprehensive Docker tests
python3 test_docker_system.py

# Run backend tests
cd backend
source venv/bin/activate
pytest -v

# Run frontend tests
cd ../frontend
npm test
```

---

## Test Reports

The automated test script `test_docker_system.py` generates a detailed report including:

- ✓ Total tests passed/failed
- ✓ Pass rate percentage
- ✓ Detailed error messages for failures
- ✓ Timing information
- ✓ System information

Example output:
```
══════════════════════════════════════════════════════════════════════
TEST SUMMARY
══════════════════════════════════════════════════════════════════════
Total Tests: 25
Passed: 25
Failed: 0
Warnings: 0
Pass Rate: 100.0%

✓ ALL TESTS PASSED
```

---

## Continuous Integration

For CI/CD pipelines:

```bash
#!/bin/bash
set -e

# Start services
docker compose up -d
sleep 30  # Wait for services to be ready

# Run tests
python3 test_docker_system.py

# Run backend tests
cd backend
pytest --cov=app --cov-report=xml

# Stop services
docker compose down

exit $?
```

---

## Additional Resources

- Backend README: `backend/README.md`
- API Documentation: http://localhost:8000/docs
- Docker Compose Reference: `compose.yaml`
- Requirements: `.kiro/specs/release-validation/requirements.md`
