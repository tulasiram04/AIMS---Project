from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.models.inventory import InventoryUpload, Asset, Reconciliation, Discrepancy, Report
from app.models.monitoring import APIRequest, GeminiUsage, UserSession
from app.api.routes import auth, users, inventory, audit, reports
from app.api.routes import admin as admin_routes
import os
import time


def create_tables():
    Base.metadata.create_all(bind=engine)


def seed_admin():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@inventorysystem.com",
                full_name="System Administrator",
                hashed_password=hash_password("admin123"),
                role=UserRole.ADMINISTRATOR,
                is_active=True,
                must_change_password=True,
                status="Enabled",
            )
            db.add(admin)
            db.commit()
            print("[SUCCESS] Admin user created: admin / admin123")
        else:
            if admin.role not in [UserRole.ADMINISTRATOR, UserRole.SUPER_ADMIN]:
                admin.role = UserRole.ADMINISTRATOR
                db.commit()
            print("[SUCCESS] Admin user already exists")
    except Exception as e:
        print(f"[WARNING] Admin seed error: {e}")
        db.rollback()
    finally:
        db.close()


def seed_super_admin():
    """Seed Super Admin from environment variables — never hardcoded."""
    db = SessionLocal()
    try:
        sa_username = settings.SUPER_ADMIN_USERNAME or "superadmin"
        sa_email    = settings.SUPER_ADMIN_EMAIL or "superadmin@aims.internal"
        sa_password = settings.SUPER_ADMIN_PASSWORD
        sa_name     = settings.SUPER_ADMIN_FULL_NAME or "Super Administrator"

        if not sa_password:
            print("[WARNING] SUPER_ADMIN_PASSWORD not set in settings — skipping super admin seed")
            return

        existing = db.query(User).filter(User.username == sa_username).first()
        if not existing:
            super_admin = User(
                username=sa_username,
                email=sa_email,
                full_name=sa_name,
                hashed_password=hash_password(sa_password),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                must_change_password=False,
                status="Enabled",
            )
            db.add(super_admin)
            db.commit()
            print(f"[SUCCESS] Super Admin created: {sa_username}")
        else:
            # Ensure existing super admin stays as Super Admin
            if existing.role != UserRole.SUPER_ADMIN:
                existing.role = UserRole.SUPER_ADMIN
                db.commit()
            print(f"[SUCCESS] Super Admin already exists: {sa_username}")
    except Exception as e:
        print(f"[WARNING] Super Admin seed error: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    seed_admin()
    seed_super_admin()
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("reports", exist_ok=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# ── API Request Tracking Middleware ───────────────────────────────────────────
@app.middleware("http")
async def track_api_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000

    # Only track /api/ routes, skip health and docs
    path = request.url.path
    if path.startswith("/api/") and path not in ["/api/v1/health"]:
        db = SessionLocal()
        try:
            # Extract user_id from JWT if present (best-effort)
            user_id = None
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    from jose import jwt as jose_jwt, JWTError
                    token = auth_header[7:]
                    payload = jose_jwt.decode(
                        token, settings.JWT_SECRET_KEY,
                        algorithms=[settings.JWT_ALGORITHM]
                    )
                    uid = payload.get("sub")
                    user_id = int(uid) if uid else None
                except Exception:
                    pass

            entry = APIRequest(
                endpoint=path,
                method=request.method,
                user_id=user_id,
                status_code=response.status_code,
                response_time_ms=round(duration_ms, 2),
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent", "")[:512],
            )
            db.add(entry)
            db.commit()
        except Exception:
            pass
        finally:
            db.close()

    return response


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix=settings.API_V1_STR)
app.include_router(users.router,         prefix=settings.API_V1_STR)
app.include_router(inventory.router,     prefix=settings.API_V1_STR)
app.include_router(audit.router,         prefix=settings.API_V1_STR)
app.include_router(reports.router,       prefix=settings.API_V1_STR)
app.include_router(admin_routes.router,  prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
