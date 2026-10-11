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

    # Hava durumu (Open-Meteo). Ticari kullanımda ücretli plan anahtarı buraya; sağlayıcı değişimi domain/weather/provider.py
    open_meteo_api_key: str | None = None
    weather_timeout_seconds: float = 8.0
    weather_cache_minutes: int = 60
    weather_cell_degrees: float = 0.05
    weather_history_days: int = 800  # bu sezon + geçen sezon (1 Ekim'den) grafikleri için ≈ 2 yıl

    # Bahçe listesi özeti (GET /gardens/overview)
    overview_sparkline_days: int = 30
    overview_weather_max_age_hours: int = 6  # önbellekteki tahmin bundan eskiyse "bayat" işaretlenir
    thumbnail_max_px: int = 160

    # Görüntü arşivi: "net" görüntü = bulut oranı bu yüzdeyi aşmayan geçerli sahne; sayfa boyutları
    archive_net_cloud_max_percent: float = 10.0
    archive_default_page_size: int = 100
    archive_max_page_size: int = 200

    # Bahçe durumu skoru (domain/agro/score.py). Ağırlıklar kullanılabilen bileşenler üzerinden yeniden normalleştirilir.
    score_weight_vigor: float = 0.40  # canlılık (NDVI) – bahçenin kendi normuna göre sapma
    score_weight_water: float = 0.20  # yaprak suyu (NDMI) – aynı mantık
    score_weight_alerts: float = 0.20  # uydu uyarıları
    score_weight_weather: float = 0.20  # hava riskleri (don/sıcak; zararlı riski 8B'de)
    score_good_min: int = 75  # ≥ bu değer: İyi
    score_watch_min: int = 50  # ≥ bu değer: İzle; altı: Dikkat
    score_tolerance_share: float = 0.05  # normdan bu pay (indeks aralığının oranı) kadar sapma kayıpsız sayılır
    score_zero_share: float = 0.30  # bu paydan fazla düşüş 0 puan
    score_alert_points_yellow: int = 50
    score_alert_points_red: int = 0
    score_risk_penalty_per_high: int = 25  # yüksek zararlı/hastalık riski başına hava bileşeninden düşülen puan (etiketi doğrudan düşürmez)
    score_period_half_window_days: int = 15  # "aynı dönem": geçen yılın ±bu kadar günü
    score_period_min_points: int = 3
    score_fallback_window_days: int = 90  # geçmiş yetersizse kendi son günleri
    score_fallback_exclude_days: int = 10  # en son görüntülere yakın günler tabana katılmaz
    score_fallback_min_points: int = 4
    score_fallback_min_span_days: int = 40
    score_stale_image_days: int = 30  # son net görüntü bundan eskiyse skor üretilmez
    score_aging_image_days: int = 14  # bundan eskiyse güven düşer
    agro_prev_season_min_coverage: float = 0.8  # geçen sezon serisi için gerekli gün oranı

    # "Bugün" listesi
    today_max_items: int = 3
    today_priority: tuple[str, ...] = ("hava_uyarisi", "zararli_riski", "ilaclama", "indeks_dususu", "sulama")

    # Zamanlanmış işler (ADR 0009): 'inline' = süreç içi periyodik döngü (geliştirme; Redis gerekmez),
    # 'arq' = Redis + arq işçisi (üretim; `make worker`). Testlerde işler doğrudan (senkron) çağrılır.
    job_backend: str = "inline"
    jobs_enabled: bool = True
    redis_url: str = "redis://localhost:6379/0"
    job_weather_interval_minutes: int = 60
    job_notifications_interval_minutes: int = 60

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
