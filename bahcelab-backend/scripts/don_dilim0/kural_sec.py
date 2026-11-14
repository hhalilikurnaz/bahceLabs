"""Dilim 1 · bildirim kuralı seçimi: «İzle» (uygulama içi) ve «Uyarı» (18:00 bildirimi) aday kurallarını 68 istasyon × 2 kış verisiyle sınar.
Aday kurallar (kritik sıcaklık = 0 °C vekil; yalnız ≤ 0 °C gözlenen gece «don» sayılır — kıyıda ölçüm yetersizliği için bkz. don-dogrulama.md §6):
  A  en soğuk model ≤ +2 K
  B  A ve en az 2 model ≤ +3 K (model uzlaşısı)
  C  B ve açık+sakin gece tahmini (gece 00–07 ortalama bulut < b %, rüzgâr < w m/s; küçük ızgarada duyarlılık, iki kış ayrı ayrı)
Seçim ölçütü: Akdeniz kıyısında POD ≥ 0,85 koşuluyla en düşük FAR. Kullanım: python -m scripts.don_dilim0.kural_sec <istasyon-klasörü> <tahmin-klasörü>"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from scripts.don_dilim0.tahmin_basarim import BAS, BIT, KIS, KIYI, gunluk_tmin

MODELLER = ("ecmwf_ifs025", "icon_seamless", "gfs_seamless")


def gece_ortalama(h: dict, anahtar: str) -> dict[str, float]:
    by: dict[str, list[float]] = {}
    for t, v in zip(h["time"], h[anahtar], strict=True):
        if v is not None and int(t[11:13]) <= 7:
            by.setdefault(t[:10], []).append(v)
    return {g: float(np.mean(v)) for g, v in by.items() if len(v) >= 6}


def kis_adi(gun: str) -> str:
    y, m = int(gun[:4]), int(gun[5:7])
    return f"{y - 1}-{str(y)[2:]}" if m <= 3 else f"{y}-{str(y + 1)[2:]}"


def topla(ist_klasor: Path, tahmin: Path) -> list[dict]:
    """Ortak geceler: gözlem + 3 modelin Tmin (1 gün önceden) + ortalama bulut/rüzgâr (modellerin ortalaması)."""
    satirlar: list[dict] = []
    for p in sorted(ist_klasor.glob("*.json")):
        s = json.loads(p.read_text())
        obs = {g: v for g, v in s["tmin_obs"].items() if int(g[5:7]) in KIS and BAS <= g <= BIT}
        T, B, W = {}, {}, {}
        try:
            for m in MODELLER:
                T[m] = gunluk_tmin(json.loads((tahmin / f"{s['id']}_{m}.json").read_text()), "temperature_2m_previous_day1")
                bw = json.loads((tahmin / f"{s['id']}_{m}_bw.json").read_text())
                B[m] = gece_ortalama(bw, "cloud_cover_previous_day1")
                W[m] = gece_ortalama(bw, "wind_speed_10m_previous_day1")
        except FileNotFoundError:
            continue
        gun = set(obs)
        for m in MODELLER:
            gun &= set(T[m]) & set(B[m]) & set(W[m])
        for g in sorted(gun):
            t = [T[m][g] for m in MODELLER]
            satirlar.append({"ist": s["id"], "kiyi": KIYI(s), "kis": kis_adi(g), "gun": g, "obs": obs[g], "t": t, "bulut": float(np.mean([B[m][g] for m in MODELLER])), "ruzgar": float(np.mean([W[m][g] for m in MODELLER]))})
    return satirlar


def kural(satir: dict, ad: str, b: float = 40.0, w: float = 3.0, a: float = 2.0, uz: float = 3.0) -> bool:
    t = satir["t"]
    if ad == "izle":
        return min(t) <= 3.0
    ok_a = min(t) <= a
    if ad == "A":
        return ok_a
    ok_b = ok_a and sum(1 for x in t if x <= uz) >= 2
    if ad == "B":
        return ok_b
    return ok_b and satir["bulut"] < b and satir["ruzgar"] < w  # C


def pod_far(satirlar: list[dict], ad: str, **kw: float) -> dict:
    g = np.array([s["obs"] <= 0.0 for s in satirlar])
    t = np.array([kural(s, ad, **kw) for s in satirlar])
    tp, fp, fn = int((g & t).sum()), int((~g & t).sum()), int((g & ~t).sum())
    return {"n": len(satirlar), "don": int(g.sum()), "alarm": int(t.sum()), "POD": round(tp / (tp + fn), 3) if tp + fn else None, "FAR": round(fp / (tp + fp), 3) if tp + fp else None}


def rapor(satirlar: list[dict]) -> dict:
    out: dict = {"gece": len(satirlar), "kural": {}, "c_izgara": {}}
    gruplar = {"kiyi": [s for s in satirlar if s["kiyi"]], "tum": satirlar}
    for ad in ("izle", "A", "B", "C"):
        for gname, srows in gruplar.items():
            out["kural"][f"{ad}|{gname}"] = pod_far(srows, ad)
            for kis in sorted({s["kis"] for s in satirlar}):
                out["kural"][f"{ad}|{gname}|{kis}"] = pod_far([s for s in srows if s["kis"] == kis], ad)
    for b in (30.0, 40.0, 50.0, 60.0, 100.0):
        for w in (2.0, 3.0, 4.0, 99.0):
            out["c_izgara"][f"b{b:g}_w{w:g}"] = {g: pod_far(rows, "C", b=b, w=w) for g, rows in gruplar.items()}
    return out


def _skor(rows: list[dict], fn) -> dict:  # noqa: ANN001
    g = np.array([s["obs"] <= 0.0 for s in rows])
    t = np.array([fn(s) for s in rows])
    tp, fp, fnn = int((g & t).sum()), int((~g & t).sum()), int((g & ~t).sum())
    return {"don": int(g.sum()), "yakalanan": tp, "alarm": int(t.sum()), "POD": round(tp / (tp + fnn), 3) if tp + fnn else None, "FAR": round(fp / (tp + fp), 3) if tp + fp else None}


def izgara(satirlar: list[dict]) -> dict:
    """Aday kurallar ailesi (A/B/C ve eşik varyantları): kıyı, tüm istasyonlar ve kıyı kışları ayrı ayrı."""
    kurallar: dict = {}
    for a in (2.0, 2.5, 3.0, 3.5):
        kurallar[f"A(+{a:g})"] = lambda s, a=a: min(s["t"]) <= a
    for a in (2.0, 2.5, 3.0):
        for uz in (3.0, 4.0):
            kurallar[f"B(en_soguk<=+{a:g}; >=2 model<=+{uz:g})"] = lambda s, a=a, uz=uz: min(s["t"]) <= a and sum(x <= uz for x in s["t"]) >= 2
    for a, uz in ((3.0, 3.0), (3.0, 4.0)):
        for b, w in ((40, 3), (50, 4), (60, 4), (70, 5), (100, 4)):
            kurallar[f"C(B({a:g},{uz:g}); bulut<{b}; ruzgar<{w})"] = lambda s, a=a, uz=uz, b=b, w=w: min(s["t"]) <= a and sum(x <= uz for x in s["t"]) >= 2 and s["bulut"] < b and s["ruzgar"] < w
    kiyi = [s for s in satirlar if s["kiyi"]]
    return {ad: {"kiyi": _skor(kiyi, fn), "tum": _skor(satirlar, fn), "kiyi_2023-24": _skor([s for s in kiyi if s["kis"] == "2023-24"], fn), "kiyi_2024-25": _skor([s for s in kiyi if s["kis"] == "2024-25"], fn),
                "tum_2023-24": _skor([s for s in satirlar if s["kis"] == "2023-24"], fn), "tum_2024-25": _skor([s for s in satirlar if s["kis"] == "2024-25"], fn)} for ad, fn in kurallar.items()}


if __name__ == "__main__":
    veri = topla(Path(sys.argv[1]), Path(sys.argv[2]))
    print(json.dumps({"gece": len(veri), "izgara": izgara(veri)}, ensure_ascii=False, indent=1))
