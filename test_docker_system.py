#!/usr/bin/env python3
"""
Comprehensive Docker System Test for FarmTwin
Tests all Docker containers, modules, and integrations
"""

import subprocess
import sys
import time
import json
from typing import Dict, List, Tuple
import urllib.request
import urllib.error

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.tests: List[Tuple[str, bool, str]] = []
    
    def add_test(self, name: str, passed: bool, message: str = ""):
        self.tests.append((name, passed, message))
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def add_warning(self, name: str, message: str):
        self.tests.append((name, None, message))
        self.warnings += 1

def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 70}")
    print(f"{text}")
    print(f"{'=' * 70}{Colors.RESET}\n")

def print_test(name: str, passed: bool, message: str = ""):
    if passed:
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}"
    else:
        status = f"{Colors.RED}✗ FAIL{Colors.RESET}"
    
    print(f"{status} {name}")
    if message:
        print(f"       {message}")

def print_warning(name: str, message: str):
    print(f"{Colors.YELLOW}⚠ WARNING{Colors.RESET} {name}")
    if message:
        print(f"          {message}")

def run_command(cmd: List[str], timeout: int = 30) -> Tuple[bool, str]:
    """Run a shell command and return success status and output"""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, f"Command timed out after {timeout} seconds"
    except Exception as e:
        return False, str(e)

def test_docker_installed(results: TestResult):
    """Test 1: Docker is installed and running"""
    print_header("TEST CATEGORY 1: Docker Installation")
    
    success, output = run_command(["docker", "--version"])
    results.add_test("Docker installed", success, output.strip() if success else output)
    print_test("Docker installed", success, output.strip() if success else output)
    
    success, output = run_command(["docker", "compose", "version"])
    results.add_test("Docker Compose installed", success, output.strip() if success else output)
    print_test("Docker Compose installed", success, output.strip() if success else output)

def test_docker_services(results: TestResult):
    """Test 2: Docker services are running"""
    print_header("TEST CATEGORY 2: Docker Services Status")
    
    # Check if services are running
    success, output = run_command(["docker", "compose", "-f", "compose.yaml", "ps", "--format", "json"])
    
    if not success:
        results.add_test("Docker services query", False, "Failed to query docker services")
        print_test("Docker services query", False, output)
        return
    
    try:
        # Parse the output - each line is a separate JSON object
        services_status = {}
        for line in output.strip().split('\n'):
            if line.strip():
                service = json.loads(line)
                services_status[service['Service']] = service['State']
        
        # Check each expected service
        expected_services = ['db', 'redis', 'api', 'farmtwin-worker']
        
        for service_name in expected_services:
            is_running = services_status.get(service_name) == 'running'
            results.add_test(f"{service_name} service running", is_running, 
                           f"State: {services_status.get(service_name, 'not found')}")
            print_test(f"{service_name} service running", is_running,
                      f"State: {services_status.get(service_name, 'not found')}")
    
    except json.JSONDecodeError as e:
        results.add_test("Parse Docker services", False, f"JSON decode error: {e}")
        print_test("Parse Docker services", False, f"JSON decode error: {e}")

def test_docker_health(results: TestResult):
    """Test 3: Docker container health checks"""
    print_header("TEST CATEGORY 3: Container Health Checks")
    
    # Check health status
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "ps", 
        "--format", "json"
    ])
    
    if not success:
        results.add_test("Container health query", False, output)
        print_test("Container health query", False, output)
        return
    
    try:
        for line in output.strip().split('\n'):
            if line.strip():
                container = json.loads(line)
                service_name = container['Service']
                health = container.get('Health', 'no healthcheck')
                
                # API and DB should have health checks
                if service_name in ['api', 'db', 'redis']:
                    is_healthy = health == 'healthy'
                    results.add_test(f"{service_name} health check", is_healthy, 
                                   f"Health: {health}")
                    print_test(f"{service_name} health check", is_healthy, f"Health: {health}")
    
    except json.JSONDecodeError as e:
        results.add_test("Parse health status", False, f"JSON decode error: {e}")
        print_test("Parse health status", False, f"JSON decode error: {e}")

