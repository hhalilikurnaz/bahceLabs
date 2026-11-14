"""Dilim 1 · adım 1: gece minimumu TAHMİN başarımı. Open-Meteo previous-runs (1–3 gün önceki koşular) ↔ Meteostat ölçüm kaynaklı tmin, son 2 kış (Kas–Mar 2023-24, 2024-25).
Kullanım:  python -u -m scripts.don_dilim0.tahmin_basarim topla <istasyon-klasörü> <çıktı-klasörü>   |   ... degerlendir <istasyon-klasörü> <tahmin-klasörü>"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path

import httpx
import numpy as np

URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
MODELLER = ["best_match", "ecmwf_ifs025", "icon_seamless", "gfs_seamless"]
BAS, BIT = "2023-11-01", "2025-03-31"
DEGISKEN = "temperature_2m_previous_day1,temperature_2m_previous_day2,temperature_2m_previous_day3"
KIS = {11, 12, 1, 2, 3}
KIYI = lambda s: s["lat"] < 37.3 and s["lng"] < 37.0  # noqa: E731  Akdeniz kıyı şeridi (don-dogrulama.md §2)


def topla(ist_klasor: Path, cikti: Path) -> None:
    cikti.mkdir(parents=True, exist_ok=True)
    for p in sorted(ist_klasor.glob("*.json")):
        s = json.loads(p.read_text())
        for m in (os.environ.get("DON_MODEL") or ",".join(MODELLER)).split(","):
            dosya = cikti / f"{s['id']}_{m}.json"
            if dosya.exists():
                continue
            for deneme in range(5):
                try:
                    r = httpx.get(URL, params={"latitude": s["lat"], "longitude": s["lng"], "start_date": BAS, "end_date": BIT, "hourly": DEGISKEN, "models": m, "timezone": "auto"}, timeout=240)
                except httpx.TransportError:  # geçici ağ hatası: bekle, yeniden dene
                    time.sleep(10 * (deneme + 1))
                    continue
                if r.status_code == 429 or r.status_code >= 500:
                    time.sleep(30 * (deneme + 1))
                    continue
                r.raise_for_status()
                dosya.write_text(json.dumps(r.json()["hourly"]))
                break
            print("tamam" if dosya.exists() else "ATLANDI", s["id"], s["ad"], m, flush=True)
            time.sleep(1.0)


def topla_bulut(ist_klasor: Path, cikti: Path) -> None:
    """Uyarı kuralı C için: 1 gün önceki koşunun bulut örtüsü (%) ve 10 m rüzgârı (m/s), model başına (DON_MODEL ile bölünebilir)."""
    cikti.mkdir(parents=True, exist_ok=True)
    for p in sorted(ist_klasor.glob("*.json")):
        s = json.loads(p.read_text())
        for m in (os.environ.get("DON_MODEL") or ",".join(MODELLER[1:])).split(","):
            dosya = cikti / f"{s['id']}_{m}_bw.json"
            if dosya.exists():
                continue
            for deneme in range(6):
                try:
                    r = httpx.get(URL, params={"latitude": s["lat"], "longitude": s["lng"], "start_date": BAS, "end_date": BIT, "hourly": "cloud_cover_previous_day1,wind_speed_10m_previous_day1", "models": m, "timezone": "auto", "wind_speed_unit": "ms"}, timeout=240)
                except httpx.TransportError:
                    time.sleep(10 * (deneme + 1))
                    continue
                if r.status_code == 429 or r.status_code >= 500:
                    time.sleep(30 * (deneme + 1))
                    continue
                r.raise_for_status()
                dosya.write_text(json.dumps(r.json()["hourly"]))
                break
            print("tamam" if dosya.exists() else "ATLANDI", s["id"], m, flush=True)
            time.sleep(0.5)


def gunluk_tmin(h: dict, anahtar: str) -> dict[str, float]:
    by: dict[str, list[float]] = {}
    for t, v in zip(h["time"], h[anahtar], strict=True):
        if v is not None:
            by.setdefault(t[:10], []).append(v)
    return {g: min(v) for g, v in by.items() if len(v) >= 22}


def metrik(hata: np.ndarray) -> dict[str, float]:
    return {"n": int(len(hata)), "yanlilik": round(float(hata.mean()), 2), "mae": round(float(np.abs(hata).mean()), 2), "rmse": round(math.sqrt(float((hata**2).mean())), 2)}


def don(obs: np.ndarray, tah: np.ndarray, esik_gozlem: float, esik_tahmin: float) -> dict[str, float]:
    g, t = obs <= esik_gozlem, tah <= esik_tahmin
    tp, fp, fn = int((g & t).sum()), int((~g & t).sum()), int((g & ~t).sum())
    return {"gozlenen": int(g.sum()), "POD": round(tp / (tp + fn), 3) if tp + fn else float("nan"), "FAR": round(fp / (tp + fp), 3) if tp + fp else float("nan"), "alarm": int(t.sum())}


def degerlendir(ist_klasor: Path, tahmin: Path) -> dict:
    ist = [json.loads(p.read_text()) for p in sorted(ist_klasor.glob("*.json"))]
    ortak: dict[tuple[str, str], dict[str, float]] = {}
    for s in ist:
        obs = {g: v for g, v in s["tmin_obs"].items() if int(g[5:7]) in KIS and g >= BAS}
        for m in MODELLER:
            dosya = tahmin / f"{s['id']}_{m}.json"
            if not dosya.exists():
                continue
            h = json.loads(dosya.read_text())
            for lead in (1, 2, 3):
                ortak[(s["id"], f"{m}|{lead}")] = gunluk_tmin(h, f"temperature_2m_previous_day{lead}")
    # ortak gece kümesi: her istasyonda 4 modelin (lead 1..3) hepsi mevcut olan geceler
    sonuc: dict = {"modeller": MODELLER, "kapsam": {}, "tablo": {}}
    for s in ist:
        obs = {g: v for g, v in s["tmin_obs"].items() if int(g[5:7]) in KIS and BAS <= g <= BIT}
        for tur, secili in (("ortak", MODELLER), ("best_match_tum", ["best_match"])):
            gun = set(obs)
            for m in secili:
                for lead in (1, 2, 3):
                    gun &= set(ortak.get((s["id"], f"{m}|{lead}"), {}))
            for m in MODELLER if tur == "ortak" else ["best_match"]:
                for lead in (1, 2, 3):
                    for grup in ("tum", "kiyi", "kiyi_alcak"):
                        if grup == "kiyi" and not KIYI(s) or grup == "kiyi_alcak" and not (KIYI(s) and s["yukseklik"] <= 100):
                            continue
                        d = sonuc["tablo"].setdefault(f"{tur}|{m}|{lead}|{grup}", {"obs": [], "tah": [], "ist": set()})
                        for g in sorted(gun):
                            d["obs"].append(obs[g])
                            d["tah"].append(ortak[(s["id"], f"{m}|{lead}")][g])
                            d["ist"].add(s["id"])
    cikti: dict = {}
    for anahtar, d in sonuc["tablo"].items():
        o, t = np.array(d["obs"]), np.array(d["tah"])
        if len(o) == 0:
            continue
        satir = {"istasyon": len(d["ist"]), **metrik(t - o)}
        satir["don_0_0"] = don(o, t, 0.0, 0.0)  # gözlem ≤ 0 °C ↔ tahmin ≤ 0 °C
        satir["don_0_2"] = don(o, t, 0.0, 2.0)  # uyarı kuralı: tahmin ≤ +2 °C ile ≤ 0 °C gözlem (kaçırmayan taraf)
        satir["don_0_3"] = don(o, t, 0.0, 3.0)
        satir["don_2_2"] = don(o, t, 2.0, 2.0)
        cikti[anahtar] = satir
    return cikti


def topluluk(ist_klasor: Path, tahmin: Path) -> dict:
    """Çok modelli tahmin tahmincileri: ortalama ve «en soğuk model» (kaçırmayan taraf) — IFS, ICON, GFS ortak geceleri; kıyı ve tüm istasyonlar, 1–3 gün önceden; eşik taraması."""
    ist = [json.loads(p.read_text()) for p in sorted(ist_klasor.glob("*.json"))]
    modeller = ("ecmwf_ifs025", "icon_seamless", "gfs_seamless")
    T = {}
    for s in ist:
        for m in modeller:
            h = json.loads((tahmin / f"{s['id']}_{m}.json").read_text())
            for lead in (1, 2, 3):
                T[(s["id"], m, lead)] = gunluk_tmin(h, f"temperature_2m_previous_day{lead}")
    out: dict = {}
    for grup in ("tum", "kiyi"):
        for lead in (1, 2, 3):
            obs_l: list[float] = []
            ort_l: list[float] = []
            min_l: list[float] = []
            for s in ist:
                if grup == "kiyi" and not KIYI(s):
                    continue
                obs = {g: v for g, v in s["tmin_obs"].items() if int(g[5:7]) in KIS and BAS <= g <= BIT}
                gun = set(obs)
                for m in modeller:
                    gun &= set(T[(s["id"], m, lead)])
                for g in sorted(gun):
                    v = [T[(s["id"], m, lead)][g] for m in modeller]
                    obs_l.append(obs[g])
                    ort_l.append(float(np.mean(v)))
                    min_l.append(min(v))
            o = np.array(obs_l)
            for ad, t in (("ortalama", np.array(ort_l)), ("en_soguk_model", np.array(min_l))):
                out[f"{grup}|{lead}|{ad}"] = {**metrik(t - o), **{f"esik_{e}": don(o, t, 0.0, float(e)) for e in (0, 1, 2, 3)}}
    return out


if __name__ == "__main__":
    if sys.argv[1] == "bulut":
        topla_bulut(Path(sys.argv[2]), Path(sys.argv[3]))
    elif sys.argv[1] == "topla":
        topla(Path(sys.argv[2]), Path(sys.argv[3]))
    elif sys.argv[1] == "topluluk":
        print(json.dumps(topluluk(Path(sys.argv[2]), Path(sys.argv[3])), ensure_ascii=False, indent=1))
    else:
        print(json.dumps(degerlendir(Path(sys.argv[2]), Path(sys.argv[3])), ensure_ascii=False, indent=1))
