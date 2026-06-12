import os
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.inventory import (
    Reconciliation,
    Discrepancy,
    Asset,
    DiscrepancyType,
    ReconciliationStatus,
    Report,
)
from app.models.user import User
from difflib import SequenceMatcher


class ReconciliationService:
    @staticmethod
    def normalize_string(s):
        return str(s).strip().lower().replace("_", " ").replace("-", " ")

    @staticmethod
    def find_fuzzy_match(target, candidates):
        target_normalized = ReconciliationService.normalize_string(target)
        best = None
        best_ratio = 0.0
        for asset_id, name in candidates:
            ratio = SequenceMatcher(
                None,
                target_normalized,
                ReconciliationService.normalize_string(name),
            ).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best = (asset_id, name)
        return (best + (best_ratio,)) if best else (None, None, 0.0)

    @staticmethod
    def compare_configurations(csv_asset: Asset, json_asset: Asset) -> list:
        """Compare configuration fields between CSV and JSON asset records."""
        mismatches = []
        csv_config = csv_asset.raw_data or {}
        json_config = json_asset.raw_data or {}

        compare_fields = [
            "asset_type", "type", "location", "status", "os", "operating_system",
            "ip_address", "ip", "environment", "env", "department", "owner",
            "cpu", "memory", "ram", "storage", "disk",
        ]

        for field in compare_fields:
            csv_val = csv_config.get(field)
            json_val = json_config.get(field)
            if csv_val is not None and json_val is not None:
                if str(csv_val).strip().lower() != str(json_val).strip().lower():
                    mismatches.append({
                        "field": field,
                        "csv_value": str(csv_val),
                        "json_value": str(json_val),
                    })

        return mismatches

    @staticmethod
    def start_reconciliation(
        db: Session, csv_upload_id: int, json_upload_id: int, user: User
    ):
        recon = Reconciliation(
            csv_upload_id=csv_upload_id,
            json_upload_id=json_upload_id,
            initiated_by_id=user.id,
            status=ReconciliationStatus.IN_PROGRESS,
        )
        db.add(recon)
        db.commit()
        db.refresh(recon)

        csv_assets = (
            db.query(Asset).filter(Asset.source_upload_id == csv_upload_id).all()
        )
        json_assets = (
            db.query(Asset).filter(Asset.source_upload_id == json_upload_id).all()
        )

        recon.total_csv_assets = len(csv_assets)
        recon.total_json_assets = len(json_assets)

        csv_by_id = {a.asset_id: a for a in csv_assets}
        json_by_id = {a.asset_id: a for a in json_assets}
        json_names = [(a.asset_id, a.asset_name) for a in json_assets]
        matched_json_ids = set()

        for csv_asset in csv_assets:
            if csv_asset.asset_id in json_by_id:
                # Both exist — check for configuration mismatch
                json_asset = json_by_id[csv_asset.asset_id]
                matched_json_ids.add(json_asset.asset_id)

                config_mismatches = ReconciliationService.compare_configurations(
                    csv_asset, json_asset
                )
                if config_mismatches:
                    d = Discrepancy(
                        reconciliation_id=recon.id,
                        discrepancy_type=DiscrepancyType.CONFIG_MISMATCH,
                        csv_asset_id=csv_asset.asset_id,
                        json_asset_id=json_asset.asset_id,
                        csv_data=csv_asset.raw_data,
                        json_data=json_asset.raw_data,
                        severity="MEDIUM",
                        details=f"Configuration mismatch on fields: {', '.join(m['field'] for m in config_mismatches)}",
                        root_cause="Unauthorized environment changes. Host parameters drifted from registration template.",
                        recommended_action="Standardize host configuration properties via automation playbooks.",
                        business_impact="Registry compliance drift, leading to operational template deviations and vulnerability scan failures.",
                        estimated_effort="3 Hours",
                        expected_risk_reduction="20% Risk Reduction"
                    )
                    db.add(d)
                    recon.config_mismatch_count += 1

                # Check naming mismatch (same ID but different name)
                if csv_asset.asset_name and json_asset.asset_name:
                    csv_name_norm = ReconciliationService.normalize_string(csv_asset.asset_name)
                    json_name_norm = ReconciliationService.normalize_string(json_asset.asset_name)
                    if csv_name_norm != json_name_norm:
                        ratio = SequenceMatcher(None, csv_name_norm, json_name_norm).ratio()
                        if ratio > 0.4:
                            d = Discrepancy(
                                reconciliation_id=recon.id,
                                discrepancy_type=DiscrepancyType.NAMING_MISMATCH,
                                csv_asset_id=csv_asset.asset_id,
                                json_asset_id=json_asset.asset_id,
                                csv_data=csv_asset.raw_data,
                                json_data=json_asset.raw_data,
                                severity="LOW",
                                details=f"Name mismatch: CSV='{csv_asset.asset_name}' vs Live='{json_asset.asset_name}'",
                                root_cause="Manual register mismatch. Similar hostname match identified with registry naming drifted.",
                                recommended_action="Correct registry host name identifier parameters directly.",
                                business_impact="Auditor catalog drift, causing naming conflicts and database cross-referencing delays.",
                                estimated_effort="1 Hour",
                                expected_risk_reduction="10% Risk Reduction"
                            )
                            db.add(d)
                            recon.naming_mismatch_count += 1
            else:
                # Not found by ID — try fuzzy name match
                match_id, match_name, ratio = ReconciliationService.find_fuzzy_match(
                    csv_asset.asset_name, json_names
                )
                if ratio > 0.7 and match_id:
                    matched_json_ids.add(match_id)
                    d = Discrepancy(
                        reconciliation_id=recon.id,
                        discrepancy_type=DiscrepancyType.NAMING_MISMATCH,
                        csv_asset_id=csv_asset.asset_id,
                        json_asset_id=match_id,
                        csv_data=csv_asset.raw_data,
                        json_data=json_by_id[match_id].raw_data if match_id in json_by_id else None,
                        severity="MEDIUM",
                        details=f"ID mismatch but name similar (ratio={ratio:.2f}): CSV='{csv_asset.asset_name}' ~ Live='{match_name}'",
                        root_cause="Manual register mismatch. Similar hostname match identified with registry naming drifted.",
                        recommended_action="Correct registry host name identifier parameters directly.",
                        business_impact="Auditor catalog drift, causing naming conflicts and database cross-referencing delays.",
                        estimated_effort="1 Hour",
                        expected_risk_reduction="10% Risk Reduction"
                    )
                    db.add(d)
                    recon.naming_mismatch_count += 1
                else:
                    d = Discrepancy(
                        reconciliation_id=recon.id,
                        discrepancy_type=DiscrepancyType.MISSING_ASSET,
                        csv_asset_id=csv_asset.asset_id,
                        json_asset_id=None,
                        csv_data=csv_asset.raw_data,
                        severity="HIGH",
                        details=f"Asset '{csv_asset.asset_id}' exists in inventory records but not found in live infrastructure",
                        root_cause="Discovery scanner omission. Asset recorded in registry but missing scan ping.",
                        recommended_action="Verify host network route or run discovery ping manually.",
                        business_impact="Critical security scanning gaps. Offline registry assets may cause unmonitored environment leaks.",
                        estimated_effort="2 Hours",
                        expected_risk_reduction="25% Risk Reduction"
                    )
                    db.add(d)
                    recon.missing_assets_count += 1

        # Find untracked assets
        for json_asset in json_assets:
            if json_asset.asset_id not in csv_by_id and json_asset.asset_id not in matched_json_ids:
                d = Discrepancy(
                    reconciliation_id=recon.id,
                    discrepancy_type=DiscrepancyType.UNTRACKED_ASSET,
                    json_asset_id=json_asset.asset_id,
                    csv_asset_id=None,
                    json_data=json_asset.raw_data,
                    severity="MEDIUM",
                    details=f"Asset '{json_asset.asset_id}' found in live infrastructure but not in inventory records",
                    root_cause="Registry catalog sync failure. Server is active but lacks catalog database tag.",
                    recommended_action="Register discovered endpoint into the asset registry directory catalog.",
                    business_impact="Operational and billing compliance risks. Server run lacks cost centers and tracking.",
                    estimated_effort="1 Hour",
                    expected_risk_reduction="15% Risk Reduction"
                )
                db.add(d)
                recon.untracked_assets_count += 1

        recon.status = ReconciliationStatus.COMPLETED
        recon.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(recon)

        # Enforce history limits: Keep latest 5 reconciliations only
        total_recons = db.query(Reconciliation).count()
        if total_recons > 5:
            oldest_recons = (
                db.query(Reconciliation)
                .order_by(Reconciliation.started_at.asc())
                .limit(total_recons - 5)
                .all()
            )
            for old in oldest_recons:
                # Delete discrepancies
                db.query(Discrepancy).filter(Discrepancy.reconciliation_id == old.id).delete()
                # Delete reports and files on disk
                old_reports = db.query(Report).filter(Report.reconciliation_id == old.id).all()
                for rep in old_reports:
                    if rep.file_path and os.path.exists(rep.file_path):
                        try:
                            os.remove(rep.file_path)
                        except Exception:
                            pass
                    db.delete(rep)
                db.delete(old)
            db.commit()

        return recon

    @staticmethod
    def get_reconciliation(db: Session, recon_id: int):
        return db.query(Reconciliation).filter(Reconciliation.id == recon_id).first()

    @staticmethod
    def list_reconciliations(db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(Reconciliation)
            .order_by(Reconciliation.started_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
