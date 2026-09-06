"""
Tests for configuration validation and security rules.

Feature: backend-foundation, Property 1: Invalid configuration fails safely
Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
"""

import json
import os
from typing import Any

import pytest
from hypothesis import given, strategies as st
from pydantic import ValidationError

from app.core.config import (
    AuthMode,
    AuthSettings,
    CORSSettings,
    DataMode,
    DatabaseSettings,
    DemoSettings,
    Environment,
    Settings,
)


# ============================================================================
# Unit Tests for Valid Configurations
# ============================================================================


def test_valid_oidc_production_config():
    """Test a valid OIDC production configuration"""
    config = Settings(
        environment="production",
        data_mode="live",
        auth={
            "mode": "oidc",
            "issuer": "https://auth.example.com",
            "audience": "farmtwin-api",
            "jwks_url": "https://auth.example.com/.well-known/jwks.json",
            "algorithms": ["RS256"],
        },
        database={
            "host": "db.example.com",
            "name": "farmtwin",
            "user": "app_user",
            "password": "secret123",
        },
        cors={"origins": ["https://app.example.com"]},
    )

    assert config.environment == Environment.PRODUCTION
    assert config.data_mode == DataMode.LIVE
    assert config.auth.mode == AuthMode.OIDC
    assert config.auth.issuer.scheme == "https"
    assert config.auth.algorithms == ["RS256"]


def test_valid_demo_config():
    """Test a valid local demo configuration"""
    config = Settings(
        environment="development",
        data_mode="demonstration",
        auth__mode="local_demo",
        demo__local_only=True,
        demo__isolated_database=True,
        database__host="localhost",
        database__name="farmtwin_demo",
        database__user="demo_user",
        database__password="demo_pass",
    )

    assert config.environment == Environment.DEVELOPMENT
    assert config.data_mode == DataMode.DEMONSTRATION
    assert config.auth.mode == AuthMode.LOCAL_DEMO
    assert config.demo.local_only is True
    assert config.demo.isolated_database is True


def test_historical_replay_mode():
    """Test historical replay data mode"""
    config = Settings(
        environment="staging",
        data_mode="historical_replay",
        auth__mode="oidc",
        auth__issuer="https://auth.example.com",
        auth__audience="farmtwin-api",
        auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
        auth__algorithms='["RS256"]',
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password="pass",
    )

    assert config.data_mode == DataMode.HISTORICAL_REPLAY


# ============================================================================
# Unit Tests for Invalid Configurations (Req 1.2, 1.3)
# ============================================================================


def test_missing_required_environment():
    """Test that missing ENVIRONMENT fails"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "environment" in error_str.lower()


def test_missing_required_data_mode():
    """Test that missing DATA_MODE fails"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "data_mode" in error_str.lower()


def test_missing_database_host():
    """Test that missing database host fails"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "host" in error_str.lower()


def test_invalid_environment_value():
    """Test that invalid environment value fails"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="invalid_env",
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "environment" in error_str.lower()


def test_invalid_data_mode_value():
    """Test that invalid data mode value fails"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="invalid_mode",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "data_mode" in error_str.lower()


# ============================================================================
# OIDC Requirements Tests (Req 1.7)
# ============================================================================


def test_oidc_missing_issuer():
    """Test that OIDC mode requires issuer"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            auth__mode="oidc",
            auth__audience="farmtwin-api",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            auth__algorithms='["RS256"]',
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "issuer" in error_str.lower()


def test_oidc_missing_audience():
    """Test that OIDC mode requires audience"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            auth__mode="oidc",
            auth__issuer="https://auth.example.com",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            auth__algorithms='["RS256"]',
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "audience" in error_str.lower()


def test_oidc_missing_jwks_url():
    """Test that OIDC mode requires JWKS URL"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            auth__mode="oidc",
            auth__issuer="https://auth.example.com",
            auth__audience="farmtwin-api",
            auth__algorithms='["RS256"]',
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "jwks" in error_str.lower()


def test_oidc_missing_algorithms():
    """Test that OIDC mode requires algorithms"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            auth__mode="oidc",
            auth__issuer="https://auth.example.com",
            auth__audience="farmtwin-api",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "algorithm" in error_str.lower()


def test_oidc_rejects_none_algorithm():
    """Test that 'none' algorithm is rejected"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            auth__mode="oidc",
            auth__issuer="https://auth.example.com",
            auth__audience="farmtwin-api",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            auth__algorithms='["RS256", "none"]',
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "none" in error_str.lower()


