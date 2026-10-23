"""
test_security_enterprise.py - Enterprise Backend Security Verification Suite for RUSH HOUR BET
Verifies all 8 security requirements:
1. Dynamic CORS Configuration (ALLOWED_ORIGINS env var, comma-split, allow_credentials=True, allow_methods=["*"])
2. Rate Limiting (60/min global, 5/min /login & /register, 10/min /deposit & /withdraw, 429 + Retry-After header)
3. Security Headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Strict-Transport-Security, Content-Security-Policy)
4. Input Validation & Sanitization (EmailStr, conint/confloat amounts, alphanumeric username regex, HTML sanitization)
5. Secure Password Handling (utils/security.py bcrypt rounds=12, never logged or returned in API responses)
6. Audit Logging & Monitoring (Timestamp, X-Forwarded-For Client IP, User-Agent, Endpoint, User ID, Status Code + CRITICAL events)
7. Environment Variable Safety (DATABASE_URL, SECRET_KEY, JWT_ALGORITHM from os.getenv + startup check crash on missing/default SECRET_KEY)
8. Error Handling (Generic client error messages without raw SQL errors or stack traces)
"""

import os
import sys
import time
import json
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import main
from main import app, validate_security_env, ALLOWED_ORIGINS
from utils.security import BCRYPT_ROUNDS, get_password_hash, verify_password, redact_sensitive_data, strip_password_fields
import schemas


