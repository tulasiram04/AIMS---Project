from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.models.inventory import InventoryUpload, Asset, Reconciliation, Discrepancy, Report
from app.api.routes import auth, users, inventory, audit, reports
import os


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
            # Let's ensure admin's role and status is correct if already exists
            admin.role = UserRole.ADMINISTRATOR
            db.commit()
            print("[SUCCESS] Admin user already exists")
    except Exception as e:
        print(f"[WARNING] Admin seed error: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    seed_admin()
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

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(inventory.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
