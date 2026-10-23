"""
Pydantic Validation & Sanitization Schemas for RUSH HOUR BET API.
Enforces strict typing (EmailStr, conint, confloat), alphanumeric username regex
validators to prevent SQL/NoSQL injection vectors, and HTML sanitization for strings.
"""

import html
import re
import types
import pydantic.networks
from typing import Any, Dict, List, Optional, Union
from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    conint,
    confloat,
    field_validator,
    model_validator,
)

# Ensure EmailStr works even in offline environments where email-validator wheel isn't pre-installed
try:
    import email_validator  # type: ignore
except ImportError:
    _EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

    class _EmailNotValidError(ValueError):
        pass

    class _ValidatedEmail:
        def __init__(self, local_part: str, normalized: str):
            self.local_part = local_part
            self.normalized = normalized

    def _validate_email_fallback(email: str, check_deliverability: bool = False) -> _ValidatedEmail:
        if not email or not isinstance(email, str) or not _EMAIL_REGEX.match(email.strip()):
            raise _EmailNotValidError("The email address is not valid. It must have exactly one @-sign and a valid domain.")
        cleaned = email.strip()
        local_part, domain = cleaned.split("@", 1)
        return _ValidatedEmail(local_part=local_part, normalized=f"{local_part}@{domain.lower()}")

    _shim = types.ModuleType("email_validator")
    _shim.EmailNotValidError = _EmailNotValidError  # type: ignore
    _shim.validate_email = _validate_email_fallback  # type: ignore
    pydantic.networks.email_validator = _shim  # type: ignore
    pydantic.networks.import_email_validator = lambda: None  # type: ignore

# Strict amount types (supports integer and float positive amounts)
StrictIntAmount = conint(gt=0)
StrictFloatAmount = confloat(gt=0)
PositiveAmount = Union[StrictIntAmount, StrictFloatAmount]

# Strict alphanumeric regex for usernames to prevent SQL/NoSQL injection vectors
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9]+$")
IDENTIFIER_SAFE_REGEX = re.compile(r"^[a-zA-Z0-9_\-\. ]+$")
SCRIPT_TAG_REGEX = re.compile(r"<\s*/?\s*script[^>]*>", re.IGNORECASE)
EVENT_HANDLER_REGEX = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
JS_PROTOCOL_REGEX = re.compile(r"javascript\s*:", re.IGNORECASE)
SQL_NOSQL_INJECTION_PATTERNS = re.compile(
    r"(\b(UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b|--|/\*|\*/|\$where|\$ne|\$gt|\$lt|\$regex)",
    re.IGNORECASE,
)


def sanitize_html_string(value: Optional[str]) -> Optional[str]:
    """
    Sanitize string inputs that might be rendered in HTML later.
    Strips script tags, javascript: URIs, inline event handlers, and escapes HTML entities.
    """
    if value is None:
        return None
    cleaned = str(value).strip()
    cleaned = SCRIPT_TAG_REGEX.sub("", cleaned)
    cleaned = EVENT_HANDLER_REGEX.sub("", cleaned)
    cleaned = JS_PROTOCOL_REGEX.sub("", cleaned)
    if SQL_NOSQL_INJECTION_PATTERNS.search(cleaned):
        raise ValueError("Input contains potentially malicious SQL/NoSQL injection patterns.")
    return html.escape(cleaned, quote=True)


def sanitize_nested(data: Any) -> Any:
    """Recursively sanitize strings inside dictionaries and lists."""
    if isinstance(data, str):
        return sanitize_html_string(data)
    if isinstance(data, dict):
        sanitized_dict = {}
        for k, v in data.items():
            key_str = str(k)
            if key_str.startswith("$") or SQL_NOSQL_INJECTION_PATTERNS.search(key_str):
                raise ValueError("Invalid key in criteria payload (NoSQL/SQL injection vector blocked).")
            sanitized_dict[sanitize_html_string(key_str)] = sanitize_nested(v)
        return sanitized_dict
    if isinstance(data, list):
        return [sanitize_nested(item) for item in data]
    return data


