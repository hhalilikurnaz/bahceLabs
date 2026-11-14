"""Dilim 0: istasyonlarda (Meteostat gece minimumu) ham ERA5-Land ↔ rakım düzeltmeli ↔ radyatif (arazi) düzeltmeli karşılaştırma.
Yalnız numpy. Girdi: veri_topla.py çıktısı. Çıktı: konsol tablosu + JSON (docs/agro/don-dilim0/).
Yöntem: yalnız açık + sakin gecelerde (ERA5 bulut < %30, rüzgâr < 2 m/s; 00–07 yerel ortalama) arazi terimi uygulanır. Katsayılar istasyon-bırak-biri-dışarıda (LOSO) çapraz doğrulamayla kestirilir."""

from __future__ import annotations

import json
import math
import sys
from datetime import date
from pathlib import Path

import numpy as np

LAPSE = -0.0065  # K/m (standart atmosfer; ICAO)
BULUT_MAX, RUZGAR_MAX = 30.0, 2.0
KIS_AYLARI = {11, 12, 1, 2, 3}


def yukle(klasor: Path) -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted(klasor.glob("*.json"))]


def geceler(st: dict) -> list[dict]:
    """İstasyon günleri: gözlem tmin, ham ERA5-Land tmin, açık+sakin bayrağı."""
    t_land = {}
    for t, v in zip(st["land"]["time"], st["land"]["t2m"], strict=True):
        if v is not None:
            t_land.setdefault(t[:10], []).append((int(t[11:13]), v))
    bulut, ruzgar = {}, {}
    for t, b, w in zip(st["era5"]["time"], st["era5"]["bulut"], st["era5"]["ruzgar"], strict=True):
        h = int(t[11:13])
        if h <= 7 and b is not None and w is not None:
            bulut.setdefault(t[:10], []).append(b)
            ruzgar.setdefault(t[:10], []).append(w)
    out = []
    for gun, obs in st["tmin_obs"].items():
        d = date.fromisoformat(gun)
        if d.month not in KIS_AYLARI or gun not in t_land or len(t_land[gun]) < 22 or gun not in bulut:
            continue
        ham = min(v for _, v in t_land[gun])
        b, w = float(np.mean(bulut[gun])), float(np.mean(ruzgar[gun]))
        out.append({"gun": gun, "obs": obs, "ham": ham, "bulut": b, "ruzgar": w, "acik_sakin": b < BULUT_MAX and w < RUZGAR_MAX})
    return out


def ozellik(p: dict) -> np.ndarray:
    """Arazi öngörücüleri (literatür yönü: TPI<0, birikim↑, SVF↓ → daha soğuk gece): [tpi300, tpi1000, ln(birikim ha), svf]."""
    return np.array([p["tpi300_m"] / 10.0, p["tpi1000_m"] / 50.0, math.log10(p["akis_birikimi_ha"] + 1.0), p["svf"] - 1.0])


def duzelt_rakim(st: dict) -> float:
    """Rakım düzeltmesi (K): Copernicus 30 m ↔ Open-Meteo hücre-noktası yüksekliği farkı × standart gradyan (Open-Meteo zaten kendi DEM'ine ölçekler; artık fark)."""
    om = st.get("om_yukseklik_land")
    return 0.0 if om is None else LAPSE * (st["profil"]["yukseklik_m"] - float(om))


def metrikler(hata: np.ndarray) -> dict[str, float]:
    return {"n": int(len(hata)), "yanlilik": float(np.mean(hata)), "mae": float(np.mean(np.abs(hata))), "rmse": float(math.sqrt(np.mean(hata**2)))}


def don_basarimi(obs: np.ndarray, tahmin: np.ndarray, esik: float) -> dict[str, float]:
    g, t = obs <= esik, tahmin <= esik
    tp, fp, fn = int(np.sum(g & t)), int(np.sum(~g & t)), int(np.sum(g & ~t))
    return {"esik_c": esik, "gozlenen_don": int(g.sum()), "isabet_POD": tp / (tp + fn) if tp + fn else float("nan"), "yanlis_alarm_FAR": fp / (tp + fp) if tp + fp else float("nan")}


