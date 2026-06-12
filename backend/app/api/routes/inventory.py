from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, check_role
from app.schemas.inventory import (
    ReconciliationResponse,
    ReconciliationStartRequest,
    ChatbotQueryResponse,
    ChatbotQueryRequest,
)
from app.services.upload_service import UploadService
from app.services.reconciliation_service import ReconciliationService
from app.services.ai_service import ai_service
from app.services.audit_service import AuditService
from app.models.audit import AuditActionType
from app.models.user import User
from app.models.inventory import Reconciliation, Discrepancy, InventoryUpload, Asset, Report

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator", "Analyst"])),
):
    upload = await UploadService.upload_inventory_csv(db, file, current_user)
    AuditService.log_action(
        db, current_user, AuditActionType.UPLOAD_INVENTORY, f"CSV: {file.filename}"
    )
    return {
        "id": upload.id,
        "filename": upload.filename,
        "upload_type": upload.upload_type,
        "total_records": upload.total_records,
        "upload_date": str(upload.upload_date),
    }


@router.post("/upload-json")
async def upload_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator", "Analyst"])),
):
    upload = await UploadService.upload_live_inventory_json(db, file, current_user)
    AuditService.log_action(
        db, current_user, AuditActionType.UPLOAD_LIVE_INVENTORY, f"JSON: {file.filename}"
    )
    return {
        "id": upload.id,
        "filename": upload.filename,
        "upload_type": upload.upload_type,
        "total_records": upload.total_records,
        "upload_date": str(upload.upload_date),
    }


@router.get("/uploads")
async def list_uploads(
    upload_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InventoryUpload)
    if upload_type:
        query = query.filter(InventoryUpload.upload_type == upload_type)
    uploads = query.order_by(InventoryUpload.upload_date.desc()).all()
    return [
        {
            "id": u.id,
            "filename": u.filename,
            "upload_type": u.upload_type,
            "total_records": u.total_records,
            "upload_date": str(u.upload_date),
        }
        for u in uploads
    ]


@router.post("/reconcile")
async def start_reconciliation(
    request: ReconciliationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator", "Analyst"])),
):
    recon = ReconciliationService.start_reconciliation(
        db, request.csv_upload_id, request.json_upload_id, current_user
    )

    # Run multi-agent AI analysis
    analysis, recommendations, summary = await ai_service.run_full_analysis(
        db, recon.id
    )
    if analysis:
        recon.ai_analysis = analysis
    if recommendations:
        recon.recommendations = recommendations
    if summary:
        recon.executive_summary = summary
    db.commit()
    db.refresh(recon)

    AuditService.log_action(
        db, current_user, AuditActionType.RECONCILIATION_COMPLETED, f"Reconciliation #{recon.id} Completed"
    )
    return format_recon(recon, db)


@router.get("/reconciliations/{recon_id}")
async def get_reconciliation(
    recon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recon = ReconciliationService.get_reconciliation(db, recon_id)
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    return format_recon(recon, db)


@router.get("/reconciliations")
async def list_reconciliations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recons = ReconciliationService.list_reconciliations(db, skip, limit)
    return [format_recon(r, db) for r in recons]


@router.post("/chatbot")
async def chatbot_query(
    request: ChatbotQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    response = await ai_service.chatbot_query(
        request.query, db, request.reconciliation_id
    )
    AuditService.log_action(
        db, current_user, AuditActionType.CHATBOT_QUERY, request.query
    )
    return ChatbotQueryResponse(
        query=request.query,
        response=response,
        sources=["Gemini 2.5 Flash", "LangGraph Multi-Agent"],
    )
@router.post("/reset-workspace")
async def reset_workspace(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator", "Analyst"])),
):
    # Preserve all files, database tables, and disk reports, as they are needed
    # by the history page, report center, audit tracker, etc. Only log the action.
    AuditService.log_action(
        db, current_user, AuditActionType.STATUS_CHANGE, "Workspace dashboard view reset triggered by user"
    )

    return {"status": "success", "message": "Workspace dashboard view successfully reset"}



def format_recon(recon, db):
    discrepancies = (
        db.query(Discrepancy)
        .filter(Discrepancy.reconciliation_id == recon.id)
        .all()
    )
    csv_upload = db.query(InventoryUpload).filter(InventoryUpload.id == recon.csv_upload_id).first()
    json_upload = db.query(InventoryUpload).filter(InventoryUpload.id == recon.json_upload_id).first()
    csv_filename = csv_upload.filename if csv_upload else "Unknown"
    json_filename = json_upload.filename if json_upload else "Unknown"
    
    return {
        "id": recon.id,
        "status": recon.status.value,
        "csv_filename": csv_filename,
        "json_filename": json_filename,
        "total_csv_assets": recon.total_csv_assets,
        "total_json_assets": recon.total_json_assets,
        "missing_assets_count": recon.missing_assets_count,
        "untracked_assets_count": recon.untracked_assets_count,
        "config_mismatch_count": recon.config_mismatch_count,
        "naming_mismatch_count": recon.naming_mismatch_count,
        "ai_analysis": recon.ai_analysis,
        "recommendations": recon.recommendations,
        "executive_summary": recon.executive_summary,
        "started_at": recon.started_at.isoformat() if recon.started_at else None,
        "completed_at": recon.completed_at.isoformat() if recon.completed_at else None,
        "discrepancies": [
            {
                "id": d.id,
                "discrepancy_type": d.discrepancy_type.value,
                "csv_asset_id": d.csv_asset_id,
                "json_asset_id": d.json_asset_id,
                "severity": d.severity,
                "details": d.details,
                "root_cause": d.root_cause,
                "recommended_action": d.recommended_action,
                "business_impact": d.business_impact,
                "estimated_effort": d.estimated_effort,
                "expected_risk_reduction": d.expected_risk_reduction,
                "csv_data": d.csv_data,
                "json_data": d.json_data,
            }
            for d in discrepancies
        ],
    }
