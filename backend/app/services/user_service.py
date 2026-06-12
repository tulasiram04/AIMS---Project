from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, verify_password
from fastapi import HTTPException, status

from datetime import datetime
from app.schemas.user import UserCreate, UserUpdate

class UserService:
    @staticmethod
    def create_user(db: Session, user_data: UserCreate) -> User:
        if db.query(User).filter(User.username == user_data.username).first():
            raise HTTPException(status_code=400, detail="Username exists")
        if db.query(User).filter(User.email == user_data.email).first():
            raise HTTPException(status_code=400, detail="Email exists")
        user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hash_password(user_data.password),
            role=user_data.role,
            must_change_password=True,
            status="Enabled",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> User:
        user = db.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active or user.status == "Disabled":
            raise HTTPException(status_code=403, detail="User is disabled")
        
        # Track login details
        user.last_login = datetime.utcnow()
        user.total_logins += 1
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_user(db: Session, user_id: int) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    @staticmethod
    def update_user(db: Session, user_id: int, user_data: UserUpdate) -> User:
        user = UserService.get_user(db, user_id)
        if user_data.email and user_data.email != user.email:
            if db.query(User).filter(User.email == user_data.email).first():
                raise HTTPException(status_code=400, detail="Email already taken")
            user.email = user_data.email
        if user_data.full_name is not None:
            user.full_name = user_data.full_name
        if user_data.role is not None:
            user.role = user_data.role
        if user_data.status is not None:
            user.status = user_data.status
            user.is_active = (user_data.status == "Enabled")
        if user_data.is_active is not None:
            user.is_active = user_data.is_active
            user.status = "Enabled" if user_data.is_active else "Disabled"
        if user_data.password:
            user.hashed_password = hash_password(user_data.password)
            user.must_change_password = False
        
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def reset_password(db: Session, user_id: int, new_password: str) -> User:
        user = UserService.get_user(db, user_id)
        user.hashed_password = hash_password(new_password)
        user.must_change_password = True
        db.commit()
        db.refresh(user)
        return user