def loso(istasyonlar: list[dict]) -> dict:
    veri = {s["id"]: geceler(s) for s in istasyonlar}
    X = {s["id"]: ozellik(s["profil"]) for s in istasyonlar}
    R = {s["id"]: duzelt_rakim(s) for s in istasyonlar}
    kodlar: list[np.ndarray] = []
    obs_all, ham_pred, rak_pred, rad_pred, bias_pred = [], [], [], [], []
    bolge = {s['id']: (s['lat'] < 37.3 and s['lng'] < 37.0) for s in istasyonlar}  # Doğu Akdeniz kıyı/Çukurova bölgesi (hedef bahçelere yakın)
    for sid in veri:
        egit = [(sid2, g) for sid2, gs in veri.items() if sid2 != sid for g in gs if g["acik_sakin"]]
        if len(egit) < 200:
            continue
        A = np.array([[1.0, *X[s2]] for s2, _ in egit])
        y = np.array([g["obs"] - (g["ham"] + R[s2]) for s2, g in egit])
        # sırt (ridge) regresyonu: az sayıda istasyonla aşırı uyumu sınırlar; kesişim cezasız
        lam = 5.0 * len(egit) / 1000.0
        P = np.eye(A.shape[1]) * lam
        P[0, 0] = 0.0
        beta = np.linalg.solve(A.T @ A + P, A.T @ y)
        kodlar.append(beta)
        bias = float(np.mean(y))  # yalnız açık+sakin gece sapması (arazi terimi yok)
        for g in veri[sid]:
            ham = g["ham"]
            rak = ham + R[sid]
            rad = rak + (float(np.r_[1.0, X[sid]] @ beta) if g["acik_sakin"] else 0.0)
            bias_pred.append(ham + (bias if g["acik_sakin"] else 0.0))
            obs_all.append((g["obs"], g["acik_sakin"], sid))
            ham_pred.append(ham)
            rak_pred.append(rak)
            rad_pred.append(rad)
    obs = np.array([o[0] for o in obs_all])
    ak = np.array([o[1] for o in obs_all])
    ham, rak, rad, bia = np.array(ham_pred), np.array(rak_pred), np.array(rad_pred), np.array(bias_pred)
    bolge_m = np.array([bolge[o[2]] for o in obs_all])
    sonuc = {"istasyon_sayisi": len(veri), "gece_sayisi": int(len(obs)), "acik_sakin_gece": int(ak.sum())}
    for ad, mask in (("tum_geceler", np.ones_like(ak)), ("acik_sakin", ak), ("diger", ~ak)):
        sonuc[ad] = {"ham": metrikler((ham - obs)[mask]), "rakim": metrikler((rak - obs)[mask]), "yalniz_sapma": metrikler((bia - obs)[mask]), "radyatif_arazi": metrikler((rad - obs)[mask])}
    for ad, bm in (("bolge_akdeniz_kiyi_acik_sakin", ak & bolge_m), ("bolge_diger_acik_sakin", ak & ~bolge_m)):
        sonuc[ad] = {"istasyon": int(len({o[2] for o, b in zip(obs_all, bm, strict=True) if b})), "ham": metrikler((ham - obs)[bm]), "yalniz_sapma": metrikler((bia - obs)[bm]), "radyatif_arazi": metrikler((rad - obs)[bm])}
    sonuc["don_geceleri"] = {str(e): {"ham": don_basarimi(obs[ak], ham[ak], e), "yalniz_sapma": don_basarimi(obs[ak], bia[ak], e), "radyatif_arazi": don_basarimi(obs[ak], rad[ak], e)} for e in (0.0, 2.0)}
    sonuc["don_geceleri_akdeniz_kiyi"] = {str(e): {"ham": don_basarimi(obs[ak & bolge_m], ham[ak & bolge_m], e), "yalniz_sapma": don_basarimi(obs[ak & bolge_m], bia[ak & bolge_m], e)} for e in (0.0, 2.0)}
    B = np.array(kodlar)
    sonuc["katsayi_ort"] = dict(zip(("kesisim_K", "tpi300_10m", "tpi1000_50m", "log10_birikim_ha", "svf_eksi1"), (float(x) for x in B.mean(axis=0)), strict=True))
    sonuc["katsayi_std"] = dict(zip(("kesisim_K", "tpi300_10m", "tpi1000_50m", "log10_birikim_ha", "svf_eksi1"), (float(x) for x in B.std(axis=0)), strict=True))
    return sonuc


if __name__ == "__main__":
    ist = yukle(Path(sys.argv[1]))
    print(json.dumps(loso(ist), indent=1, ensure_ascii=False))
