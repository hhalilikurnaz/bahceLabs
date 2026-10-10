from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://bahcelab:bahcelab@localhost:5432/bahcelab"
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    api_debug: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Dosya depolama (NDVI PNG'leri). Yerelde diskte; ileride S3/R2 uygulaması aynı arayüze takılır.
    storage_dir: str = "uploads"

    # NDVI işleme: false ise bahçe kaydında arka plan işi başlatılmaz (testler, ağsız ortam)
    ndvi_enabled: bool = True
    ndvi_months: int = 13
    ndvi_max_parallel_scenes: int = 2
    ndvi_refresh_hours: int = 12

    # Auth — JWT cookie'leri (httpOnly). Üretimde jwt_secret mutlaka değiştirilmeli.
    jwt_secret: str = "dev-insecure-secret-change-me-0123456789"
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    registration_enabled: bool = False
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    @property
    def uses_default_jwt_secret(self) -> bool:
        return self.jwt_secret == "dev-insecure-secret-change-me-0123456789"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
