from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, check_role
from app.services.audit_service import AuditService
from app.models.user import User

from app.models.audit import AuditLog, AuditActionType

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user_id: int = None,
    action_category: str = Query(None),  # "Reconciliation", "Reports", "User Management"
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator", "Auditor"])),
):
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
        
    if action_category == "Reconciliation":
        query = query.filter(AuditLog.action == AuditActionType.RECONCILIATION_COMPLETED)
    elif action_category == "Reports":
        query = query.filter(AuditLog.action == AuditActionType.REPORT_GENERATED)
    elif action_category == "User Management":
        query = query.filter(AuditLog.action.in_([
            AuditActionType.USER_CREATED,
            AuditActionType.USER_UPDATED,
            AuditActionType.USER_DELETED,
            AuditActionType.PASSWORD_RESET,
            AuditActionType.STATUS_CHANGE
        ]))

    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": log.user.username if log.user else "Unknown",
            "action": log.action.value,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