def test_oidc_requires_https_in_production():
    """Test that OIDC URLs require HTTPS in production"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="production",
            data_mode="live",
            auth__mode="oidc",
            auth__issuer="http://auth.example.com",  # HTTP not allowed
            auth__audience="farmtwin-api",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            auth__algorithms='["RS256"]',
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "https" in error_str.lower()


def test_oidc_allows_http_in_development():
    """Test that OIDC URLs can use HTTP in development"""
    config = Settings(
        environment="development",
        data_mode="live",
        auth__mode="oidc",
        auth__issuer="http://localhost:8080",  # HTTP allowed in dev
        auth__audience="farmtwin-api",
        auth__jwks_url="http://localhost:8080/.well-known/jwks.json",
        auth__algorithms='["RS256"]',
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password="pass",
    )

    assert config.auth.issuer.scheme == "http"
    assert config.auth.jwks_url.scheme == "http"


# ============================================================================
# Demo Mode Restriction Tests (Req 1.6, 12.2)
# ============================================================================


def test_demo_requires_development_environment():
    """Test that local demo requires development environment"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="production",  # Wrong environment
            data_mode="demonstration",
            auth__mode="local_demo",
            demo__local_only=True,
            demo__isolated_database=True,
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "development" in error_str.lower()


def test_demo_requires_non_live_data_mode():
    """Test that local demo requires non-live data mode"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",  # Wrong data mode
            auth__mode="local_demo",
            demo__local_only=True,
            demo__isolated_database=True,
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "live" in error_str.lower() or "data_mode" in error_str.lower()


def test_demo_requires_local_only():
    """Test that local demo requires local_only flag"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="demonstration",
            auth__mode="local_demo",
            demo__local_only=False,  # Missing flag
            demo__isolated_database=True,
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "local_only" in error_str.lower()


def test_demo_requires_isolated_database():
    """Test that local demo requires isolated database flag"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="demonstration",
            auth__mode="local_demo",
            demo__local_only=True,
            demo__isolated_database=False,  # Missing flag
            database__host="localhost",
            database__name="farmtwin_demo",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "isolated" in error_str.lower()


# ============================================================================
# CORS Validation Tests (Req 13.1)
# ============================================================================


def test_cors_rejects_wildcard():
    """Test that wildcard CORS origins are rejected"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            auth__mode="oidc",
            auth__issuer="https://auth.example.com",
            auth__audience="farmtwin-api",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            auth__algorithms='["RS256"]',
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
            cors__origins='["*"]',
        )

    error_str = str(exc_info.value)
    assert "wildcard" in error_str.lower()


def test_cors_accepts_exact_origins():
    """Test that exact CORS origins are accepted"""
    config = Settings(
        environment="development",
        data_mode="live",
        auth__mode="oidc",
        auth__issuer="https://auth.example.com",
        auth__audience="farmtwin-api",
        auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
        auth__algorithms='["RS256"]',
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password="pass",
        cors__origins='["https://app.example.com", "https://admin.example.com"]',
    )

    assert len(config.cors.origins) == 2
    assert "https://app.example.com" in config.cors.origins


def test_cors_empty_origins_allowed():
    """Test that empty CORS origins list is valid"""
    config = Settings(
        environment="development",
        data_mode="live",
        auth__mode="oidc",
        auth__issuer="https://auth.example.com",
        auth__audience="farmtwin-api",
        auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
        auth__algorithms='["RS256"]',
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password="pass",
        cors__origins="[]",
    )

    assert config.cors.origins == []


# ============================================================================
# Database Settings Tests (Req 1.4)
# ============================================================================


def test_invalid_database_port():
    """Test that invalid port values are rejected"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            database__host="localhost",
            database__port=70000,  # Invalid port
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
        )

    error_str = str(exc_info.value)
    assert "port" in error_str.lower()


def test_invalid_pool_size():
    """Test that invalid pool size is rejected"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
            database__pool_size=0,  # Invalid
        )

    error_str = str(exc_info.value)
    assert "pool" in error_str.lower()


def test_invalid_timeout():
    """Test that invalid timeout is rejected"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
            database__pool_timeout_seconds=-1,  # Invalid
        )

    error_str = str(exc_info.value)
    assert "timeout" in error_str.lower()


# ============================================================================
# Log Level Validation Tests (Req 9.7)
# ============================================================================


def test_valid_log_levels():
    """Test that valid log levels are accepted"""
    for level in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
        config = Settings(
            environment="development",
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
            log_level=level,
        )
        assert config.log_level == level


def test_invalid_log_level():
    """Test that invalid log level is rejected"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="development",
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
            log_level="INVALID",
        )

    error_str = str(exc_info.value)
    assert "log_level" in error_str.lower()


# ============================================================================
# Secret Handling Tests (Req 1.5)
# ============================================================================


def test_password_not_in_repr():
    """Test that database password is not exposed in repr"""
    config = Settings(
        environment="development",
        data_mode="live",
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password="super_secret_password_canary_12345",
        log_level="INFO",
    )

    repr_str = repr(config)
    assert "super_secret_password_canary_12345" not in repr_str

    db_repr = repr(config.database)
    assert "super_secret_password_canary_12345" not in db_repr
    assert "***" in db_repr or "SecretStr" in db_repr


def test_password_not_in_model_dump():
    """Test that database password is masked in model_dump"""
    config = Settings(
        environment="development",
        data_mode="live",
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password="super_secret_password_canary_67890",
    )

    dump = config.model_dump()
    db_dump = dump.get("database", {})

    # Password should be masked
    assert db_dump.get("password") == "***"
    assert "super_secret_password_canary_67890" not in str(dump)


