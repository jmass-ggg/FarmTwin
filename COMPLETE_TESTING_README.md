# FarmTwin Complete Testing Documentation

This directory contains comprehensive testing documentation and scripts for validating the entire FarmTwin system.

## Documentation Files

### 1. **TESTING_GUIDE.md** - Comprehensive Testing Manual
Complete guide covering all testing categories with manual verification steps.

**Categories Covered:**
- ✓ Docker Installation
- ✓ Service Status
- ✓ Health Checks
- ✓ Database Connectivity
- ✓ Redis Operations
- ✓ API Endpoints
- ✓ Network Configuration
- ✓ Volume Persistence
- ✓ Backend Module Tests
- ✓ Frontend Tests
- ✓ Integration Tests

**When to use:** Detailed manual testing, troubleshooting, understanding system components

---

### 2. **QUICK_TEST.md** - Quick Start Guide
Fast-track guide for getting services running and verifying functionality.

**Contents:**
- Pre-test checklist
- Port conflict resolution
- Quick service startup
- Essential verification commands
- Common troubleshooting

**When to use:** First-time setup, quick verification, rapid troubleshooting

---

### 3. **API_TESTING_GUIDE.md** - Complete API Reference
Comprehensive API endpoint documentation with curl examples for every endpoint.

**Endpoints Documented:**
- Health & Status (2 endpoints)
- User Profile (2 endpoints)
- Farm Management (5 endpoints)
- Digital Twin (1 endpoint)
- Crop Simulator (2 endpoints)
- Risk & Hazards (3 endpoints)
- Annual Planner (3 endpoints)
- Climate Scenarios (1 endpoint)
- Conduit Data (3 endpoints)
- Data Sources (1 endpoint)

**Total: 23+ API endpoints with examples**

**When to use:** API development, integration testing, learning the API

---

## Automated Test Scripts

### 1. **test_docker_system.py** - Docker System Tests
Python script that validates all Docker containers and infrastructure.

**What it tests:**
- Docker installation
- Service health (db, redis, api, worker)
- Container health checks
- Database connectivity (PostgreSQL + PostGIS)
- Redis operations (PING, SET, GET)
- API endpoints (/health, /ready, /api/v1/me)
- Docker network configuration
- Volume persistence

**Run:**
```bash
python3 test_docker_system.py
```

**Output:** Colored terminal output with pass/fail indicators and summary report

---

### 2. **test_all_apis.sh** - API Endpoint Tests
Bash script that tests all API endpoints systematically.

**What it tests:**
- All public endpoints
- Farm-specific endpoints (using real farm data)
- Crop and hazard endpoints
- Conduit data endpoints
- API documentation endpoints
- HTTP status code validation

**Run:**
```bash
./test_all_apis.sh
```

**Output:** Colored pass/fail for each endpoint with summary statistics

---

### 3. **run_comprehensive_tests.sh** - Full System Test Suite
Complete automated testing workflow from start to finish.

**What it does:**
1. Checks prerequisites (Docker, Python)
2. Detects and resolves port conflicts
3. Starts all Docker services
4. Runs database migrations
5. Loads demo data
6. Executes Docker system tests
7. Runs backend module tests (pytest)
8. Generates comprehensive summary

**Run:**
```bash
./run_comprehensive_tests.sh
```

**Output:** Full test report with pass/fail for all categories

---

### 4. **start_services.sh** - Service Startup Script
Helper script to start all Docker services with health checks.

**What it does:**
- Starts PostgreSQL with health wait
- Starts Redis with health wait
- Checks migration status
- Starts API service
- Starts worker service
- Verifies all services are healthy

**Run:**
```bash
./start_services.sh
```

**Output:** Step-by-step service startup with health verification

---

## Quick Start

### Option 1: Full Automated Testing (Recommended)

```bash
cd farmtwin
./run_comprehensive_tests.sh
```

This runs everything: starts services, runs migrations, executes all tests.

---

### Option 2: Step-by-Step Testing

**Step 1: Start Services**
```bash
./start_services.sh
```

**Step 2: Test Docker Infrastructure**
```bash
python3 test_docker_system.py
```

**Step 3: Test All API Endpoints**
```bash
./test_all_apis.sh
```

**Step 4: Test Backend Modules**
```bash
cd backend
source venv/bin/activate
pytest -v
```

---

### Option 3: Manual Testing

Follow the comprehensive manual in `TESTING_GUIDE.md` for step-by-step testing with explanations.

---

## Test Coverage Summary

### Infrastructure Tests
- ✓ Docker & Docker Compose installation
- ✓ 4 services: db, redis, api, worker
- ✓ 3 health checks: db, redis, api
- ✓ Network configuration
- ✓ Volume persistence

