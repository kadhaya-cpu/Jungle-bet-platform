"""
Enterprise password hashing and secret redaction utilities for RUSH HOUR BET.
"""

from typing import Any
from passlib.context import CryptContext

# High cost factor (rounds=12) for enterprise-grade brute-force resistance
BCRYPT_ROUNDS = 12

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=BCRYPT_ROUNDS,
)

SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "plain_password",
    "confirm_password",
    "new_password",
    "old_password",
    "secret",
    "secret_key",
    "jwt_secret_key",
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hashed password."""
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt with cost factor rounds=12."""
    return pwd_context.hash(password)


def redact_sensitive_data(data: Any) -> Any:
    """
    Recursively scrub any password or secret fields from dictionaries/lists
    before logging so passwords (even hashed) are NEVER logged.
    """
    if isinstance(data, dict):
        return {
            k: ("[REDACTED]" if str(k).lower() in SENSITIVE_KEYS or "password" in str(k).lower() else redact_sensitive_data(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]
    return data


def strip_password_fields(payload: dict) -> dict:
    """
    Ensure password and hashed_password keys are completely removed from API response dictionaries.
    """
    if not isinstance(payload, dict):
        return payload
    cleaned = {}
    for k, v in payload.items():
        if str(k).lower() in {"password", "hashed_password", "plain_password"}:
            continue
        if isinstance(v, dict):
            cleaned[k] = strip_password_fields(v)
        elif isinstance(v, list):
            cleaned[k] = [strip_password_fields(i) if isinstance(i, dict) else i for i in v]
        else:
            cleaned[k] = v
    return cleaned
