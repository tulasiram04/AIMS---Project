from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.schemas.user import LoginRequest, LoginResponse, UserResponse
from app.services.user_service import UserService
from app.services.audit_service import AuditService
from app.models.audit import AuditActionType
from app.models.user import User

from app.schemas.user import LoginRequest, LoginResponse, UserResponse, PasswordChangeRequest, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = UserService.authenticate_user(db, request.username, request.password)
    # Exclude login logging as per Governance Activity Tracker rules
    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


@router.post("/change-password", response_model=UserResponse)
async def change_password(
    request: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = UserService.update_user(db, current_user.id, UserUpdate(password=request.new_password))
    AuditService.log_action(
        db, current_user, AuditActionType.PASSWORD_RESET, f"User changed own password: {user.username}"
    )
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
