from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Bağlantı adresleri ve portlar yalnız ortamdan (.env); kodda varsayılan yok
    database_url: str
    api_debug: bool = True
    cors_origins: str = ""

    # Dosya depolama (NDVI PNG'leri). Yerelde diskte; ileride S3/R2 uygulaması aynı arayüze takılır.
    storage_dir: str = "uploads"

    # Veri değiştiren betikler: işlemden önce pg_dump yedeği (docker konteyneri içinden) bu klasöre yazılır
    backup_dir: str = "backups"
    db_container: str = "bahcelab-db"

    # NDVI işleme: false ise bahçe kaydında arka plan işi başlatılmaz (testler, ağsız ortam)
    ndvi_enabled: bool = True
    ndvi_months: int = 13
    ndvi_max_parallel_scenes: int = 2
    ndvi_refresh_hours: int = 12
    # Takılıp çıkarılabilir uydu kaynağı (ADR 0011): domain/imagery/registry.py'deki ad
    imagery_provider: str = "sentinel2-l2a"
    imagery_metadata_timeout_seconds: float = 20.0  # sahne ürün meta verisi (radyometri) okuma zaman aşımı

    # Çok yıllık bölgeler (Adım 9, ADR 0011): yıllık kompozit işleri ve bölgeleme eşikleri. Tarımsal pencere (aylar) kural dosyasındadır.
    multiyear_parallel_years: int = 2  # aynı anda işlenen bahçe×yıl görevi sayısı (tüm bahçeler için ortak)
    multiyear_scene_parallel: int = 4  # bir yıl içinde aynı anda okunan sahne
    multiyear_scene_interval_seconds: float = 0.0  # sahne okumaları arası en az süre (hız sınırı; 0 = sınırsız)
    multiyear_max_scenes_per_year: int = 12  # kompozite en çok bu kadar net sahne girer (okuma bütçesi)
    multiyear_max_candidates: int = 40  # bir yılda en çok bu kadar aday sahne (en az bulutludan) denenir
    multiyear_search_max_cloud: float = 60.0  # sahne bulut oranı (%) bunun üstündeyse aranmaz
    multiyear_min_years: int = 3  # bölgeleme için gereken en az yıl
    multiyear_year_min_correlation: float = 0.5  # yıl, diğer yıllarla bu korelasyonun altındaysa «uyumsuz» işaretlenir
    multiyear_min_year_coverage: float = 0.6
    multiyear_min_pixel_year_share: float = 0.5
    multiyear_smoothing_sigma_px: float = 1.5
    multiyear_min_zone_area_m2: float = 500.0
    multiyear_homogeneous_diff_percent: float = 8.0
    multiyear_stability_high: float = 0.75
    multiyear_stability_mid: float = 0.5
    multiyear_weak_zone_diff_percent: float = 8.0
    multiyear_simplify_m: float = 0.0  # 0 = sadeleştirme yok: bölge çizimi 10 m piksel kenarlarını izler (net piksel ilkesi)
    multiyear_smooth_m: float = 0.0  # 0 = köşe yumuşatma yok
    multiyear_zone_counts: tuple[int, ...] = (3, 5)
    # Veri temeli (ADR 0015): sahne bütçesi ve geçmiş doldurma
    acq_scenes_per_month: int = 2  # ay başına en iyi N net sahne
    acq_min_gap_days: int = 10  # kabul edilen net sahneler arası en az gün
    acq_max_cloud: float = 60.0  # sahne bulut oranı (%) bunun üstündeyse aranmaz
    acq_max_candidates_per_month: int = 8  # bir ayda en çok bu kadar aday sahne okunur
    acq_parallel_months: int = 3  # aynı anda işlenen ay görevi (tüm bahçeler için ortak)
    acq_start: str = "2015-06-01"  # arşiv taraması başlangıcı (Sentinel-2 L2A 13 Ağu 2015'te başlar; ilk aylar boş çıkar)
    acq_radar_start: str = "2015-01-01"  # radar (Sentinel-1 RTC) arşiv taraması başlangıcı; PC arşivi Ekim 2014'te başlar
    acq_auto_backfill: bool = True  # bahçe eklenince / sınırı değişince geçmiş doldurma kendiliğinden başlar (işleme açıksa)
    acq_incremental_days: int = 45  # günlük artımlı çekim bu kadar geriye bakar

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
    score_tolerance_share: float = 0.05  # normdan bu pay (indeks aralığının oranı) kadar sapma kayıpsız sayılır
    score_zero_share: float = 0.30  # bu paydan fazla düşüş 0 puan
    score_alert_points_yellow: int = 50
    score_alert_points_red: int = 0
    score_risk_penalty_per_medium: int = 10  # orta zararlı/hastalık riski başına hava bileşeninden düşülen puan
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
    redis_url: str = ""  # JOB_BACKEND=arq iken zorunlu
    job_weather_interval_minutes: int = 60
    job_notifications_interval_minutes: int = 60
    job_acquisitions_interval_minutes: int = 1440  # günlük artımlı sahne çekimi (arq: her gün job_acquisitions_hour saatinde)
    job_acquisitions_hour: int = 3

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
    return Settings()  # type: ignore[call-arg]  # database_url .env'den gelir
