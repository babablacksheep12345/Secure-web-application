import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url: str) -> str:
    """Render/Heroku provide postgres:// but SQLAlchemy requires postgresql://."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    SQLALCHEMY_DATABASE_URI = _normalize_database_url(
        os.getenv("DATABASE_URL", "sqlite:///secure_app.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    IS_PRODUCTION = os.getenv("FLASK_ENV") == "production" or os.getenv("RENDER") == "true"

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    WTF_CSRF_ENABLED = True
    SESSION_COOKIE_SECURE = IS_PRODUCTION
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

    FERNET_KEY = os.getenv("FERNET_KEY", "")

    RATELIMIT_DEFAULT = "200 per day;50 per hour"
    RATELIMIT_STORAGE_URI = "memory://"