### Database Tests
- ✓ PostgreSQL connection
- ✓ PostGIS extension
- ✓ 8 Alembic migrations
- ✓ Database roles (admin, runtime)
- ✓ Table schema integrity

### API Tests
- ✓ 23+ endpoints
- ✓ Authentication modes
- ✓ Data mode headers
- ✓ Error responses
- ✓ OpenAPI documentation

### Backend Module Tests
- ✓ 420+ pytest tests
- ✓ Unit tests
- ✓ Property-based tests (Hypothesis)
- ✓ Integration tests
- ✓ Configuration validation

### Integration Tests
- ✓ API → Database → Redis chain
- ✓ Farm creation workflow
- ✓ Digital twin generation
- ✓ Crop analysis pipeline
- ✓ Risk assessment workflow

---

## Test Execution Order

For best results, run tests in this order:

1. **Prerequisites** → Check Docker, Python, ports
2. **Service Startup** → Start all containers
3. **Infrastructure** → Verify Docker system
4. **API Endpoints** → Test all APIs
5. **Backend Modules** → Run pytest suite
6. **Integration** → End-to-end workflows

---

## Common Issues & Solutions

### Issue: Port 5432 Already in Use

**Solution:**
```bash
# Use demo database on port 5433
docker compose --profile demo up -d db-demo

# Update backend/.env
sed -i 's/DATABASE__PORT=5432/DATABASE__PORT=5433/' backend/.env
```

---

### Issue: Services Won't Start

**Solution:**
```bash
# Check logs
docker compose logs

# Restart services
docker compose down
docker compose up -d
```

---

### Issue: API Tests Fail

**Solution:**
```bash
# Verify API is running
curl http://localhost:8000/health

# Check API logs
docker compose logs api

# Restart API
docker compose restart api
```

---

### Issue: Database Connection Fails

**Solution:**
```bash
# Check database status
docker compose exec db pg_isready

# Verify migrations
cd backend
source venv/bin/activate
python -m app.db.management current
```

---

## Environment Configuration

### Local Demo Mode (Default)
```bash
# backend/.env
AUTH__MODE=local_demo
DATA_MODE=demonstration
DEMO__LOCAL_ONLY=true
```

No authentication required. Uses demo user and historical data.

### OIDC Production Mode
```bash
# backend/.env
AUTH__MODE=oidc
DATA_MODE=live
AUTH__ISSUER=https://your-provider.com
AUTH__AUDIENCE=https://api.farmtwin.com
```

Requires bearer token authentication.

---

## Test Reports & Logs

### Test Outputs
- Docker tests: Terminal output
- API tests: Terminal output + status codes
- Backend tests: pytest output + coverage report
- Comprehensive tests: Summary report

### Log Locations
- API logs: `docker compose logs api`
- Database logs: `docker compose logs db`
- Worker logs: `docker compose logs farmtwin-worker`
- Redis logs: `docker compose logs redis`

---

## Continuous Integration

For CI/CD pipelines, use the comprehensive test script:

```yaml
# .github/workflows/test.yml
steps:
  - name: Run comprehensive tests
    run: |
      cd farmtwin
      ./run_comprehensive_tests.sh
```

---

## Additional Resources

- **Backend README:** `backend/README.md` - Backend-specific documentation
- **API Contract:** `docs/api-contract.md` - Formal API specification
- **Architecture Docs:** `docs/` - System architecture and design decisions
- **Specifications:** `.kiro/specs/` - Feature specifications and requirements

---

## Getting Help

### View Service Status
```bash
docker compose ps
```

### View API Documentation
Open browser: http://localhost:8000/docs

### Check Service Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
```

### Manual Test Examples
See `API_TESTING_GUIDE.md` for curl commands for every endpoint

---

## Test Checklist

Before deploying or releasing, ensure:

- [ ] All Docker services running
- [ ] All health checks passing
- [ ] Database migrations applied
- [ ] All API endpoints responding
- [ ] 420+ backend tests passing
- [ ] No linting errors (black, ruff)
- [ ] Frontend builds successfully
- [ ] Integration workflows complete
- [ ] No security vulnerabilities
- [ ] Documentation up to date

---

## Summary

You now have **4 documentation files** and **4 automated scripts** covering:

✓ Complete testing methodology  
✓ Every API endpoint with examples  
✓ Automated Docker validation  
✓ Automated API testing  
✓ Full system test orchestration  
✓ Service startup automation  

**Total test coverage:** Infrastructure + Database + API + Backend + Integration

**Ready to test?** Run `./run_comprehensive_tests.sh` to validate everything!
