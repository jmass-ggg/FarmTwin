# Quick Docker & Module Test Guide

This guide helps you test all Docker services and modules for FarmTwin.

## Pre-Test Checklist

### 1. Check for Port Conflicts

Your system may have PostgreSQL already running on port 5432. Check with:

```bash
sudo lsof -i :5432
sudo lsof -i :6379
sudo lsof -i :8000
```

**If PostgreSQL is running locally:**

Option A: Stop local PostgreSQL temporarily:
```bash
sudo systemctl stop postgresql
```

Option B: Use the demo database on port 5433 (recommended):
```bash
# Edit compose.yaml to use db-demo profile or modify the port
docker compose --profile demo up -d db-demo redis
```

## Running the Tests

### Step 1: Start Required Services

**Option A: Standard Setup (port 5432 available)**
```bash
cd farmtwin
docker compose up -d db redis
```

**Option B: Demo Setup (if port 5432 is in use)**
```bash
cd farmtwin
docker compose --profile demo up -d db-demo redis
```

Wait for services to be healthy (~30 seconds):
```bash
# Check status
docker compose ps

# Watch logs
docker compose logs -f db redis
```

### Step 2: Setup Backend Database

```bash
cd backend

# Activate virtual environment (create if doesn't exist)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python -m app.db.management upgrade

# Load demo data
python -m app.db.demo_setup
```

### Step 3: Start API and Worker

```bash
# From farmtwin directory
docker compose up -d api farmtwin-worker

# Check API is healthy
curl http://localhost:8000/health
```

### Step 4: Run Docker System Tests

```bash
# From farmtwin directory
python3 test_docker_system.py
```

This will test:
- ✓ Docker installation
- ✓ Service status
- ✓ Health checks
- ✓ Database connectivity
- ✓ Redis operations
- ✓ API endpoints
- ✓ Network configuration
- ✓ Volume persistence

### Step 5: Run Backend Module Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest -v

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Expected: 420+ tests passing
```

### Step 6: Test Frontend (Optional)

```bash
cd frontend

# Install dependencies (if needed)
npm install

# Run tests
npm test

# Build to verify
npm run build
```

## Quick Verification Commands

### Check All Services
```bash
docker compose ps
```

Expected output:
```
NAME                  STATUS
farmtwin-api          Up (healthy)
farmtwin-db           Up (healthy)
farmtwin-redis        Up (healthy)
farmtwin-worker       Up
```

### Test Database Connection
```bash
docker compose exec db psql -U farmtwin_admin -d farmtwin -c "SELECT version();"
```

### Test Redis Connection
```bash
docker compose exec redis redis-cli PING
```

### Test API
```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/api/v1/me
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
```

## Troubleshooting

### Problem: Port 5432 Already in Use

**Solution 1: Use demo database on alternate port**
```bash
# Start demo DB on port 5433
docker compose --profile demo up -d db-demo

# Update backend/.env to use port 5433
# DATABASE__PORT=5433
```

**Solution 2: Stop local PostgreSQL**
```bash
sudo systemctl stop postgresql
docker compose up -d db
```

### Problem: API Not Starting

**Check logs:**
```bash
docker compose logs api
```

**Common causes:**
- Database not ready → Wait 30 seconds and try again
- Environment variables missing → Check `backend/.env`
- Migrations not run → Run `python -m app.db.management upgrade`

**Fix:**
```bash
docker compose restart api
```

### Problem: Tests Failing

**Verify services are healthy:**
```bash
docker compose ps
```

**Restart services:**
```bash
docker compose restart
```

**Check environment:**
```bash
cd backend
source venv/bin/activate
python -c "from app.core.config import Settings; print(Settings())"
```

### Problem: Database Connection in Tests

**Ensure test database is configured:**
```bash
# Check if using correct database
grep DATABASE backend/.env
```

**Reset database:**
```bash
cd backend
source venv/bin/activate
python -m app.db.management downgrade base
python -m app.db.management upgrade
python -m app.db.demo_setup
```

## Test Summary Checklist

After running all tests, verify:

- [ ] Docker and Docker Compose installed
- [ ] All 4 services running (db, redis, api, worker)
- [ ] All 4 health checks passing
- [ ] Database has PostGIS extension
- [ ] Database migrations applied
- [ ] Redis PING/PONG working
- [ ] API /health returns 200
- [ ] API /ready returns 200
- [ ] API /docs accessible
- [ ] Backend tests: 420+ passing
- [ ] Frontend tests passing (if applicable)
- [ ] Docker network configured
- [ ] Docker volumes persistent

## Full Test Execution (Automated)

Run everything in one go:

```bash
#!/bin/bash
set -e

echo "Starting services..."
cd farmtwin
docker compose up -d db redis
sleep 30

echo "Setting up database..."
cd backend
source venv/bin/activate
python -m app.db.management upgrade
python -m app.db.demo_setup

echo "Starting API and worker..."
cd ..
docker compose up -d api farmtwin-worker
sleep 10

echo "Running Docker system tests..."
python3 test_docker_system.py

echo "Running backend tests..."
cd backend
pytest -v --cov=app

echo "All tests complete!"
```

Save this as `run_all_tests.sh` and execute:
```bash
chmod +x run_all_tests.sh
./run_all_tests.sh
```

## Next Steps

1. ✓ Review test results
2. ✓ Check failed tests (if any)
3. ✓ Fix any configuration issues
4. ✓ Re-run tests until all pass
5. ✓ Document any environment-specific setup needed

For detailed test procedures, see `TESTING_GUIDE.md`.