def test_database_connection(results: TestResult):
    """Test 4: Database connectivity"""
    print_header("TEST CATEGORY 4: Database Connectivity")
    
    # Test PostgreSQL connection
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "db",
        "psql", "-U", "farmtwin_admin", "-d", "farmtwin", "-c", "SELECT 1;"
    ], timeout=10)
    
    results.add_test("PostgreSQL connection", success, output.strip() if not success else "Connected successfully")
    print_test("PostgreSQL connection", success, output.strip() if not success else "Connected successfully")
    
    # Test PostGIS extension
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "db",
        "psql", "-U", "farmtwin_admin", "-d", "farmtwin", 
        "-c", "SELECT PostGIS_version();"
    ], timeout=10)
    
    results.add_test("PostGIS extension", success, "PostGIS available" if success else output)
    print_test("PostGIS extension", success, "PostGIS available" if success else output)
    
    # Check migration status
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "db",
        "psql", "-U", "farmtwin_admin", "-d", "farmtwin", 
        "-c", "SELECT version_num FROM alembic_version;"
    ], timeout=10)
    
    results.add_test("Database migrations", success, 
                    output.strip().split('\n')[2].strip() if success else "Migration check failed")
    print_test("Database migrations", success,
              output.strip().split('\n')[2].strip() if success else "Migration check failed")

def test_redis_connection(results: TestResult):
    """Test 5: Redis connectivity"""
    print_header("TEST CATEGORY 5: Redis Connectivity")
    
    # Test Redis PING
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "redis",
        "redis-cli", "PING"
    ], timeout=10)
    
    results.add_test("Redis PING", success, output.strip())
    print_test("Redis PING", success, output.strip())
    
    # Test SET/GET
    test_key = "docker_test_key"
    test_value = "test_value_123"
    
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "redis",
        "redis-cli", "SET", test_key, test_value
    ], timeout=10)
    
    results.add_test("Redis SET operation", success, output.strip())
    print_test("Redis SET operation", success, output.strip())
    
    success, output = run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "redis",
        "redis-cli", "GET", test_key
    ], timeout=10)
    
    is_correct = success and test_value in output
    results.add_test("Redis GET operation", is_correct, 
                    f"Retrieved: {output.strip()}" if success else output)
    print_test("Redis GET operation", is_correct,
              f"Retrieved: {output.strip()}" if success else output)
    
    # Cleanup
    run_command([
        "docker", "compose", "-f", "compose.yaml", "exec", "-T", "redis",
        "redis-cli", "DEL", test_key
    ], timeout=10)

def test_api_endpoints(results: TestResult):
    """Test 6: API endpoint validation"""
    print_header("TEST CATEGORY 6: API Endpoints")
    
    api_base = "http://localhost:8000"
    
    # Test /health endpoint
    try:
        with urllib.request.urlopen(f"{api_base}/health", timeout=10) as response:
            health_ok = response.status == 200
            results.add_test("API /health endpoint", health_ok, f"Status: {response.status}")
            print_test("API /health endpoint", health_ok, f"Status: {response.status}")
    except Exception as e:
        results.add_test("API /health endpoint", False, str(e))
        print_test("API /health endpoint", False, str(e))
    
    # Test /ready endpoint
    try:
        with urllib.request.urlopen(f"{api_base}/ready", timeout=10) as response:
            ready_ok = response.status == 200
            data = json.loads(response.read().decode())
            results.add_test("API /ready endpoint", ready_ok, 
                           f"Status: {data.get('status', 'unknown')}")
            print_test("API /ready endpoint", ready_ok,
                      f"Status: {data.get('status', 'unknown')}")
    except Exception as e:
        results.add_test("API /ready endpoint", False, str(e))
        print_test("API /ready endpoint", False, str(e))
    
    # Test /docs endpoint
    try:
        with urllib.request.urlopen(f"{api_base}/docs", timeout=10) as response:
            docs_ok = response.status == 200
            results.add_test("API /docs endpoint", docs_ok, f"Status: {response.status}")
            print_test("API /docs endpoint", docs_ok, f"Status: {response.status}")
    except Exception as e:
        results.add_test("API /docs endpoint", False, str(e))
        print_test("API /docs endpoint", False, str(e))
    
    # Test /api/v1/me endpoint (should work in local-demo mode)
    try:
        with urllib.request.urlopen(f"{api_base}/api/v1/me", timeout=10) as response:
            me_ok = response.status == 200
            headers = response.headers
            data_mode = headers.get('X-FarmTwin-Data-Mode', 'not set')
            auth_mode = headers.get('X-FarmTwin-Auth-Mode', 'not set')
            results.add_test("API /api/v1/me endpoint", me_ok, 
                           f"Data mode: {data_mode}, Auth mode: {auth_mode}")
            print_test("API /api/v1/me endpoint", me_ok,
                      f"Data mode: {data_mode}, Auth mode: {auth_mode}")
    except Exception as e:
        results.add_test("API /api/v1/me endpoint", False, str(e))
        print_test("API /api/v1/me endpoint", False, str(e))