def validate_alphanumeric_username(username: str) -> str:
    """Validate that a username is strictly alphanumeric to prevent SQL/NoSQL injection."""
    if not username or not isinstance(username, str):
        raise ValueError("Username is required.")
    cleaned = username.strip()
    if len(cleaned) < 3 or len(cleaned) > 50:
        raise ValueError("Username must be between 3 and 50 characters.")
    if not USERNAME_REGEX.match(cleaned):
        raise ValueError("Username must be alphanumeric only (letters and numbers only).")
    return cleaned


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9]+$")
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[EmailStr] = None
    preferred_currency: Optional[str] = Field(default="UGX", max_length=10)
    location: Optional[str] = Field(default=None, max_length=255)

    @field_validator("username")
    @classmethod
    def check_username_alphanumeric(cls, v: str) -> str:
        return validate_alphanumeric_username(v)

    @field_validator("preferred_currency")
    @classmethod
    def sanitize_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return "UGX"
        cleaned = sanitize_html_string(v).upper()
        if not USERNAME_REGEX.match(cleaned):
            raise ValueError("Currency code must be alphanumeric.")
        return cleaned

    @field_validator("location")
    @classmethod
    def sanitize_location(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class UserLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9]+$")
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def check_username_alphanumeric(cls, v: str) -> str:
        return validate_alphanumeric_username(v)


