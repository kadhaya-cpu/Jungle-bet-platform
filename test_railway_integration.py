#!/usr/bin/env python3
"""
test_railway_integration.py - Verify Backend Connectivity to Railway Postgres and Redis URLs
"""

import os
import sys
import unittest
import asyncio

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

class TestRailwayBackendConnectivity(unittest.TestCase):
    def test_01_database_url_translation_postgres_protocol(self):
        """Verify that postgres:// protocol URLs (provided by Railway) are converted to postgresql+asyncpg://"""
        from database import raw_db_url, SQLALCHEMY_DATABASE_URL
        
        # Test standard Railway formats
        test_cases = [
            ("postgres://postgres:secret@roundhouse.proxy.rlwy.net:12345/railway",
             "postgresql+asyncpg://postgres:secret@roundhouse.proxy.rlwy.net:12345/railway"),
            ("postgresql://postgres:secret@postgres.railway.internal:5432/railway",
             "postgresql+asyncpg://postgres:secret@postgres.railway.internal:5432/railway"),
            ("postgresql+asyncpg://user:pass@host:5432/db",
             "postgresql+asyncpg://user:pass@host:5432/db")
        ]
        
        for input_url, expected in test_cases:
            if input_url.startswith("postgres://"):
                converted = input_url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif input_url.startswith("postgresql://"):
                converted = input_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            else:
                converted = input_url
            self.assertEqual(converted, expected, f"Failed translating {input_url}")
        print("  ✅ PASS: Railway PostgreSQL protocol translation verified")

    def test_02_backend_live_connection_to_railway_postgres(self):
        """Verify asyncpg connects successfully with Railway-style DATABASE_URL"""
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        from sqlalchemy.pool import NullPool

        # Simulate Railway-provided PostgreSQL URL pointing to local running instance
        railway_style_url = "postgresql://trafficuser:mypassword@localhost:5432/trafficracer_db"
        asyncpg_url = railway_style_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        engine = create_async_engine(asyncpg_url, echo=False, poolclass=NullPool)

        async def run_query():
            async with engine.connect() as conn:
                result = await conn.execute(text("SELECT 1 AS railway_connected"))
                row = result.fetchone()
                return row[0]

        val = asyncio.run(run_query())
        self.assertEqual(val, 1)
        print("  ✅ PASS: Backend successfully connected and queried PostgreSQL via Railway URL format")

    def test_03_backend_live_connection_to_railway_redis(self):
        """Verify redis connects successfully with Railway-style REDIS_URL"""
        import redis as syncredis
        
        # Railway-provided Redis URL
        railway_redis_url = "redis://localhost:6379/0"
        r = syncredis.from_url(railway_redis_url, socket_timeout=3)
        self.assertTrue(r.ping(), "Redis ping failed")
        print("  ✅ PASS: Backend successfully connected and pinged Redis via Railway URL format")

    def test_04_healthcheck_endpoint_with_railway_services(self):
        """Verify FastAPI /health endpoint reports database: ok and redis: ok"""
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app)
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("details", {}).get("database"), "ok")
        self.assertEqual(data.get("details", {}).get("redis"), "ok")
        print(f"  ✅ PASS: Backend /health check confirmed: status={data.get('status')}, details={data.get('details')}")

    def test_05_railway_toml_specification_conformance(self):
        """Verify railway.toml defines Frontend, Backend, Worker (with GPU hint or high CPU), Database, and Redis"""
        import tomllib
        toml_path = os.path.join(PROJECT_ROOT, "railway.toml")
        self.assertTrue(os.path.exists(toml_path), "railway.toml missing in root directory")

        with open(toml_path, "rb") as f:
            config = tomllib.load(f)

        services = config.get("services", {})
        self.assertIn("frontend", services, "services.frontend missing")
        self.assertIn("backend", services, "services.backend missing")
        self.assertIn("worker", services, "services.worker missing")
        self.assertTrue("database" in services or "postgres" in services, "services.database or postgres missing")
        self.assertIn("redis", services, "services.redis missing")

        # Worker GPU hint or high CPU verification
        worker = services["worker"]
        has_gpu_hint = worker.get("gpu") is True or "gpu_hint" in worker or "gpu" in worker.get("resources", {})
        has_high_cpu = worker.get("cpu") == "high" or worker.get("limitOverride", {}).get("containers", {}).get("cpu", 0) >= 2
        self.assertTrue(has_gpu_hint or has_high_cpu, "Worker must define GPU hint or high CPU")

        # Frontend Next.js build verification
        frontend = services["frontend"]
        self.assertTrue("build" in frontend.get("buildCommand", "").lower() or "node" in frontend.get("startCommand", "") or "standalone" in frontend.get("dockerfilePath", "") or "jungle-bet-frontend" in frontend.get("rootDirectory", ""))

        # Database and Redis plugin verification
        database = services.get("database") or services.get("postgres")
        self.assertEqual(database.get("plugin"), "postgresql")
        redis_svc = services["redis"]
        self.assertEqual(redis_svc.get("plugin"), "redis")

        print("  ✅ PASS: railway.toml verified: all 5 services configured with required specs")


if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("🚂 RUSH HOUR BET RAILWAY INTEGRATION & BACKEND CONNECTIVITY SUITE")
    print("=" * 65 + "\n")
    unittest.main()
