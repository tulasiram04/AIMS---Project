"""
AIMS Admin Control Center — Backend Routes
All endpoints protected by Administrator or Super Admin role.
No dangerous SQL execution or table deletion exposed.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import os

from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.user import User, UserRole
from app.models.inventory import (
    InventoryUpload, Asset, Reconciliation,
    Discrepancy, Report, ReconciliationStatus
)
from app.models.audit import AuditLog, AuditActionType
from app.models.monitoring import APIRequest, GeminiUsage, UserSession

router = APIRouter(prefix="/admin", tags=["admin"])

# ── Role guard: Administrator OR Super Admin ──────────────────────────────────
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_val not in ["Administrator", "Super Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ─── helpers ─────────────────────────────────────────────────────────────────
def _date_range_filter(days: int):
    return datetime.utcnow() - timedelta(days=days)

def _trend_by_day(db: Session, model, date_col, days: int = 30) -> List[Dict]:
    """Generic daily count trend for any model."""
    since = _date_range_filter(days)
    rows = (
        db.query(func.date(date_col).label("d"), func.count().label("c"))
        .filter(date_col >= since)
        .group_by(func.date(date_col))
        .order_by(func.date(date_col))
        .all()
    )
    return [{"date": str(r.d), "count": r.c} for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# 1. EXECUTIVE DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_users       = db.query(func.count(User.id)).scalar() or 0
    active_users      = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    disabled_users    = db.query(func.count(User.id)).filter(User.is_active == False).scalar() or 0
    new_today         = db.query(func.count(User.id)).filter(User.created_at >= today_start).scalar() or 0
    new_this_month    = db.query(func.count(User.id)).filter(User.created_at >= month_start).scalar() or 0
    online_users      = db.query(func.count(UserSession.id)).filter(UserSession.is_active == True).scalar() or 0

    total_assets      = db.query(func.count(Asset.id)).scalar() or 0
    total_uploads     = db.query(func.count(InventoryUpload.id)).scalar() or 0
    total_recons      = db.query(func.count(Reconciliation.id)).scalar() or 0
    completed_recons  = db.query(func.count(Reconciliation.id)).filter(
                            Reconciliation.status == ReconciliationStatus.COMPLETED).scalar() or 0
    failed_recons     = db.query(func.count(Reconciliation.id)).filter(
                            Reconciliation.status == ReconciliationStatus.FAILED).scalar() or 0
    total_reports     = db.query(func.count(Report.id)).scalar() or 0
    total_audit_logs  = db.query(func.count(AuditLog.id)).scalar() or 0
    total_gemini      = db.query(func.count(GeminiUsage.id)).scalar() or 0
    total_api_req     = db.query(func.count(APIRequest.id)).scalar() or 0
    chatbot_queries   = db.query(func.count(AuditLog.id)).filter(
                            AuditLog.action == AuditActionType.CHATBOT_QUERY).scalar() or 0

    # DB size
    db_url = os.environ.get("DATABASE_URL", "")
    db_size_mb = 0.0
    if "sqlite" in db_url:
        db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
        if os.path.exists(db_path):
            db_size_mb = round(os.path.getsize(db_path) / (1024 * 1024), 2)

    # Trends (30 days)
    user_trend   = _trend_by_day(db, User,             User.created_at,              30)
    upload_trend = _trend_by_day(db, InventoryUpload,  InventoryUpload.upload_date,  30)
    recon_trend  = _trend_by_day(db, Reconciliation,   Reconciliation.started_at,    30)
    report_trend = _trend_by_day(db, Report,           Report.generated_at,          30)
    ai_trend     = _trend_by_day(db, GeminiUsage,      GeminiUsage.created_at,       30)
    api_trend    = _trend_by_day(db, APIRequest,       APIRequest.created_at,        30)

    return {
        "users": {
            "total": total_users, "active": active_users,
            "disabled": disabled_users, "online": online_users,
            "new_today": new_today, "new_this_month": new_this_month,
        },
        "inventory": {"total_uploads": total_uploads, "total_assets": total_assets},
        "reconciliations": {
            "total": total_recons, "completed": completed_recons,
            "failed": failed_recons,
            "success_rate": round((completed_recons / total_recons * 100), 1) if total_recons else 0,
        },
        "reports": {"total": total_reports},
        "audit": {"total": total_audit_logs},
        "ai": {"total_requests": total_gemini, "chatbot_queries": chatbot_queries},
        "api": {"total_requests": total_api_req},
        "database": {"size_mb": db_size_mb},
        "trends": {
            "user_growth": user_trend,
            "upload_trend": upload_trend,
            "recon_trend": recon_trend,
            "report_trend": report_trend,
            "ai_trend": ai_trend,
            "api_trend": api_trend,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. USER MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/users")
async def admin_list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(User)
    if search:
        term = f"%{search}%"
        q = q.filter(
            User.username.ilike(term) | User.email.ilike(term) | User.full_name.ilike(term)
        )
    if role:
        q = q.filter(User.role == role)
    if status:
        q = q.filter(User.status == status)

    total = q.count()
    users = q.order_by(desc(User.created_at)).offset((page - 1) * limit).limit(limit).all()

    result = []
    for u in users:
        uploads_count = db.query(func.count(InventoryUpload.id)).filter(
            InventoryUpload.uploaded_by_id == u.id).scalar() or 0
        recons_count  = db.query(func.count(Reconciliation.id)).filter(
            Reconciliation.initiated_by_id == u.id).scalar() or 0
        reports_count = db.query(func.count(Report.id)).filter(
            Report.generated_by_id == u.id).scalar() or 0
        chatbot_count = db.query(func.count(AuditLog.id)).filter(
            AuditLog.user_id == u.id, AuditLog.action == AuditActionType.CHATBOT_QUERY).scalar() or 0
        last_activity = db.query(func.max(AuditLog.created_at)).filter(
            AuditLog.user_id == u.id).scalar()

        result.append({
            "id": u.id, "username": u.username, "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "status": u.status, "is_active": u.is_active,
            "total_logins": u.total_logins or 0,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "last_activity": last_activity.isoformat() if last_activity else None,
            "stats": {
                "uploads": uploads_count, "reconciliations": recons_count,
                "reports": reports_count, "chatbot_queries": chatbot_count,
            },
        })

    return {"users": result, "total": total, "page": page, "limit": limit}


@router.get("/users/{user_id}")
async def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    uploads   = db.query(func.count(InventoryUpload.id)).filter(InventoryUpload.uploaded_by_id == u.id).scalar() or 0
    recons    = db.query(func.count(Reconciliation.id)).filter(Reconciliation.initiated_by_id == u.id).scalar() or 0
    reports   = db.query(func.count(Report.id)).filter(Report.generated_by_id == u.id).scalar() or 0
    chatbot   = db.query(func.count(AuditLog.id)).filter(
                    AuditLog.user_id == u.id, AuditLog.action == AuditActionType.CHATBOT_QUERY).scalar() or 0
    gemini_q  = db.query(func.count(GeminiUsage.id)).filter(GeminiUsage.user_id == u.id).scalar() or 0
    api_req   = db.query(func.count(APIRequest.id)).filter(APIRequest.user_id == u.id).scalar() or 0
    sessions  = db.query(func.count(UserSession.id)).filter(UserSession.user_id == u.id).scalar() or 0

    recent_logs = (db.query(AuditLog).filter(AuditLog.user_id == u.id)
                   .order_by(desc(AuditLog.created_at)).limit(10).all())

    return {
        "id": u.id, "username": u.username, "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        "status": u.status, "is_active": u.is_active,
        "total_logins": u.total_logins or 0,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "stats": {
            "uploads": uploads, "reconciliations": recons, "reports": reports,
            "chatbot_queries": chatbot, "gemini_requests": gemini_q,
            "api_requests": api_req, "sessions": sessions,
        },
        "recent_activity": [
            {
                "action": log.action.value if hasattr(log.action, "value") else str(log.action),
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in recent_logs
        ],
    }


@router.put("/users/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin account here")

    allowed = {"full_name", "email", "role", "status", "is_active"}
    for key, val in payload.items():
        if key in allowed:
            if key == "role":
                try:
                    u.role = UserRole(val)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid role: {val}")
            elif key == "is_active":
                u.is_active = bool(val)
                u.status = "Enabled" if bool(val) else "Disabled"
            else:
                setattr(u, key, val)

    u.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(u)
    return {"message": "User updated", "user_id": u.id}


@router.post("/users/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    new_password = payload.get("new_password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    u.hashed_password = hash_password(new_password)
    u.must_change_password = True
    u.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully"}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    username = u.username
    db.delete(u)
    db.commit()
    return {"message": f"User '{username}' deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# 3. USER ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/user-analytics")
async def get_user_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Top active users by audit log count
    top_users_q = (
        db.query(User.id, User.username, User.full_name,
                 func.count(AuditLog.id).label("activity_count"))
        .join(AuditLog, AuditLog.user_id == User.id, isouter=True)
        .group_by(User.id, User.username, User.full_name)
        .order_by(desc("activity_count"))
        .limit(10)
        .all()
    )
    top_users = [
        {"id": r.id, "username": r.username, "full_name": r.full_name,
         "activity_count": r.activity_count}
        for r in top_users_q
    ]

    # Registration trend (90 days)
    reg_trend = _trend_by_day(db, User, User.created_at, 90)

    # Login trend from sessions
    login_trend = _trend_by_day(db, UserSession, UserSession.login_at, 30)

    # Role distribution
    roles_q = (db.query(User.role, func.count(User.id).label("c"))
               .group_by(User.role).all())
    role_dist = [
        {"role": r.role.value if hasattr(r.role, "value") else str(r.role), "count": r.c}
        for r in roles_q
    ]

    # Per-user API usage (top 10)
    top_api_users = (
        db.query(APIRequest.user_id, func.count(APIRequest.id).label("requests"))
        .filter(APIRequest.user_id.isnot(None))
        .group_by(APIRequest.user_id)
        .order_by(desc("requests"))
        .limit(10)
        .all()
    )
    api_users = []
    for r in top_api_users:
        u = db.query(User).filter(User.id == r.user_id).first()
        api_users.append({
            "user_id": r.user_id,
            "username": u.username if u else "Unknown",
            "requests": r.requests
        })

    return {
        "top_active_users": top_users,
        "registration_trend": reg_trend,
        "login_trend": login_trend,
        "role_distribution": role_dist,
        "top_api_users": api_users,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. INVENTORY GOVERNANCE
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/assets")
async def admin_get_assets(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Asset)
    if search:
        term = f"%{search}%"
        q = q.filter(Asset.asset_name.ilike(term) | Asset.asset_id.ilike(term))
    if asset_type:
        q = q.filter(Asset.asset_type == asset_type)

    total = q.count()
    assets = q.order_by(desc(Asset.created_at)).offset((page - 1) * limit).limit(limit).all()

    # Type breakdown
    type_dist = (db.query(Asset.asset_type, func.count(Asset.id).label("c"))
                 .group_by(Asset.asset_type).all())
    type_breakdown = [{"type": t.asset_type or "Unknown", "count": t.c} for t in type_dist]

    return {
        "assets": [
            {
                "id": a.id, "asset_id": a.asset_id, "asset_name": a.asset_name,
                "asset_type": a.asset_type, "location": a.location,
                "status": a.status, "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in assets
        ],
        "total": total, "page": page, "limit": limit,
        "type_breakdown": type_breakdown,
    }


@router.delete("/assets/{asset_id}")
async def admin_delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    a = db.query(Asset).filter(Asset.id == asset_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(a)
    db.commit()
    return {"message": "Asset deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# 5. RECONCILIATION OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/reconciliations")
async def admin_list_reconciliations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Reconciliation)
    if status:
        q = q.filter(Reconciliation.status == status)
    total = q.count()
    recons = q.order_by(desc(Reconciliation.started_at)).offset((page - 1) * limit).limit(limit).all()

    # Stats
    total_discrepancies = db.query(func.count(Discrepancy.id)).scalar() or 0
    avg_processing = None
    rows = db.query(
        func.avg(
            func.julianday(Reconciliation.completed_at) - func.julianday(Reconciliation.started_at)
        )
    ).filter(Reconciliation.completed_at.isnot(None)).scalar()
    if rows:
        avg_processing = round(rows * 86400, 2)  # days to seconds

    return {
        "reconciliations": [
            {
                "id": r.id,
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "total_csv_assets": r.total_csv_assets, "total_json_assets": r.total_json_assets,
                "missing_assets_count": r.missing_assets_count,
                "untracked_assets_count": r.untracked_assets_count,
                "config_mismatch_count": r.config_mismatch_count,
                "naming_mismatch_count": r.naming_mismatch_count,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in recons
        ],
        "total": total, "page": page, "limit": limit,
        "summary": {
            "total_discrepancies": total_discrepancies,
            "avg_processing_seconds": avg_processing,
        },
    }


@router.delete("/reconciliations/{recon_id}")
async def admin_delete_reconciliation(
    recon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    r = db.query(Reconciliation).filter(Reconciliation.id == recon_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    db.query(Discrepancy).filter(Discrepancy.reconciliation_id == recon_id).delete()
    db.delete(r)
    db.commit()
    return {"message": "Reconciliation run deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# 6. REPORT MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/reports")
async def admin_list_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total = db.query(func.count(Report.id)).scalar() or 0
    reports = (db.query(Report).order_by(desc(Report.generated_at))
               .offset((page - 1) * limit).limit(limit).all())

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    reports_today = db.query(func.count(Report.id)).filter(Report.generated_at >= today_start).scalar() or 0

    report_types = (db.query(Report.report_type, func.count(Report.id).label("c"))
                    .group_by(Report.report_type).all())

    return {
        "reports": [
            {
                "id": r.id, "report_type": r.report_type, "file_path": r.file_path,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
                "reconciliation_id": r.reconciliation_id,
                "generated_by_id": r.generated_by_id,
            }
            for r in reports
        ],
        "total": total, "page": page, "limit": limit,
        "summary": {
            "total": total, "reports_today": reports_today,
            "type_breakdown": [{"type": t.report_type or "Unknown", "count": t.c} for t in report_types],
        },
    }


@router.delete("/reports/{report_id}")
async def admin_delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    # Remove file from disk if it exists
    if r.file_path and os.path.exists(r.file_path):
        os.remove(r.file_path)
    db.delete(r)
    db.commit()
    return {"message": "Report deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# 7. AUDIT & COMPLIANCE
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/audit-logs")
async def admin_get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    since = _date_range_filter(days)
    q = db.query(AuditLog).filter(AuditLog.created_at >= since)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)

    total = q.count()
    logs = q.order_by(desc(AuditLog.created_at)).offset((page - 1) * limit).limit(limit).all()

    result = []
    for log in logs:
        u = db.query(User).filter(User.id == log.user_id).first()
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": u.username if u else "Unknown",
            "action": log.action.value if hasattr(log.action, "value") else str(log.action),
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    action_dist = (db.query(AuditLog.action, func.count(AuditLog.id).label("c"))
                   .filter(AuditLog.created_at >= since)
                   .group_by(AuditLog.action).all())

    return {
        "logs": result, "total": total, "page": page, "limit": limit,
        "action_distribution": [
            {"action": a.action.value if hasattr(a.action, "value") else str(a.action), "count": a.c}
            for a in action_dist
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. AI / GEMINI OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/gemini-analytics")
async def get_gemini_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    since = _date_range_filter(days)

    total        = db.query(func.count(GeminiUsage.id)).filter(GeminiUsage.created_at >= since).scalar() or 0
    successful   = db.query(func.count(GeminiUsage.id)).filter(GeminiUsage.created_at >= since, GeminiUsage.success == True).scalar() or 0
    failed       = total - successful
    avg_resp     = db.query(func.avg(GeminiUsage.response_time_ms)).filter(GeminiUsage.created_at >= since).scalar()
    est_tokens   = db.query(func.sum(GeminiUsage.estimated_tokens)).filter(GeminiUsage.created_at >= since).scalar() or 0
    est_cost_usd = round((est_tokens / 1_000_000) * 0.075, 4)  # Gemini Flash pricing

    daily_trend = _trend_by_day(db, GeminiUsage, GeminiUsage.created_at, days)

    # Top AI users
    top_ai_users_q = (
        db.query(GeminiUsage.user_id, func.count(GeminiUsage.id).label("c"))
        .filter(GeminiUsage.created_at >= since, GeminiUsage.user_id.isnot(None))
        .group_by(GeminiUsage.user_id).order_by(desc("c")).limit(10).all()
    )
    top_ai_users = []
    for r in top_ai_users_q:
        u = db.query(User).filter(User.id == r.user_id).first()
        top_ai_users.append({"user_id": r.user_id, "username": u.username if u else "Unknown", "count": r.c})

    # Request type distribution
    type_dist = (db.query(GeminiUsage.request_type, func.count(GeminiUsage.id).label("c"))
                 .filter(GeminiUsage.created_at >= since).group_by(GeminiUsage.request_type).all())

    # Fallback from audit_logs if gemini_usage is empty
    if total == 0:
        chatbot_count = db.query(func.count(AuditLog.id)).filter(
            AuditLog.action == AuditActionType.CHATBOT_QUERY,
            AuditLog.created_at >= since
        ).scalar() or 0
        recon_ai_count = db.query(func.count(AuditLog.id)).filter(
            AuditLog.action == AuditActionType.RECONCILIATION_COMPLETED,
            AuditLog.created_at >= since
        ).scalar() or 0
        total = chatbot_count + recon_ai_count
        successful = total
        type_dist_fallback = [
            {"type": "chatbot", "count": chatbot_count},
            {"type": "reconciliation", "count": recon_ai_count},
        ]
    else:
        type_dist_fallback = [{"type": t.request_type, "count": t.c} for t in type_dist]

    return {
        "summary": {
            "total_requests": total, "successful": successful, "failed": failed,
            "avg_response_ms": round(avg_resp, 2) if avg_resp else 0,
            "estimated_tokens": est_tokens,
            "estimated_cost_usd": est_cost_usd,
        },
        "daily_trend": daily_trend,
        "top_users": top_ai_users,
        "type_distribution": type_dist_fallback,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 9. API MONITORING
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api-analytics")
async def get_api_analytics(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    since = _date_range_filter(days)

    total_req   = db.query(func.count(APIRequest.id)).filter(APIRequest.created_at >= since).scalar() or 0
    error_req   = db.query(func.count(APIRequest.id)).filter(
                      APIRequest.created_at >= since, APIRequest.status_code >= 400).scalar() or 0
    avg_resp    = db.query(func.avg(APIRequest.response_time_ms)).filter(APIRequest.created_at >= since).scalar()

    # Top endpoints
    top_endpoints = (
        db.query(APIRequest.endpoint, func.count(APIRequest.id).label("c"),
                 func.avg(APIRequest.response_time_ms).label("avg_ms"))
        .filter(APIRequest.created_at >= since)
        .group_by(APIRequest.endpoint)
        .order_by(desc("c")).limit(15).all()
    )

    # Status code distribution
    status_dist = (db.query(APIRequest.status_code, func.count(APIRequest.id).label("c"))
                   .filter(APIRequest.created_at >= since)
                   .group_by(APIRequest.status_code).order_by(desc("c")).all())

    daily_trend = _trend_by_day(db, APIRequest, APIRequest.created_at, days)

    return {
        "summary": {
            "total_requests": total_req, "error_requests": error_req,
            "error_rate": round((error_req / total_req * 100), 2) if total_req else 0,
            "avg_response_ms": round(avg_resp, 2) if avg_resp else 0,
        },
        "top_endpoints": [
            {"endpoint": e.endpoint, "count": e.c, "avg_ms": round(e.avg_ms or 0, 2)}
            for e in top_endpoints
        ],
        "status_distribution": [{"code": s.status_code, "count": s.c} for s in status_dist],
        "daily_trend": daily_trend,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 10. DATABASE HEALTH (read-only — no SQL execution, no deletion)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/database-health")
async def get_database_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    db_url = os.environ.get("DATABASE_URL", "")
    is_sqlite = "sqlite" in db_url

    # Row counts for every tracked table
    tables = {
        "users":              db.query(func.count(User.id)).scalar() or 0,
        "audit_logs":         db.query(func.count(AuditLog.id)).scalar() or 0,
        "assets":             db.query(func.count(Asset.id)).scalar() or 0,
        "inventory_uploads":  db.query(func.count(InventoryUpload.id)).scalar() or 0,
        "reconciliations":    db.query(func.count(Reconciliation.id)).scalar() or 0,
        "discrepancies":      db.query(func.count(Discrepancy.id)).scalar() or 0,
        "reports":            db.query(func.count(Report.id)).scalar() or 0,
        "api_requests":       db.query(func.count(APIRequest.id)).scalar() or 0,
        "gemini_usage":       db.query(func.count(GeminiUsage.id)).scalar() or 0,
        "user_sessions":      db.query(func.count(UserSession.id)).scalar() or 0,
    }

    db_size_mb = 0.0
    db_version = "Unknown"
    if is_sqlite:
        db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
        if not os.path.isabs(db_path):
            db_path = os.path.join(os.getcwd(), db_path.lstrip("./"))
        if os.path.exists(db_path):
            db_size_mb = round(os.path.getsize(db_path) / (1024 * 1024), 3)
        try:
            row = db.execute(text("SELECT sqlite_version()")).fetchone()
            db_version = f"SQLite {row[0]}" if row else "SQLite"
        except Exception:
            db_version = "SQLite"
    else:
        try:
            row = db.execute(text("SELECT version()")).fetchone()
            db_version = row[0][:60] if row else "PostgreSQL"
        except Exception:
            db_version = "PostgreSQL"

    return {
        "database_type": "SQLite" if is_sqlite else "PostgreSQL",
        "version": db_version,
        "size_mb": db_size_mb,
        "table_stats": [
            {"table": t, "row_count": c} for t, c in tables.items()
        ],
        "total_records": sum(tables.values()),
        "status": "healthy",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 11. SYSTEM HEALTH
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/system-health")
async def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Backend health
    backend_ok = True

    # DB health
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    # Gemini key configured
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    gemini_configured = bool(gemini_key and len(gemini_key) > 10)

    # Active sessions
    active_sessions = db.query(func.count(UserSession.id)).filter(UserSession.is_active == True).scalar() or 0

    return {
        "services": [
            {"name": "Backend API", "status": "healthy" if backend_ok else "critical",
             "details": "FastAPI running"},
            {"name": "Database",    "status": "healthy" if db_ok else "critical",
             "details": "SQLAlchemy connected"},
            {"name": "Gemini AI",   "status": "healthy" if gemini_configured else "warning",
             "details": "API key configured" if gemini_configured else "API key missing"},
            {"name": "Admin Panel", "status": "healthy", "details": "Admin routes active"},
        ],
        "metrics": {
            "active_sessions": active_sessions,
            "total_users": db.query(func.count(User.id)).scalar() or 0,
            "total_audit_logs": db.query(func.count(AuditLog.id)).scalar() or 0,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 12. SECURITY OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/security")
async def get_security_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    since = _date_range_filter(days)

    # Password resets as a security event proxy
    password_resets = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == AuditActionType.PASSWORD_RESET,
        AuditLog.created_at >= since
    ).scalar() or 0

    # Status changes (enable/disable accounts)
    account_changes = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == AuditActionType.STATUS_CHANGE,
        AuditLog.created_at >= since
    ).scalar() or 0

    # Disabled accounts
    disabled_users = db.query(func.count(User.id)).filter(User.is_active == False).scalar() or 0

    # User deletions
    user_deletions = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == AuditActionType.USER_DELETED,
        AuditLog.created_at >= since
    ).scalar() or 0

    # 4xx error rate from API requests
    total_api    = db.query(func.count(APIRequest.id)).filter(APIRequest.created_at >= since).scalar() or 0
    auth_errors  = db.query(func.count(APIRequest.id)).filter(
        APIRequest.created_at >= since, APIRequest.status_code.in_([401, 403])).scalar() or 0

    # Recent security events
    security_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.action.in_([
                AuditActionType.PASSWORD_RESET,
                AuditActionType.STATUS_CHANGE,
                AuditActionType.USER_CREATED,
                AuditActionType.USER_DELETED,
            ]),
            AuditLog.created_at >= since
        )
        .order_by(desc(AuditLog.created_at)).limit(50).all()
    )

    events = []
    for log in security_logs:
        u = db.query(User).filter(User.id == log.user_id).first()
        events.append({
            "id": log.id,
            "action": log.action.value if hasattr(log.action, "value") else str(log.action),
            "username": u.username if u else "Unknown",
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    security_score = 100
    if disabled_users > 0:        security_score -= min(disabled_users * 2, 15)
    if auth_errors > 10:          security_score -= 10
    if password_resets > 5:       security_score -= 5

    return {
        "security_score": max(security_score, 0),
        "summary": {
            "password_resets": password_resets,
            "account_changes": account_changes,
            "disabled_accounts": disabled_users,
            "user_deletions": user_deletions,
            "auth_errors": auth_errors,
            "total_api_requests": total_api,
        },
        "recent_events": events,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 13. BUSINESS INTELLIGENCE
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/business-intelligence")
async def get_business_intelligence(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Most active user
    most_active = (
        db.query(User.username, func.count(AuditLog.id).label("c"))
        .join(AuditLog, AuditLog.user_id == User.id)
        .group_by(User.username).order_by(desc("c")).first()
    )

    # Most used feature (by audit log action)
    most_used_feature = (
        db.query(AuditLog.action, func.count(AuditLog.id).label("c"))
        .group_by(AuditLog.action).order_by(desc("c")).first()
    )

    # Feature adoption (all actions counted)
    feature_adoption = (
        db.query(AuditLog.action, func.count(AuditLog.id).label("c"))
        .group_by(AuditLog.action).order_by(desc("c")).all()
    )

    # Platform growth trend (90 days)
    growth_trend = []
    for i in range(12):
        end   = datetime.utcnow() - timedelta(days=i * 7)
        start = end - timedelta(days=7)
        count = db.query(func.count(AuditLog.id)).filter(
            AuditLog.created_at >= start, AuditLog.created_at < end).scalar() or 0
        growth_trend.append({"week": f"W-{i}", "activities": count})
    growth_trend.reverse()

    # Top report types
    report_types = (db.query(Report.report_type, func.count(Report.id).label("c"))
                    .group_by(Report.report_type).order_by(desc("c")).all())

    return {
        "kpis": {
            "most_active_user": most_active.username if most_active else "N/A",
            "most_active_count": most_active.c if most_active else 0,
            "most_used_feature": (most_used_feature.action.value
                                  if most_used_feature and hasattr(most_used_feature.action, "value")
                                  else str(most_used_feature.action) if most_used_feature else "N/A"),
        },
        "feature_adoption": [
            {
                "feature": f.action.value if hasattr(f.action, "value") else str(f.action),
                "count": f.c
            }
            for f in feature_adoption
        ],
        "platform_growth": growth_trend,
        "top_report_types": [{"type": r.report_type or "Unknown", "count": r.c} for r in report_types],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Log Gemini usage (called from inventory routes)
# ─────────────────────────────────────────────────────────────────────────────
def log_gemini_usage(
    db: Session, user_id: Optional[int], request_type: str,
    success: bool = True, response_time_ms: float = 0.0,
    estimated_tokens: int = 0, error_message: Optional[str] = None,
):
    entry = GeminiUsage(
        user_id=user_id,
        request_type=request_type,
        success=success,
        response_time_ms=response_time_ms,
        estimated_tokens=estimated_tokens,
        error_message=error_message,
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()
