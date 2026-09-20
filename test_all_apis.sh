#!/bin/bash
# Comprehensive API endpoint testing script

API_BASE="${API_BASE:-http://localhost:8000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              FarmTwin API Comprehensive Test Suite                  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Testing against: $API_BASE"
echo ""

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_status=${4:-200}
    
    echo -n "Testing $method $endpoint... "
    
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE$endpoint" 2>&1)
    status_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ $status_code${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ $status_code (expected $expected_status)${NC}"
        if [ ! -z "$body" ]; then
            echo "  Response: $(echo $body | head -c 100)..."
        fi
        ((FAILED++))
        return 1
    fi
}

echo -e "${BLUE}Category 1: Health & Status Endpoints${NC}"
test_endpoint "Health Check" GET "/health"
test_endpoint "Readiness Check" GET "/ready"
echo ""

echo -e "${BLUE}Category 2: User Profile Endpoints${NC}"
test_endpoint "Get User Profile" GET "/api/v1/me"
echo ""

echo -e "${BLUE}Category 3: Farm Management Endpoints${NC}"
test_endpoint "List Farms" GET "/api/v1/farms"
test_endpoint "List Farms (paginated)" GET "/api/v1/farms?limit=10&offset=0"
echo ""

echo -e "${BLUE}Category 4: Data Sources Endpoints${NC}"
test_endpoint "Get Data Sources" GET "/api/v1/data-sources"
echo ""

echo -e "${BLUE}Category 5: Conduit Data Endpoints${NC}"
test_endpoint "Get Current Conduit Data" GET "/api/v1/conduit/current"
test_endpoint "Get Conduit Features" GET "/api/v1/conduit/features"
test_endpoint "Get Conduit History" GET "/api/v1/conduit/history"
test_endpoint "Get Conduit History (paginated)" GET "/api/v1/conduit/history?limit=10"
echo ""

# Get first farm ID for farm-specific tests
echo -e "${BLUE}Category 6: Farm-Specific Endpoints${NC}"
echo "Getting first farm ID for testing..."
FARMS_RESPONSE=$(curl -s "$API_BASE/api/v1/farms")
FARM_ID=$(echo $FARMS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$FARM_ID" ]; then
    echo -e "${GREEN}Using farm ID: $FARM_ID${NC}"
    echo ""
    
    test_endpoint "Get Farm Details" GET "/api/v1/farms/$FARM_ID"
    test_endpoint "Get Farm Digital Twin" GET "/api/v1/farms/$FARM_ID/twin"
    test_endpoint "Get Farm Crops" GET "/api/v1/farms/$FARM_ID/crops"
    test_endpoint "Get Farm Risks" GET "/api/v1/farms/$FARM_ID/risks"
    test_endpoint "Get Farm Annual Plan" GET "/api/v1/farms/$FARM_ID/plan"
    test_endpoint "Get Farm Annual Plan (specific year)" GET "/api/v1/farms/$FARM_ID/plan?year=2027"
    
    # Test specific crop
    echo "Getting first crop for testing..."
    CROPS_RESPONSE=$(curl -s "$API_BASE/api/v1/farms/$FARM_ID/crops")
    CROP_ID=$(echo $CROPS_RESPONSE | grep -o '"crop_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$CROP_ID" ]; then
        echo -e "${GREEN}Using crop ID: $CROP_ID${NC}"
        test_endpoint "Get Specific Crop Details" GET "/api/v1/farms/$FARM_ID/crops/$CROP_ID"
    else
        echo -e "${YELLOW}⚠ No crops found, skipping crop detail test${NC}"
    fi
    
    # Test specific hazard
    RISKS_RESPONSE=$(curl -s "$API_BASE/api/v1/farms/$FARM_ID/risks")
    HAZARD=$(echo $RISKS_RESPONSE | grep -o '"hazard_type":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$HAZARD" ]; then
        echo -e "${GREEN}Using hazard: $HAZARD${NC}"
        test_endpoint "Get Specific Hazard Details" GET "/api/v1/farms/$FARM_ID/risks/$HAZARD"
    else
        echo -e "${YELLOW}⚠ No hazards found, skipping hazard detail test${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠ No farms found, skipping farm-specific tests${NC}"
    echo -e "${YELLOW}  Create a farm first using: POST /api/v1/farms${NC}"
fi

echo ""

# Test API documentation
echo -e "${BLUE}Category 7: API Documentation${NC}"
test_endpoint "OpenAPI JSON" GET "/openapi.json"
test_endpoint "Swagger UI" GET "/docs"
test_endpoint "ReDoc" GET "/redoc"
echo ""

# Summary
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                          TEST SUMMARY                                ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED/$TOTAL)*100}")
else
    PASS_RATE="0.0"
fi

echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Pass Rate: ${PASS_RATE}%"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All API tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Ensure API is running: curl $API_BASE/health"
    echo "  2. Check API logs: docker compose logs api"
    echo "  3. Verify database: docker compose exec db pg_isready"
    echo "  4. Check services: docker compose ps"
    exit 1
fi