def test_docker_network(results: TestResult):
    """Test 7: Docker network configuration"""
    print_header("TEST CATEGORY 7: Docker Network")
    
    # Check network exists
    success, output = run_command(["docker", "network", "ls", "--format", "{{.Name}}"])
    
    network_exists = success and "farmtwin_network" in output
    results.add_test("farmtwin_network exists", network_exists, 
                    "Network found" if network_exists else "Network not found")
    print_test("farmtwin_network exists", network_exists,
              "Network found" if network_exists else "Network not found")
    
    # Check services are connected
    success, output = run_command([
        "docker", "network", "inspect", "farmtwin_network", "--format", "{{json .Containers}}"
    ])
    
    if success:
        try:
            containers = json.loads(output)
            connected_count = len(containers)
            results.add_test("Services connected to network", connected_count >= 4, 
                           f"{connected_count} containers connected")
            print_test("Services connected to network", connected_count >= 4,
                      f"{connected_count} containers connected")
        except json.JSONDecodeError:
            results.add_test("Parse network containers", False, "Failed to parse network info")
            print_test("Parse network containers", False, "Failed to parse network info")

def test_docker_volumes(results: TestResult):
    """Test 8: Docker volume persistence"""
    print_header("TEST CATEGORY 8: Docker Volumes")
    
    # Check volumes exist
    success, output = run_command(["docker", "volume", "ls", "--format", "{{.Name}}"])
    
    postgres_volume = "farmtwin_postgres_data" in output
    redis_volume = "redis_data" in output
    
    results.add_test("PostgreSQL volume exists", postgres_volume, 
                    "farmtwin_postgres_data found" if postgres_volume else "Volume not found")
    print_test("PostgreSQL volume exists", postgres_volume,
              "farmtwin_postgres_data found" if postgres_volume else "Volume not found")
    
    results.add_test("Redis volume exists", redis_volume,
                    "redis_data found" if redis_volume else "Volume not found")
    print_test("Redis volume exists", redis_volume,
              "redis_data found" if redis_volume else "Volume not found")

def print_summary(results: TestResult):
    """Print final test summary"""
    print_header("TEST SUMMARY")
    
    total = results.passed + results.failed
    pass_rate = (results.passed / total * 100) if total > 0 else 0
    
    print(f"{Colors.BOLD}Total Tests: {total}{Colors.RESET}")
    print(f"{Colors.GREEN}Passed: {results.passed}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {results.failed}{Colors.RESET}")
    print(f"{Colors.YELLOW}Warnings: {results.warnings}{Colors.RESET}")
    print(f"{Colors.BOLD}Pass Rate: {pass_rate:.1f}%{Colors.RESET}")
    
    if results.failed > 0:
        print(f"\n{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.RESET}")
        print(f"\n{Colors.BOLD}Failed Tests:{Colors.RESET}")
        for name, passed, message in results.tests:
            if passed is False:
                print(f"  • {name}")
                if message:
                    print(f"    {message}")
    else:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ ALL TESTS PASSED{Colors.RESET}")

def main():
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║          FarmTwin Docker System Comprehensive Test Suite            ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")
    
    results = TestResult()
    
    try:
        test_docker_installed(results)
        test_docker_services(results)
        test_docker_health(results)
        test_database_connection(results)
        test_redis_connection(results)
        test_api_endpoints(results)
        test_docker_network(results)
        test_docker_volumes(results)
        
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test interrupted by user{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Unexpected error: {e}{Colors.RESET}")
        sys.exit(1)
    
    print_summary(results)
    
    # Exit with error code if tests failed
    sys.exit(0 if results.failed == 0 else 1)

if __name__ == "__main__":
    main()
