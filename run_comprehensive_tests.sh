#!/bin/bash
# Comprehensive test runner for FarmTwin Docker system
# Handles port conflicts and runs all tests

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║       FarmTwin Comprehensive Docker & Module Test Suite             ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local max_wait=$2
    local elapsed=0
    
    echo -e "${YELLOW}Waiting for $service to be ready (max ${max_wait}s)...${NC}"
    
    while [ $elapsed -lt $max_wait ]; do
        if docker compose ps $service 2>/dev/null | grep -q "healthy\|running"; then
            echo -e "${GREEN}✓ $service is ready${NC}"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    echo -e "${RED}✗ $service failed to become ready${NC}"
    return 1
}

# Step 1: Check prerequisites
echo -e "\n${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python3 installed${NC}"

# Step 2: Check for port conflicts
echo -e "\n${BLUE}Step 2: Checking for port conflicts...${NC}"

USE_DEMO_DB=false
if check_port 5432; then
    echo -e "${YELLOW}⚠ Port 5432 is in use (local PostgreSQL detected)${NC}"
    echo -e "${YELLOW}  Will use demo database on port 5433 instead${NC}"
    USE_DEMO_DB=true
else
    echo -e "${GREEN}✓ Port 5432 is available${NC}"
fi

if check_port 8000; then
    echo -e "${YELLOW}⚠ Port 8000 is in use${NC}"
    echo -e "${YELLOW}  You may need to stop other services${NC}"
fi

# Step 3: Stop any existing services
echo -e "\n${BLUE}Step 3: Stopping existing services...${NC}"
docker compose down 2>/dev/null || true
echo -e "${GREEN}✓ Cleaned up existing containers${NC}"

# Step 4: Start database
echo -e "\n${BLUE}Step 4: Starting database service...${NC}"

if [ "$USE_DEMO_DB" = true ]; then
    echo "Starting demo database on port 5433..."
    docker compose --profile demo up -d db-demo
    wait_for_service "db-demo" 60 || exit 1
    DB_PORT=5433
    DB_NAME="farmtwin_demo"
else
    echo "Starting main database on port 5432..."
    docker compose up -d db
    wait_for_service "db" 60 || exit 1
    DB_PORT=5432
    DB_NAME="farmtwin"
fi

# Step 5: Start Redis
echo -e "\n${BLUE}Step 5: Starting Redis...${NC}"
docker compose up -d redis
wait_for_service "redis" 30 || exit 1

# Test Redis
echo "Testing Redis connection..."
if docker compose exec redis redis-cli PING | grep -q "PONG"; then
    echo -e "${GREEN}✓ Redis is responding${NC}"
else
    echo -e "${RED}✗ Redis connection failed${NC}"
    exit 1
fi

# Step 6: Setup database (if backend exists)
echo -e "\n${BLUE}Step 6: Setting up database...${NC}"

if [ -d "backend" ] && [ -f "backend/requirements.txt" ]; then
    cd backend
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv and install dependencies
    echo "Installing dependencies..."
    source venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    
    # Update .env if using demo DB
    if [ "$USE_DEMO_DB" = true ]; then
        if [ -f ".env" ]; then
            echo "Updating .env for demo database..."
            sed -i.bak "s/DATABASE__PORT=.*/DATABASE__PORT=5433/" .env
            sed -i.bak "s/DATABASE__NAME=.*/DATABASE__NAME=farmtwin_demo/" .env
        fi
    fi
    
    # Run migrations
    echo "Running database migrations..."
    if python -m app.db.management upgrade 2>/dev/null; then
        echo -e "${GREEN}✓ Migrations applied${NC}"
    else
        echo -e "${YELLOW}⚠ Migrations may already be applied or failed${NC}"
    fi
    
    # Load demo data
    echo "Loading demo data..."
    if python -m app.db.demo_setup 2>/dev/null; then
        echo -e "${GREEN}✓ Demo data loaded${NC}"
    else
        echo -e "${YELLOW}⚠ Demo data may already exist${NC}"
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠ Backend directory not found, skipping database setup${NC}"
fi

# Step 7: Start API and Worker
echo -e "\n${BLUE}Step 7: Starting API and Worker services...${NC}"

docker compose up -d api farmtwin-worker

echo "Waiting for API to be ready..."
sleep 10

# Test API
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${YELLOW}⚠ API may still be starting, check logs if tests fail${NC}"
fi

# Step 8: Run Docker system tests
echo -e "\n${BLUE}Step 8: Running Docker system tests...${NC}"
echo ""

if python3 test_docker_system.py; then
    echo -e "\n${GREEN}✓ Docker system tests PASSED${NC}"
    DOCKER_TESTS_PASSED=true
else
    echo -e "\n${RED}✗ Docker system tests FAILED${NC}"
    DOCKER_TESTS_PASSED=false
fi

# Step 9: Run backend module tests
echo -e "\n${BLUE}Step 9: Running backend module tests...${NC}"

BACKEND_TESTS_PASSED=false
if [ -d "backend" ]; then
    cd backend
    source venv/bin/activate
    
    echo "Running pytest..."
    if pytest -v --tb=short 2>&1 | tee /tmp/pytest_output.txt; then
        echo -e "\n${GREEN}✓ Backend tests PASSED${NC}"
        BACKEND_TESTS_PASSED=true
    else
        echo -e "\n${RED}✗ Backend tests FAILED${NC}"
        echo "See /tmp/pytest_output.txt for details"
        BACKEND_TESTS_PASSED=false
    fi
    
    # Show test summary
    if [ -f "/tmp/pytest_output.txt" ]; then
        echo -e "\n${BLUE}Test Summary:${NC}"
        grep -E "passed|failed|error" /tmp/pytest_output.txt | tail -5 || true
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠ Backend directory not found, skipping backend tests${NC}"
fi

# Step 10: Final summary
echo -e "\n${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                          TEST SUMMARY                                ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo "Services Started:"
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo ""

echo "Test Results:"
if [ "$DOCKER_TESTS_PASSED" = true ]; then
    echo -e "  ${GREEN}✓ Docker System Tests: PASSED${NC}"
else
    echo -e "  ${RED}✗ Docker System Tests: FAILED${NC}"
fi

if [ "$BACKEND_TESTS_PASSED" = true ]; then
    echo -e "  ${GREEN}✓ Backend Module Tests: PASSED${NC}"
elif [ -d "backend" ]; then
    echo -e "  ${RED}✗ Backend Module Tests: FAILED${NC}"
else
    echo -e "  ${YELLOW}⚠ Backend Module Tests: SKIPPED${NC}"
fi

echo ""
echo "Useful Commands:"
echo "  View logs:       docker compose logs -f"
echo "  Stop services:   docker compose down"
echo "  Restart:         docker compose restart"
echo "  Run API tests:   cd backend && source venv/bin/activate && pytest tests/"
echo ""

# Exit with appropriate code
if [ "$DOCKER_TESTS_PASSED" = true ] && ([ "$BACKEND_TESTS_PASSED" = true ] || [ ! -d "backend" ]); then
    echo -e "${GREEN}${BLUE}All tests completed successfully!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
