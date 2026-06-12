from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class InventoryUpload(Base):
    __tablename__ = "inventory_uploads"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    upload_type = Column(String, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    total_records = Column(Integer, default=0)
    upload_date = Column(DateTime, default=datetime.utcnow)
    uploaded_by = relationship("User")
    assets = relationship("Asset", back_populates="source_upload")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    source_upload_id = Column(Integer, ForeignKey("inventory_uploads.id"))
    asset_id = Column(String, index=True)
    asset_name = Column(String)
    asset_type = Column(String)
    location = Column(String)
    status = Column(String)
    configuration = Column(JSON)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    source_upload = relationship("InventoryUpload", back_populates="assets")

class ReconciliationStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class Reconciliation(Base):
    __tablename__ = "reconciliations"
    id = Column(Integer, primary_key=True, index=True)
    csv_upload_id = Column(Integer, ForeignKey("inventory_uploads.id"))
    json_upload_id = Column(Integer, ForeignKey("inventory_uploads.id"))
    initiated_by_id = Column(Integer, ForeignKey("users.id"))
    status = Column(Enum(ReconciliationStatus), default=ReconciliationStatus.PENDING)
    total_csv_assets = Column(Integer, default=0)
    total_json_assets = Column(Integer, default=0)
    missing_assets_count = Column(Integer, default=0)
    untracked_assets_count = Column(Integer, default=0)
    config_mismatch_count = Column(Integer, default=0)
    naming_mismatch_count = Column(Integer, default=0)
    ai_analysis = Column(Text)
    recommendations = Column(JSON)
    executive_summary = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

class DiscrepancyType(str, enum.Enum):
    MISSING_ASSET = "MISSING_ASSET"
    UNTRACKED_ASSET = "UNTRACKED_ASSET"
    CONFIG_MISMATCH = "CONFIG_MISMATCH"
    NAMING_MISMATCH = "NAMING_MISMATCH"

class Discrepancy(Base):
    __tablename__ = "discrepancies"
    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliations.id"))
    discrepancy_type = Column(Enum(DiscrepancyType), nullable=False)
    csv_asset_id = Column(String, nullable=True)
    json_asset_id = Column(String, nullable=True)
    csv_data = Column(JSON)
    json_data = Column(JSON)
    severity = Column(String)
    details = Column(Text)
    root_cause = Column(Text)
    recommended_action = Column(Text)
    business_impact = Column(Text, nullable=True)
    estimated_effort = Column(String, nullable=True)
    expected_risk_reduction = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliations.id"))
    generated_by_id = Column(Integer, ForeignKey("users.id"))
    report_type = Column(String)
    file_path = Column(String)
    executive_summary = Column(Text)
    generated_at = Column(DateTime, default=datetime.utcnow)
