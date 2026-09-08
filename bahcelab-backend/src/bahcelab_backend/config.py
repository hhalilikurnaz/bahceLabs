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
    require_workspace_header: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
