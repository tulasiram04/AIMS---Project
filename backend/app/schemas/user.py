from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
    role: str = "Viewer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login: Optional[str] = None
    total_logins: int = 0
    must_change_password: bool = True
    status: str = "Enabled"
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if hasattr(obj, "created_at"):
            data = {
                "id": obj.id,
                "username": obj.username,
                "email": obj.email,
                "full_name": obj.full_name,
                "role": obj.role.value if hasattr(obj.role, "value") else str(obj.role),
                "is_active": obj.is_active,
                "last_login": obj.last_login.isoformat() if hasattr(obj, "last_login") and obj.last_login else None,
                "total_logins": getattr(obj, "total_logins", 0),
                "must_change_password": getattr(obj, "must_change_password", True),
                "status": getattr(obj, "status", "Enabled"),
                "created_at": obj.created_at.isoformat() if isinstance(obj.created_at, datetime) else str(obj.created_at) if obj.created_at else None,
            }
            return cls(**data)
        return super().model_validate(obj, **kwargs)


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    password: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    new_password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
