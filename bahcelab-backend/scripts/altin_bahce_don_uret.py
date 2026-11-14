"""ALTIN BAHÇE don girdisi (ADIM 10): jlnnlk çevresi Copernicus DEM (3 km, 30 m UTM, desimetre int16) + Şubat 2025 geceleri için 3 modelin SAATLİK tahmini (Open-Meteo historical-forecast; gerçek veri).
Çıktı: tests/golden/jlnnlk_don_girdi.json.gz (test sürümlenir; ağsız çalışır). Yalnız okur/indirir."""

import gzip
import json
from pathlib import Path

import httpx
import numpy as np

from bahcelab_backend.domain.don import topografya

CIKTI = Path(__file__).resolve().parents[1] / "tests" / "golden" / "jlnnlk_don_girdi.json.gz"
LAT, LNG = 36.66392, 34.38001
MODELLER = ["ecmwf_ifs025", "icon_seamless", "gfs_seamless"]


def main() -> None:
    p = topografya.dem_penceresi(LAT, LNG, 3.0)
    h = httpx.get("https://historical-forecast-api.open-meteo.com/v1/forecast", params={"latitude": LAT, "longitude": LNG, "start_date": "2025-02-20", "end_date": "2025-02-27", "hourly": "temperature_2m,cloud_cover,wind_speed_10m", "models": ",".join(MODELLER), "timezone": "auto", "wind_speed_unit": "ms"}, timeout=120)
    h.raise_for_status()
    j = h.json()
    hr = j["hourly"]
    veri = {
        "dem": {"x0": p.x0, "y0": p.y0, "epsg": p.epsg, "satir": int(p.z.shape[0]), "sutun": int(p.z.shape[1]), "z_dm": np.rint(p.z * 10).astype(int).ravel().tolist()},
        "tahmin": {"elevation": j["elevation"], "zaman": hr["time"], "modeller": {m: {"t2m": hr[f"temperature_2m_{m}"], "bulut": hr[f"cloud_cover_{m}"], "ruzgar": hr[f"wind_speed_10m_{m}"]} for m in MODELLER}},
        "kaynak": "Copernicus DEM GLO-30 (AWS Open Data); Open-Meteo historical-forecast (ecmwf_ifs025, icon_seamless, gfs_seamless)",
    }
    CIKTI.write_bytes(gzip.compress(json.dumps(veri, separators=(",", ":")).encode(), mtime=0))
    print(CIKTI, CIKTI.stat().st_size)


if __name__ == "__main__":
    main()
