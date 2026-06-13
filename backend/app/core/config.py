from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Inventory Reconciliation System"
    DEBUG: bool = False
    DATABASE_URL: str
    SQLALCHEMY_ECHO: bool = False
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    GEMINI_API_KEY: str = ""
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # Super Admin credentials
    SUPER_ADMIN_USERNAME: str = "superadmin"
    SUPER_ADMIN_PASSWORD: str = ""
    SUPER_ADMIN_EMAIL: str = "superadmin@aims.internal"
    SUPER_ADMIN_FULL_NAME: str = "Super Administrator"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
