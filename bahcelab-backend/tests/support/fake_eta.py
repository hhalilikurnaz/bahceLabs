"""TEST ARACI (ürün kodu değil): sentetik Landsat/ERA5/WaPOR/ECOSTRESS sağlayıcıları — ETa hattı birim/e2e testlerinde gerçek hesapla çalışır, ağ yok."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import numpy as np

from bahcelab_backend.domain.eta import meteo, ssebop
from bahcelab_backend.domain.eta.provider import (
    BaglamNoktasi,
    DogrulamaNoktasi,
    SahneRef,
    TermalSahne,
)

H = W = 60
LAT_YUK = 45.0


def sahte_meteo(bas: date, bit: date) -> meteo.Era5Seri:
    gun = {}
    t = bas
    while t <= bit:
        gun[t] = {"temperature_2m_max": 31.0, "temperature_2m_min": 21.0, "temperature_2m_mean": 26.0, "shortwave_radiation_sum": 26.0, "et0_fao_evapotranspiration": 5.0, "dew_point_2m_mean": 14.0, "precipitation_sum": 0.0}
        t += timedelta(days=1)
    return meteo.Era5Seri(LAT_YUK, gun)


class SahteTermal:
    """Her tarih için ETf hedefi: Ts = Tc + (1 − hedef)·dT; Tc = 1,02·Ta (sahne soğuk referansı Tc'ye eşit → c = 1,02)."""

    kaynak_id = "landsat-ssebop"
    termal_m = 100.0

    def __init__(self, hedefler: dict[date, float], lat: float, gecerli: float = 1.0) -> None:
        self.hedefler, self.lat, self.gecerli = hedefler, lat, gecerli

    def ara(self, geometry: dict[str, Any], bas: date, bit: date) -> list[SahneRef]:
        return [SahneRef(t, f"SAHTE_{t:%Y%m%d}", "landsat-9") for t in sorted(self.hedefler) if bas <= t <= bit]

    def oku(self, ref: SahneRef, geometry: dict[str, Any], *, ic_tampon_m: float, pencere_yari_m: float) -> TermalSahne:
        ta = 31.0 + 273.15
        dt = ssebop.dt_hesapla(ssebop.DtGirdi(26.0, 31.0, 21.0, 26.0, 14.0, ref.tarih.timetuple().tm_yday, self.lat, LAT_YUK), albedo=0.23, rah=110.0, cp=1013.0).dt_k
        tc = 1.02 * ta
        ts = tc + (1 - self.hedefler[ref.tarih]) * dt
        lst = np.full((H, W), tc, dtype="float64")  # bölge: soğuk referans
        ndvi = np.full((H, W), 0.8)
        bahce = np.zeros((H, W), dtype=bool)
        bahce[20:40, 20:40] = True
        ic = np.zeros((H, W), dtype=bool)
        ic[22:38, 22:38] = True
        lst[bahce] = ts
        ndvi[bahce] = 0.65
        gec = np.ones((H, W), dtype=bool)
        if self.gecerli < 1.0:
            gec[bahce] = False
            gec[20:24, 20:40] = True  # bahçenin %20'si geçerli
        return TermalSahne(ref=ref, termal_m=100.0, lst_k=lst, sigma_lst_k=np.full((H, W), 1.0), ndvi=ndvi, gecerli=gec, dem_m=np.full((H, W), LAT_YUK), bahce=bahce, ic=ic, piksel_m=30.0)


class SahteBaglam:
    kaynak_id = "wapor-l1"

    def seri(self, geometry: dict[str, Any], bas: date, bit: date) -> list[BaglamNoktasi]:
        return [BaglamNoktasi(date(2025, 7, 1), date(2025, 7, 10), 2.5, 2, 2, 262.0)]


class SahteDogrulama:
    kaynak_id = "ecostress-v003"

    def seri(self, geometry: dict[str, Any], bas: date, bit: date) -> list[DogrulamaNoktasi]:
        return [DogrulamaNoktasi(date(2025, 7, 12), "ECOv003_TEST", 3.1, 2, 9)]