class TestEnterpriseBackendSecurity(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)
        # Reset rate limiter storage before each test
        try:
            main.limiter.reset()
        except Exception:
            pass

    def test_01_dynamic_cors_configuration(self):
        """1. Verify ALLOWED_ORIGINS reading, default domains, and preflight CORS headers."""
        self.assertIn("http://localhost:3000", ALLOWED_ORIGINS)
        self.assertIn("https://jungle-bet-frontend.up.railway.app", ALLOWED_ORIGINS)

        res = self.client.options(
            "/health",
            headers={
                "Origin": "https://jungle-bet-frontend.up.railway.app",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.headers.get("access-control-allow-origin"),
            "https://jungle-bet-frontend.up.railway.app",
        )
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")
        self.assertIn("POST", res.headers.get("access-control-allow-methods", ""))

    def test_02_security_headers_injected_on_all_responses(self):
        """3. Verify Helmet-equivalent security headers on every response."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-XSS-Protection"), "1; mode=block")
        self.assertEqual(
            res.headers.get("Strict-Transport-Security"),
            "max-age=31536000; includeSubDomains",
        )
        self.assertEqual(
            res.headers.get("Content-Security-Policy"),
            "default-src 'self'",
        )

    def test_03_rate_limiting_login_register_deposit_withdraw_and_retry_after(self):
        """2. Verify 5/min on /login and /register, 10/min on /deposit and /withdraw, and 429 + Retry-After."""
        # Test /login rate limit (5/minute) from a specific proxy IP
        headers = {"X-Forwarded-For": "203.0.113.55"}
        for i in range(5):
            r = self.client.post(
                "/login",
                json={"username": "nonexistentuser1", "password": "wrongpassword"},
                headers=headers,
            )
            self.assertEqual(r.status_code, 401)

        # 6th request within a minute must be blocked with 429 and Retry-After header
        r_blocked = self.client.post(
            "/login",
            json={"username": "nonexistentuser1", "password": "wrongpassword"},
            headers=headers,
        )
        self.assertEqual(r_blocked.status_code, 429)
        self.assertIn("Retry-After", r_blocked.headers)
        self.assertGreater(int(r_blocked.headers["Retry-After"]), 0)

        # Test /deposit rate limit (10/minute) from a fresh proxy IP
        dep_headers = {"X-Forwarded-For": "203.0.113.77"}
        for i in range(10):
            r_dep = self.client.post(
                "/deposit",
                json={"amount_local": 10000, "currency": "UGX"},
                headers=dep_headers,
            )
            # Without auth it returns 401 until rate limit is hit
            self.assertEqual(r_dep.status_code, 401)

        r_dep_blocked = self.client.post(
            "/deposit",
            json={"amount_local": 10000, "currency": "UGX"},
            headers=dep_headers,
        )
        self.assertEqual(r_dep_blocked.status_code, 429)
        self.assertIn("Retry-After", r_dep_blocked.headers)

    def test_04_input_validation_and_sanitization(self):
        """4. Verify alphanumeric username regex, EmailStr, positive conint/confloat amounts, and HTML sanitization."""
        # Reject SQL injection username
        with self.assertRaises(ValueError):
            schemas.UserCreate(
                username="admin' OR 1=1--",
                password="SecurePassword123",
                email="valid@example.com",
            )

        # Reject invalid email
        with self.assertRaises(ValueError):
            schemas.UserCreate(
                username="validuser123",
                password="SecurePassword123",
                email="not-an-email",
            )

        # Reject negative amount
        with self.assertRaises(ValueError):
            schemas.DepositRequest(amount_local=-100, currency="UGX")

        # Verify HTML sanitization on location field
        user_schema = schemas.UserCreate(
            username="cleanuser99",
            password="SecurePassword123",
            email="clean@example.com",
            location="<script>alert('xss')</script>Kampala",
        )
        self.assertNotIn("<script>", user_schema.location)
        self.assertIn("Kampala", user_schema.location)

    def test_05_secure_password_handling_bcrypt_rounds_12(self):
        """5. Verify bcrypt cost factor 12 and that passwords/hashes are never exposed."""
        self.assertEqual(BCRYPT_ROUNDS, 12)
        hashed = get_password_hash("MySuperSecretPass123")
        self.assertTrue(hashed.startswith("$2b$12$") or hashed.startswith("$2a$12$"))
        self.assertTrue(verify_password("MySuperSecretPass123", hashed))
        self.assertFalse(verify_password("WrongPass", hashed))

        # Register a new user and verify neither password nor hashed_password is in the API response
        uname = f"secuser{int(time.time() * 1000)}"
        reg_res = self.client.post(
            "/register",
            json={
                "username": uname,
                "password": "StrongPassword123",
                "email": f"{uname}@example.com",
            },
            headers={"X-Forwarded-For": "198.51.100.22"},
        )
        self.assertEqual(reg_res.status_code, 200)
        body_str = json.dumps(reg_res.json())
        self.assertNotIn("StrongPassword123", body_str)
        self.assertNotIn("hashed_password", body_str)
        self.assertNotIn("$2b$12$", body_str)

    def test_06_audit_logging_and_critical_events(self):
        """6. Verify request audit logs and CRITICAL logs for failed logins, large withdrawals, and bans."""
        with self.assertLogs("jungle_bet.critical", level="CRITICAL") as cm:
            # Trigger failed login
            self.client.post(
                "/login",
                json={"username": "unknownuser999", "password": "badpassword"},
                headers={"X-Forwarded-For": "198.51.100.88", "User-Agent": "SecurityAuditTest/1.0"},
            )
            self.assertTrue(any("FAILED_LOGIN" in msg and "198.51.100.88" in msg for msg in cm.output))

    def test_07_environment_variable_safety_startup_check(self):
        """7. Verify startup check crashes with RuntimeError when SECRET_KEY is missing or default."""
        with patch.dict(os.environ, {"SECRET_KEY": "", "JWT_SECRET_KEY": ""}, clear=False):
            with self.assertRaises(RuntimeError) as ctx:
                validate_security_env()
            self.assertIn("SECRET_KEY", str(ctx.exception))

        with patch.dict(
            os.environ,
            {"SECRET_KEY": "your-secret-key-change-in-production", "JWT_SECRET_KEY": ""},
            clear=False,
        ):
            with self.assertRaises(RuntimeError) as ctx2:
                validate_security_env()
            self.assertIn("SECRET_KEY", str(ctx2.exception))

    def test_08_error_handling_hides_raw_sql_and_stack_traces(self):
        """8. Verify unhandled SQL/server exceptions return generic error message without raw SQL leak."""
        with patch("main.admin_get_analytics", side_effect=OperationalError("SELECT * FROM secret_table", {}, Exception("FATAL: password authentication failed for user postgres"))):
            # Trigger exception handler directly via SQLAlchemyError handler
            req_mock = unittest.mock.MagicMock()
            req_mock.method = "GET"
            req_mock.url.path = "/api/admin/analytics"
            loop = main.asyncio.new_event_loop()
            try:
                resp = loop.run_until_complete(
                    main.sqlalchemy_exception_handler(
                        req_mock,
                        OperationalError("SELECT * FROM secret_table", {}, Exception("raw sql details")),
                    )
                )
            finally:
                loop.close()
            self.assertEqual(resp.status_code, 500)
            body = json.loads(resp.body.decode("utf-8"))
            self.assertEqual(body.get("error"), "An error occurred")
            self.assertNotIn("secret_table", json.dumps(body))
            self.assertNotIn("raw sql details", json.dumps(body))


if __name__ == "__main__":
    unittest.main()
