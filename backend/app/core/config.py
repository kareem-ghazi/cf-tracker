"""Application configuration using Pydantic Settings."""
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    PROJECT_NAME: str = "CF Tracker"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres_password@localhost:5432/cf_tracker"

    # Redis & Background Tasks
    REDIS_URL: str = "redis://localhost:6379/0"

    # Codeforces API Settings
    CF_API_KEY: str = ""
    CF_API_SECRET: str = ""
    CF_RATE_LIMIT_DELAY: float = 2.0  # Minimum seconds between outbound requests

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
