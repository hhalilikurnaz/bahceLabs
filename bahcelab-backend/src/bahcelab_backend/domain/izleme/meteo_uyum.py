"""ERA5 ↔ Meteostat Tmax sapması: Meteostat bulk gözlemi gecikmeli yayımlanır (≈ 8 ay); pencere = EN SON `n` gözlemli gün (ağ gerektirir; haftalık iş)."""

from __future__ import annotations

from datetime import timedelta

from bahcelab_backend.domain.eta import meteo
from bahcelab_backend.shared.clock import bugun


def son_sapmalar(lat: float, lon: float, min_gun: int, istasyon: str = "17340", pencere_gun: int = 90) -> list[float]:
    """Son `pencere_gun` gözlem gününde (gözlem − ERA5) Tmax farkları (°C), istasyon koordinatında ERA5 ile. Eşleşme `min_gun` altındaysa boş."""
    obs = meteo.meteostat_gunluk(istasyon)
    gunler = sorted(t for t, v in obs.items() if v.get("tmax") is not None)
    if not gunler:
        return []
    son = gunler[-1]
    bas = son - timedelta(days=pencere_gun)
    e = meteo.era5_gunluk(lat, lon, bas, min(son, bugun() - timedelta(days=6)))
    fark = [float(o) - float(m) for t, v in e.gun.items() if t in obs and (o := obs[t].get("tmax")) is not None and (m := v.get("temperature_2m_max")) is not None]
    return fark if len(fark) >= min_gun else []
