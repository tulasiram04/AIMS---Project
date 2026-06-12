from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, check_role
from app.services.report_service import ReportService
from app.services.audit_service import AuditService
from app.models.audit import AuditActionType
from app.models.user import User
from app.models.inventory import Report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/generate/{recon_id}")
async def generate_report(
    recon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        check_role(["Administrator", "Analyst", "Auditor"])
    ),
):
    report = ReportService.generate_pdf_report(db, recon_id, current_user)
    AuditService.log_action(
        db, current_user, AuditActionType.REPORT_GENERATED, f"Report #{report.id} Generated"
    )
    return {
        "id": report.id,
        "reconciliation_id": report.reconciliation_id,
        "report_type": report.report_type,
        "file_path": report.file_path,
        "executive_summary": report.executive_summary,
        "generated_at": report.generated_at.isoformat() if report.generated_at else None,
    }


@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    AuditService.log_action(
        db, current_user, AuditActionType.GENERATE_REPORT, f"Downloaded report {report_id}"
    )
    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=f"AIMS_Report_{report_id}.pdf",
    )


@router.get("/")
async def list_reports(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reports = db.query(Report).offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "reconciliation_id": r.reconciliation_id,
            "report_type": r.report_type,
            "executive_summary": r.executive_summary,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None,
        }
        for r in reports
    ]
