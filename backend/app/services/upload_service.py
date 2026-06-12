import json
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
from app.models.inventory import InventoryUpload, Asset
from app.models.user import User
import pandas as pd
import io

class UploadService:
    @staticmethod
    async def validate_csv_file(file: UploadFile) -> bool:
        if not file.filename.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files allowed")
        return True

    @staticmethod
    async def validate_json_file(file: UploadFile) -> bool:
        if not file.filename.endswith(".json"):
            raise HTTPException(status_code=400, detail="Only JSON files allowed")
        return True

    @staticmethod
    async def parse_csv_file(file: UploadFile):
        try:
            content = await file.read()
            df = pd.read_csv(io.BytesIO(content))
            records = df.to_dict(orient="records")
            return records, len(records)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {str(e)}")

    @staticmethod
    async def parse_json_file(file: UploadFile):
        try:
            content = await file.read()
            data = json.loads(content)
            records = data if isinstance(data, list) else [data]
            return records, len(records)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    @staticmethod
    async def upload_inventory_csv(db: Session, file: UploadFile, user: User):
        await UploadService.validate_csv_file(file)
        records, total = await UploadService.parse_csv_file(file)
        if not records:
            raise HTTPException(status_code=400, detail="CSV empty")
        
        upload = InventoryUpload(filename=file.filename, upload_type="csv", uploaded_by_id=user.id, total_records=total)
        db.add(upload)
        db.commit()
        db.refresh(upload)
        
        for record in records:
            asset = Asset(
                source_upload_id=upload.id,
                asset_id=str(record.get("asset_id", record.get("id", ""))),
                asset_name=str(record.get("asset_name", record.get("name", ""))),
                asset_type=str(record.get("asset_type", record.get("type", ""))),
                location=str(record.get("location", "")),
                status=str(record.get("status", "")),
                configuration=record,
                raw_data=record
            )
            db.add(asset)
        db.commit()
        return upload

    @staticmethod
    async def upload_live_inventory_json(db: Session, file: UploadFile, user: User):
        await UploadService.validate_json_file(file)
        records, total = await UploadService.parse_json_file(file)
        if not records:
            raise HTTPException(status_code=400, detail="JSON empty")
        
        upload = InventoryUpload(filename=file.filename, upload_type="json", uploaded_by_id=user.id, total_records=total)
        db.add(upload)
        db.commit()
        db.refresh(upload)
        
        for record in records:
            asset = Asset(
                source_upload_id=upload.id,
                asset_id=str(record.get("asset_id", record.get("id", ""))),
                asset_name=str(record.get("asset_name", record.get("name", ""))),
                asset_type=str(record.get("asset_type", record.get("type", ""))),
                location=str(record.get("location", "")),
                status=str(record.get("status", "")),
                configuration=record,
                raw_data=record
            )
            db.add(asset)
        db.commit()
        return upload
