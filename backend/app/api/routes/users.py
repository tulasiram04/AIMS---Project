from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, check_role
from app.schemas.user import UserCreate, UserResponse, UserUpdate, PasswordChangeRequest
from app.services.user_service import UserService
from app.services.audit_service import AuditService
from app.models.audit import AuditActionType
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    user = UserService.create_user(db, user_data)
    AuditService.log_action(
        db, current_user, AuditActionType.USER_CREATED, f"Username: {user.username}"
    )
    return UserResponse.model_validate(user)


@router.get("/")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    search: str = Query(None),
    role: str = Query(None),
    status_filter: str = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    query = db.query(User)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.like(search_term)) |
            (User.email.like(search_term)) |
            (User.full_name.like(search_term))
        )
    if role:
        query = query.filter(User.role == role)
    if status_filter:
        query = query.filter(User.status == status_filter)
        
    total = query.count()
    users = query.offset((page - 1) * limit).limit(limit).all()
    
    return {
        "users": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    user = UserService.get_user(db, user_id)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    user = UserService.update_user(db, user_id, user_data)
    AuditService.log_action(
        db, current_user, AuditActionType.USER_UPDATED, f"Updated profile for: {user.username}"
    )
    return UserResponse.model_validate(user)


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def admin_reset_password(
    user_id: int,
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    user = UserService.reset_password(db, user_id, req.new_password)
    AuditService.log_action(
        db, current_user, AuditActionType.PASSWORD_RESET, f"Admin reset password for: {user.username}"
    )
    return UserResponse.model_validate(user)


@router.post("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    status_val = payload.get("status", "Enabled")
    is_active_val = (status_val == "Enabled")
    user = UserService.update_user(db, user_id, UserUpdate(status=status_val, is_active=is_active_val))
    AuditService.log_action(
        db, current_user, AuditActionType.STATUS_CHANGE, f"Status of {user.username} set to {status_val}"
    )
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role(["Administrator"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    username = user.username
    db.delete(user)
    db.commit()
    AuditService.log_action(
        db, current_user, AuditActionType.USER_DELETED, f"Deleted: {username}"
    )
    return {"message": f"User '{username}' deleted"}