def test_password_not_in_validation_error():
    """Test that password doesn't leak in validation errors"""
    try:
        Settings(
            environment="invalid",  # Trigger validation error
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password="secret_canary_validation_98765",
        )
    except ValidationError as e:
        error_str = str(e)
        # The secret should not appear in validation messages
        assert "secret_canary_validation_98765" not in error_str


# ============================================================================
# Environment Variable Name Tests (Req 1.1)
# ============================================================================


def test_nested_delimiter_double_underscore():
    """Test that nested settings use double underscore delimiter"""
    # Set environment variables to test the delimiter
    env_vars = {
        "ENVIRONMENT": "development",
        "DATA_MODE": "live",
        "DATABASE__HOST": "testhost",
        "DATABASE__NAME": "testdb",
        "DATABASE__USER": "testuser",
        "DATABASE__PASSWORD": "testpass",
        "AUTH__MODE": "oidc",
        "AUTH__ISSUER": "https://auth.test.com",
        "AUTH__AUDIENCE": "test-api",
        "AUTH__JWKS_URL": "https://auth.test.com/.well-known/jwks.json",
        "AUTH__ALGORITHMS": '["RS256"]',
    }

    # Temporarily set environment variables
    original_env = {}
    for key, value in env_vars.items():
        original_env[key] = os.environ.get(key)
        os.environ[key] = value

    try:
        config = Settings()
        assert config.database.host == "testhost"
        assert config.database.name == "testdb"
        assert config.auth.mode == AuthMode.OIDC
        assert str(config.auth.issuer) == "https://auth.test.com/"
    finally:
        # Restore original environment
        for key, original_value in original_env.items():
            if original_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original_value


# ============================================================================
# Property-Based Tests
# ============================================================================


@given(
    environment=st.sampled_from(["development", "staging", "production"]),
    data_mode=st.sampled_from(["live", "historical_replay", "demonstration"]),
    port=st.integers(min_value=1, max_value=65535),
    pool_size=st.integers(min_value=1, max_value=50),
)
def test_property_valid_configs_succeed(
    environment: str, data_mode: str, port: int, pool_size: int
):
    """
    Property: Valid configuration combinations should succeed.

    Feature: backend-foundation, Property 1: Invalid configuration fails safely
    Validates: Requirements 1.1, 1.2, 1.3, 1.4
    """
    try:
        config = Settings(
            environment=environment,
            data_mode=data_mode,
            auth__mode="oidc",
            auth__issuer="https://auth.example.com",
            auth__audience="farmtwin-api",
            auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
            auth__algorithms='["RS256"]',
            database__host="localhost",
            database__port=port,
            database__name="farmtwin",
            database__user="user",
            database__password="pass",
            database__pool_size=pool_size,
        )

        # Valid configs should succeed
        assert config.environment.value == environment
        assert config.data_mode.value == data_mode
        assert config.database.port == port
        assert config.database.pool_size == pool_size

    except ValidationError:
        # Should not fail for valid combinations
        pytest.fail(f"Valid configuration failed: env={environment}, mode={data_mode}")


@given(
    secret=st.text(
        alphabet=st.characters(min_codepoint=33, max_codepoint=126),
        min_size=10,
        max_size=50,
    )
)
def test_property_secrets_never_exposed(secret: str):
    """
    Property: Secrets should never appear in representations or validation output.

    Feature: backend-foundation, Property 1: Invalid configuration fails safely
    Validates: Requirements 1.5
    """
    # Test with valid config
    config = Settings(
        environment="development",
        data_mode="live",
        database__host="localhost",
        database__name="farmtwin",
        database__user="user",
        database__password=secret,
    )

    repr_str = repr(config)
    dump_str = str(config.model_dump())
    db_repr = repr(config.database)

    assert secret not in repr_str
    assert secret not in dump_str
    assert secret not in db_repr

    # Test with invalid config (trigger validation error)
    try:
        Settings(
            environment="invalid_env",  # Trigger error
            data_mode="live",
            database__host="localhost",
            database__name="farmtwin",
            database__user="user",
            database__password=secret,
        )
    except ValidationError as e:
        error_str = str(e)
        assert secret not in error_str


@given(origin=st.text(min_size=1, max_size=100))
def test_property_wildcards_rejected(origin: str):
    """
    Property: CORS origins containing wildcards should be rejected.

    Feature: backend-foundation, Property 1: Invalid configuration fails safely
    Validates: Requirements 13.1
    """
    if "*" in origin:
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment="development",
                data_mode="live",
                auth__mode="oidc",
                auth__issuer="https://auth.example.com",
                auth__audience="farmtwin-api",
                auth__jwks_url="https://auth.example.com/.well-known/jwks.json",
                auth__algorithms='["RS256"]',
                database__host="localhost",
                database__name="farmtwin",
                database__user="user",
                database__password="pass",
                cors__origins=json.dumps([origin]),
            )
        assert "wildcard" in str(exc_info.value).lower()
