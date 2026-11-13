"""Uydudan ETa altyapısı servisi (iç kalite; ADR 0028). İKİ AŞAMA:

  A) `olc`   — ağ/IO: ERA5 + Meteostat sapması, Landsat sahne okuma → `eta_meteo`, `eta_sahneler` (ham ölçümler), kalibrasyon girdileri.
  B) `hesapla` — yalnız veritabanı: uzun dönem c-faktörü, Tc = c·Ta, ETf, ETa, belirsizlik, tutarlılık kapısı → `eta_sahneler`, `eta_kalibrasyon`, `eta_durum`.

B ağ gerektirmez; eşik/katsayı değişince yeniden koşturulur. Sonuç HİÇBİR kullanıcı uç noktasından dönmez (yalnız iç kalite).
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import numpy as np
from sqlalchemy import delete, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import EtaIcKurali, load_catalog
from bahcelab_backend.domain.eta import kalibrasyon as kal
from bahcelab_backend.domain.eta import meteo, ssebop
from bahcelab_backend.domain.eta.baglam import EcostressDogrulamaSaglayici, WaporL1BaglamSaglayici
from bahcelab_backend.domain.eta.landsat import LandsatTermalSaglayici
from bahcelab_backend.domain.eta.models import (
    EtaBaglamModel,
    EtaDogrulamaModel,
    EtaDurumModel,
    EtaKalibrasyonModel,
    EtaMeteoModel,
    EtaSahneModel,
)
from bahcelab_backend.domain.eta.provider import (
    BaglamSaglayici,
    DogrulamaSaglayici,
    TermalSahne,
    TermalSahneSaglayici,
)
from bahcelab_backend.shared.clock import bugun

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Ozet:
    sahne_aranan: int
    sahne_yazilan: int
    elenen: int
    hesaplanan: int
    kapi: str
    neden: str


def _ort(a: np.ndarray, m: np.ndarray) -> float | None:
    v = a[m & np.isfinite(a)]
    return float(v.mean()) if v.size else None


def sahne_olcumu(s: TermalSahne, kural: EtaIcKurali) -> dict[str, Any]:
    """Tek sahne için ham ölçümler (saf; sentetik raster ile testli). Soğuk referans: yoğun yeşil, bahçeyle ±rakım toleransı içinde, bahçe dışı."""
    gec = s.gecerli
    n_bahce = int(s.bahce.sum())
    n_gec = int((gec & s.bahce).sum())
    n_ic = int(s.ic.sum())
    dem_b = _ort(s.dem_m.astype("float64"), s.bahce)
    out: dict[str, Any] = {
        "bahce_piksel": n_bahce,
        "gecerli_piksel": n_gec,
        "ic_piksel": n_ic,
        "gecerli_oran": (n_gec / n_bahce) if n_bahce else 0.0,
        "karisik_pay": ssebop_karisik(s),
        "lst_k": _ort(s.lst_k, gec & s.bahce),
        "lst_ic_k": _ort(s.lst_k, gec & s.ic),
        "ndvi": _ort(s.ndvi, gec & s.bahce),
        "sigma_lst_k": None if s.sigma_lst_k is None else _ort(s.sigma_lst_k, gec & s.bahce),
        "dem_m": dem_b,
        "tc_soguk_k": None,
        "n_soguk": 0,
    }
    if dem_b is not None:
        soguk = gec & (s.ndvi >= kural.soguk_ndvi_min) & np.isfinite(s.dem_m) & (np.abs(s.dem_m - dem_b) <= kural.soguk_rakim_tolerans_m) & ~s.bahce
        out["n_soguk"] = int(soguk.sum())
        if out["n_soguk"] >= kural.soguk_min_piksel:
            out["tc_soguk_k"] = float(np.median(s.lst_k[soguk]))
    return out


def ssebop_karisik(s: TermalSahne) -> float:
    """Karışık (kenar) piksel payı = 1 − iç tampon / tüm bahçe pikseli."""
    return 1.0 - ssebop.ic_tampon_maske_orani(s.ic, s.bahce)


class EtaService:
    def __init__(self, session: AsyncSession, *, termal: TermalSahneSaglayici | None = None, baglam: BaglamSaglayici | None = None, dogrulama: DogrulamaSaglayici | None = None, kural: EtaIcKurali | None = None) -> None:
        self.session = session
        self.termal = termal or LandsatTermalSaglayici()
        self.baglam = baglam or WaporL1BaglamSaglayici()
        self.dogrulama = dogrulama or EcostressDogrulamaSaglayici()
        self.kural = kural or load_catalog().eta_ic

    async def _bahce(self, garden_id: uuid.UUID) -> tuple[dict[str, Any], float, float, float]:
        r = (await self.session.execute(text("SELECT ST_AsGeoJSON(geom), alan_dekar, ST_Y(ST_Centroid(geom)), ST_X(ST_Centroid(geom)) FROM gardens WHERE id = :g"), {"g": garden_id})).one()
        return json.loads(r[0]), float(r[1]), float(r[2]), float(r[3])

    # ------------------------------------------------------------------ A) ölçüm
    async def olc(self, garden_id: uuid.UUID, bas: date, bit: date) -> tuple[int, int]:
        geo, _alan, lat, lon = await self._bahce(garden_id)
        k = self.kural
        # 1) ERA5 (Open-Meteo) + Meteostat sapması
        era = await asyncio.to_thread(meteo.era5_gunluk, lat, lon, bas - timedelta(days=1), min(bit, bugun() - timedelta(days=6)))
        await self.session.execute(delete(EtaMeteoModel).where(EtaMeteoModel.garden_id == garden_id))
        for t, v in era.gun.items():
            await self.session.execute(insert(EtaMeteoModel).values(garden_id=garden_id, tarih=t, rs_mj=v["shortwave_radiation_sum"], tmax_c=v["temperature_2m_max"], tmin_c=v["temperature_2m_min"], tmean_c=v["temperature_2m_mean"], cig_c=v["dew_point_2m_mean"], et0_mm=v["et0_fao_evapotranspiration"], yagis_mm=v["precipitation_sum"]))
        await self._ta_sapma(garden_id, bas, bit, k)
        await self._kal_yaz(garden_id, "era5_yuk", "00", era.yukseklik_m, None, 1)
        # 2) sahneler (aynı gün birden çok kare: bahçeyi en çok geçerli kapsayan)
        refs = await asyncio.to_thread(self.termal.ara, geo, bas, bit)
        en_iyi: dict[date, tuple[float, Any, dict[str, Any]]] = {}
        sem = asyncio.Semaphore(6)  # IO bağlı: aynı anda 6 sahne

        async def oku(ref: Any) -> tuple[Any, dict[str, Any] | None]:
            async with sem:
                try:
                    s = await asyncio.to_thread(self.termal.oku, ref, geo, ic_tampon_m=k.ic_tampon_m, pencere_yari_m=k.pencere_yari_m)
                except Exception as e:  # noqa: BLE001 - bozuk sahne diğerlerini engellemesin
                    logger.warning("ETa sahnesi okunamadı (%s): %s", ref.sahne_id, str(e)[:120])
                    return ref, None
                o = sahne_olcumu(s, k)
                o.update(sahne_id=ref.sahne_id, platform=ref.platform.replace("landsat-", "L"), termal_m=s.termal_m)
                return ref, o

        for ref, o in await asyncio.gather(*(oku(r) for r in refs)):
            if o is None:
                continue
            if ref.tarih not in en_iyi or o["gecerli_oran"] > en_iyi[ref.tarih][0]:
                en_iyi[ref.tarih] = (o["gecerli_oran"], ref, o)
        for t, (_, ref, o) in sorted(en_iyi.items()):
            vals = {**o, "garden_id": garden_id, "tarih": t, "kaynak": self.termal.kaynak_id, "durum": "ham", "neden": None}
            await self.session.execute(delete(EtaSahneModel).where(EtaSahneModel.garden_id == garden_id, EtaSahneModel.tarih == t, EtaSahneModel.kaynak == self.termal.kaynak_id))
            await self.session.execute(insert(EtaSahneModel).values(**vals))
        # 3) bağlam (WaPOR L1) + doğrulama (ECOSTRESS V003)
        await self._bagla(garden_id, geo, bas, bit)
        await self.session.flush()
        return len(refs), len(en_iyi)

    async def _ta_sapma(self, garden_id: uuid.UUID, bas: date, bit: date, k: EtaIcKurali) -> None:
        """ERA5 Tmax ↔ Meteostat 17340 aylık sapma: istasyon KOORDİNATINDA ERA5 (Open-Meteo) ile gözlem karşılaştırılır; yeterli eşleşme yoksa ay yazılmaz."""
        st = (await self.session.execute(text("SELECT lat, lng FROM stations WHERE id = :i AND saglayici = 'meteostat'"), {"i": k.ta_istasyon})).first()
        await self.session.execute(delete(EtaKalibrasyonModel).where(EtaKalibrasyonModel.garden_id == garden_id, EtaKalibrasyonModel.tur == "ta_sapma"))
        if st is None:
            logger.warning("ETa: Meteostat istasyonu %s veritabanında yok; sıcaklık sapması ölçülemedi.", k.ta_istasyon)
            return
        obs = await asyncio.to_thread(meteo.meteostat_gunluk, k.ta_istasyon)
        son = max(obs) if obs else bas
        e = await asyncio.to_thread(meteo.era5_gunluk, float(st[0]), float(st[1]), min(bas, son) - timedelta(days=366), min(son, bugun() - timedelta(days=6)))
        sap = meteo.aylik_ta_sapma({t: v["temperature_2m_max"] for t, v in e.gun.items()}, {t: v["tmax"] for t, v in obs.items()}, k.ta_sapma_min_gun)
        for ay, (ort, std, n) in sap.items():
            await self._kal_yaz(garden_id, "ta_sapma", f"{ay:02d}", ort, std, n)

    async def _kal_yaz(self, garden_id: uuid.UUID, tur: str, anahtar: str, deger: float | None, yayilim: float | None, n: int) -> None:
        await self.session.execute(delete(EtaKalibrasyonModel).where(EtaKalibrasyonModel.garden_id == garden_id, EtaKalibrasyonModel.tur == tur, EtaKalibrasyonModel.anahtar == anahtar))
        await self.session.execute(insert(EtaKalibrasyonModel).values(garden_id=garden_id, tur=tur, anahtar=anahtar, deger=deger, yayilim=yayilim, n=n))

    async def _bagla(self, garden_id: uuid.UUID, geo: dict[str, Any], bas: date, bit: date) -> None:
        await self.session.execute(delete(EtaBaglamModel).where(EtaBaglamModel.garden_id == garden_id))
        for p in await asyncio.to_thread(self.baglam.seri, geo, bas, bit):
            await self.session.execute(insert(EtaBaglamModel).values(garden_id=garden_id, kaynak=self.baglam.kaynak_id, bas=p.bas, bit=p.bit, et_mm_gun=p.et_mm_gun, piksel_dokunan=p.piksel_dokunan, piksel_gecerli=p.piksel_gecerli, piksel_m=p.piksel_m))
        await self.session.execute(delete(EtaDogrulamaModel).where(EtaDogrulamaModel.garden_id == garden_id))
        try:
            noktalar = await asyncio.to_thread(self.dogrulama.seri, geo, bas, bit)
        except Exception as e:  # noqa: BLE001 - ECOSTRESS yoksa/erişilemezse ana akış sürer
            logger.warning("ECOSTRESS doğrulama serisi alınamadı: %s", str(e)[:120])
            noktalar = []
        for q in noktalar:
            await self.session.execute(insert(EtaDogrulamaModel).values(garden_id=garden_id, kaynak=self.dogrulama.kaynak_id, sahne_id=q.sahne_id, tarih=q.tarih, et_mm_gun=q.et_mm_gun, piksel_gecerli=q.piksel_gecerli, piksel_dokunan=q.piksel_dokunan))

    # ------------------------------------------------------------------ B) hesap (yalnız veritabanı)
    async def hesapla(self, garden_id: uuid.UUID) -> Ozet:
        k = self.kural
        _geo, alan, lat, _lon = await self._bahce(garden_id)
        rows = (await self.session.execute(text("SELECT * FROM eta_sahneler WHERE garden_id = :g AND kaynak = :k ORDER BY tarih"), {"g": garden_id, "k": self.termal.kaynak_id})).mappings().all()
        met = {r["tarih"]: r for r in (await self.session.execute(text("SELECT * FROM eta_meteo WHERE garden_id = :g"), {"g": garden_id})).mappings().all()}
        kalr = (await self.session.execute(text("SELECT tur, anahtar, deger, yayilim, n FROM eta_kalibrasyon WHERE garden_id = :g"), {"g": garden_id})).mappings().all()
        sapma = {int(r["anahtar"]): float(r["deger"]) for r in kalr if r["tur"] == "ta_sapma" and r["deger"] is not None}
        era_yuk = next((float(r["deger"]) for r in kalr if r["tur"] == "era5_yuk"), 0.0)
        # 1) sahne başına ta, dT, c_sahne
        on: dict[date, dict[str, Any]] = {}
        elenen = 0
        for r in rows:
            t = r["tarih"]
            m = met.get(t)
            neden = None
            if r["gecerli_oran"] < k.min_bahce_gecerli_oran:
                neden = f"bahçe geçerli piksel oranı %{r['gecerli_oran'] * 100:.0f} < %{k.min_bahce_gecerli_oran * 100:.0f} (bulut/maske)"
            elif m is None or m["rs_mj"] is None or m["tmax_c"] is None or m["et0_mm"] is None:
                neden = "ERA5 günlük girdisi yok"
                m = None
            elif r["tc_soguk_k"] is None:
                neden = f"soğuk referans piksel yetersiz ({r['n_soguk']} < {k.soguk_min_piksel})"
            elif r["lst_k"] is None:
                neden = "bahçe LST yok"
            if neden:
                on[t] = {"durum": "elendi", "neden": neden}
                elenen += 1
                continue
            assert m is not None  # neden boşsa ERA5 girdisi var
            dem = float(r["dem_m"]) if r["dem_m"] is not None else era_yuk
            ta_ham = float(m["tmax_c"]) + 273.15
            ta_duz = ssebop.ta_rakim_duzelt(ta_ham + sapma.get(t.month, 0.0), dem, era_yuk, k.lapse_k_km)
            dt = ssebop.dt_hesapla(ssebop.DtGirdi(float(m["rs_mj"]), float(m["tmax_c"]), float(m["tmin_c"] if m["tmin_c"] is not None else m["tmax_c"] - 8), float(m["tmean_c"] if m["tmean_c"] is not None else m["tmax_c"] - 3), float(m["cig_c"] if m["cig_c"] is not None else m["tmax_c"] - 12), t.timetuple().tm_yday, lat, dem), albedo=k.albedo_sicak, rah=k.rah_s_m, cp=k.cp_j_kg_k)
            on[t] = {"durum": "hesaplandi", "ta_ham_k": ta_ham, "ta_duz_k": ta_duz, "dt_k": dt.dt_k, "c_sahne": ssebop.c_faktoru(float(r["tc_soguk_k"]), ta_duz), "et0_mm": float(m["et0_mm"])}
        # 2) uzun dönem c (mevsim penceresi) → tc → etf
        c_sahne = {t: v["c_sahne"] for t, v in on.items() if v["durum"] == "hesaplandi"}
        await self.session.execute(delete(EtaKalibrasyonModel).where(EtaKalibrasyonModel.garden_id == garden_id, EtaKalibrasyonModel.tur == "c_faktoru"))
        cay: dict[int, kal.CSonuc | None] = {}
        for ay in range(1, 13):
            cay[ay] = kal.uzun_donem_c(c_sahne, ay, k.c_mevsim_pencere_ay, k.c_min_sahne)
            if cay[ay] is not None:
                await self._kal_yaz(garden_id, "c_faktoru", f"{ay:02d}", cay[ay].deger, cay[ay].yayilim, cay[ay].n)  # type: ignore[union-attr]
        etf_gun: dict[date, float] = {}
        hesaplanan = 0
        for r in rows:
            t = r["tarih"]
            v = on[t]
            upd: dict[str, Any] = {"durum": v["durum"], "neden": v.get("neden")}
            if v["durum"] == "hesaplandi":
                c = cay.get(t.month)
                if c is None:
                    upd.update(durum="elendi", neden=f"uzun dönem c-faktörü yok (ay {t.month}: sahne < {k.c_min_sahne})")
                    elenen += 1
                else:
                    tc = ssebop.tc_hesapla(c.deger, v["ta_duz_k"])
                    etf = float(ssebop.etf_hesapla(float(r["lst_k"]), tc, v["dt_k"], k.etf_ust)[()])
                    if not np.isfinite(etf):
                        upd.update(durum="elendi", neden=f"dT ≤ 0,5 K ({v['dt_k']:.2f}): ETf tanımsız")
                        elenen += 1
                    else:
                        etf_ic = float(ssebop.etf_hesapla(float(r["lst_ic_k"]), tc, v["dt_k"], k.etf_ust)[()]) if r["lst_ic_k"] is not None else None
                        sig = ssebop.etf_belirsizlik(float(r["sigma_lst_k"] or 0.0), c.yayilim * v["ta_duz_k"], v["dt_k"])
                        upd.update(ta_ham_k=v["ta_ham_k"], ta_duz_k=v["ta_duz_k"], dt_k=v["dt_k"], c_sahne=v["c_sahne"], c_uzun=c.deger, c_yayilim=c.yayilim, tc_k=tc, etf=etf, etf_ic=etf_ic, etf_sigma=sig, et0_mm=v["et0_mm"], eta_mm=etf * v["et0_mm"])
                        etf_gun[t] = etf
                        hesaplanan += 1
            await self.session.execute(text("UPDATE eta_sahneler SET " + ", ".join(f"{a} = :{a}" for a in upd) + ", guncelleme = now() WHERE garden_id = :g AND tarih = :t AND kaynak = :k AND sahne_id = :s"), {**upd, "g": garden_id, "t": t, "k": self.termal.kaynak_id, "s": r["sahne_id"]})
        # 3) tutarlılık kapısı
        yag = {t: float(m["yagis_mm"] or 0.0) for t, m in met.items()}
        tut = kal.tutarlilik(etf_gun, yag, esik=k.tutarlilik_esik, max_gun=k.tutarlilik_max_gun_arasi, min_cift=k.tutarlilik_min_cift, yagis_esik_mm=k.tutarlilik_yagis_mm, aylar=k.tutarlilik_mevsim_aylari)
        alan_ok = alan >= k.kullanici_min_alan_dekar
        kapi = "acik" if (tut.kapi_acik and alan_ok) else "kapali"
        neden = tut.neden + ("" if alan_ok else f" · bahçe {alan:.1f} da < kullanıcıya açılma alt sınırı {k.kullanici_min_alan_dekar:.0f} da")
        await self.session.execute(delete(EtaDurumModel).where(EtaDurumModel.garden_id == garden_id))
        await self.session.execute(insert(EtaDurumModel).values(garden_id=garden_id, tutarlilik_p90=tut.p90, tutarlilik_medyan=tut.medyan, cift_sayisi=tut.cift, esik=k.tutarlilik_esik, kapi=kapi, neden=neden, alan_dekar=alan, sahne_sayisi=len(rows)))
        await self.session.flush()
        return Ozet(len(rows), len(rows), elenen, hesaplanan, kapi, neden)