class TokenRefreshRequest(BaseModel):
    refresh_token: Optional[str] = Field(default=None, max_length=2048)

    @field_validator("refresh_token")
    @classmethod
    def sanitize_token(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.strip()


class DepositRequest(BaseModel):
    amount_local: PositiveAmount
    currency: str = Field(default="UGX", max_length=10)
    user_id: Optional[conint(gt=0)] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        cleaned = sanitize_html_string(v or "UGX").upper()
        if not USERNAME_REGEX.match(cleaned):
            raise ValueError("Currency code must be alphanumeric.")
        return cleaned


class WithdrawRequest(BaseModel):
    amount_usd: Optional[PositiveAmount] = None
    amount: Optional[PositiveAmount] = None
    currency: Optional[str] = Field(default=None, max_length=10)
    user_id: Optional[conint(gt=0)] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = sanitize_html_string(v).upper()
        if not USERNAME_REGEX.match(cleaned):
            raise ValueError("Currency code must be alphanumeric.")
        return cleaned

    @model_validator(mode="after")
    def ensure_positive_withdrawal_amount(self) -> "WithdrawRequest":
        amt = self.amount_usd if self.amount_usd is not None else self.amount
        if amt is None or float(amt) <= 0:
            raise ValueError("Withdrawal amount must be greater than 0")
        return self


class WithdrawPreviewRequest(BaseModel):
    amount_usd: Optional[PositiveAmount] = None
    amount: Optional[PositiveAmount] = None
    currency: str = Field(default="UGX", max_length=10)
    user_id: Optional[conint(gt=0)] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        cleaned = sanitize_html_string(v or "UGX").upper()
        if not USERNAME_REGEX.match(cleaned):
            raise ValueError("Currency code must be alphanumeric.")
        return cleaned

    @model_validator(mode="after")
    def ensure_amount_present(self) -> "WithdrawPreviewRequest":
        amt = self.amount_usd if self.amount_usd is not None else self.amount
        if amt is None or float(amt) <= 0:
            raise ValueError("amount_usd must be greater than 0")
        return self


class FeedOverrideRequest(BaseModel):
    city: str = Field(..., min_length=2, max_length=64)
    override_url: Optional[str] = Field(default=None, max_length=1024)
    video_url: Optional[str] = Field(default=None, max_length=1024)
    source_id: Optional[str] = Field(default=None, max_length=128)
    force_fallback: bool = False
    reason: Optional[str] = Field(default="Manual admin override", max_length=255)
    admin_user: Optional[str] = Field(default="admin", max_length=64)


class FeedFailoverRequest(BaseModel):
    city: str = Field(..., min_length=2, max_length=64)
    failed_url: Optional[str] = Field(default=None, max_length=1024)
    failed_source_id: Optional[str] = Field(default=None, max_length=128)
    reason: Optional[str] = Field(default="Primary live stream failure detected", max_length=255)


class BetPlace(BaseModel):
    bet_type: str = Field(..., min_length=1, max_length=64)
    criteria: Dict[str, Any]
    amount: PositiveAmount
    feed_id: Optional[conint(gt=0)] = None

    @field_validator("bet_type")
    @classmethod
    def sanitize_bet_type(cls, v: str) -> str:
        return sanitize_html_string(v)

    @field_validator("criteria")
    @classmethod
    def sanitize_criteria(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        return sanitize_nested(v)


class FraudCheckRequest(BaseModel):
    action: str = Field(..., min_length=1, max_length=32)  # "bet" or "win"
    amount: PositiveAmount = 10.0
    userId: Optional[str] = Field(default=None, max_length=100)
    username: Optional[str] = Field(default=None, max_length=100)
    betId: Optional[conint(gt=0)] = None

    @field_validator("action", "userId", "username")
    @classmethod
    def sanitize_strings(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class AdminBanPayload(BaseModel):
    userId: str = Field(..., min_length=1, max_length=100)
    action: str = Field(..., pattern=r"^(ban|unban|unflag)$")

    @field_validator("userId")
    @classmethod
    def sanitize_user_id(cls, v: str) -> str:
        cleaned = sanitize_html_string(v)
        if not IDENTIFIER_SAFE_REGEX.match(cleaned):
            raise ValueError("Invalid userId format.")
        return cleaned


class ProcessBetPayload(BaseModel):
    userId: conint(gt=0)
    stake: PositiveAmount
    odds: PositiveAmount = 1.0
    outcome: Optional[str] = Field(default=None, max_length=32)
    betId: Optional[conint(gt=0)] = None
    username: Optional[str] = Field(default=None, max_length=100)
    durationSeconds: Optional[confloat(gt=0)] = None
    predictedCount: Optional[conint(ge=0)] = None
    actualCount: Optional[conint(ge=0)] = None
    crossings: Optional[List[Any]] = None
    countsPerSecond: Optional[List[Dict[str, Any]]] = None
    operator: str = Field(default="exact", max_length=32)

    @field_validator("outcome", "username", "operator")
    @classmethod
    def sanitize_text_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class DailySettlementPayload(BaseModel):
    date: Optional[str] = Field(default=None, max_length=32)
    operatorBankAccount: Optional[str] = Field(default=None, max_length=255)

    @field_validator("date", "operatorBankAccount")
    @classmethod
    def sanitize_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class TestAlertPayload(BaseModel):
    alertType: str = Field(default="HIGH_WIN", max_length=64)
    username: Optional[str] = Field(default="VIP_Speedster", max_length=100)
    amount: Optional[PositiveAmount] = 1250.0

    @field_validator("alertType", "username")
    @classmethod
    def sanitize_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class TreasurySweepPayload(BaseModel):
    amount: Optional[PositiveAmount] = None
    operatorBankAccount: Optional[str] = Field(default=None, max_length=255)
    isManual: bool = True
    twoFactorCode: Optional[str] = Field(default=None, max_length=64)

    @field_validator("operatorBankAccount", "twoFactorCode")
    @classmethod
    def sanitize_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class WithdrawalRequestPayload(BaseModel):
    amount: PositiveAmount
    wallet_type: str = Field(default="HOUSE_REVENUE", max_length=64)
    operatorBankAccount: Optional[str] = Field(default=None, max_length=255)
    userId: Optional[conint(gt=0)] = None
    twoFactorCode: Optional[str] = Field(default=None, max_length=64)

    @field_validator("wallet_type", "operatorBankAccount", "twoFactorCode")
    @classmethod
    def sanitize_fields(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_html_string(v)


class PayoutActionPayload(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject)$")
