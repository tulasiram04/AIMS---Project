from sqlalchemy.orm import Session
from app.models.audit import AuditLog, AuditActionType
from app.models.user import User

class AuditService:
    @staticmethod
    def log_action(db: Session, user: User, action: AuditActionType, details=None):
        # Exclude actions that aren't part of the Governance Tracker definition
        if action not in [
            AuditActionType.RECONCILIATION_COMPLETED,
            AuditActionType.REPORT_GENERATED,
            AuditActionType.USER_CREATED,
            AuditActionType.USER_UPDATED,
            AuditActionType.USER_DELETED,
            AuditActionType.PASSWORD_RESET,
            AuditActionType.STATUS_CHANGE
        ]:
            return None

        log = AuditLog(user_id=user.id, action=action, details=details)
        db.add(log)
        db.commit()
        db.refresh(log)

        # Truncate logs if they exceed 10
        total_logs = db.query(AuditLog).count()
        if total_logs > 10:
            oldest_logs = (
                db.query(AuditLog)
                .order_by(AuditLog.created_at.asc())
                .limit(total_logs - 10)
                .all()
            )
            for old in oldest_logs:
                db.delete(old)
            db.commit()

        return log

    @staticmethod
    def get_audit_logs(db: Session, user_id=None, skip=0, limit=100):
        query = db.query(AuditLog)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
