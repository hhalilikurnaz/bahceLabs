"""İç kalite · Kurallar · `don_uyari` ayrıntısı (ADIM 10 kapanış): gece gece tablo (tarih, bahçe, en soğuk model tahmini, kademe, kritik eşik, kullanıcı yanıtı, en yakın istasyon gözlemi),
birikimli POD/FAR + Wilson %95 güven aralığı ve ADR 0031'deki beklenen kıyı FAR/POD referansı. Yalnız iç ekip (INTERNAL_EMAILS). Hiçbir değer uydurulmaz: örnek yetersizse «yetersiz» denir."""

from __future__ import annotations

import math
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.evidence.providers import haversine_km

DON_C = 0.0  # istasyon «don» ölçütü: ADR 0031 doğrulaması ile AYNI (≤ 0 °C vekil)
GECE_LIMIT = 200


def wilson(k: int, n: int, z: float = 1.96) -> dict[str, Any]:
    """Wilson %95 güven aralığı (küçük örnekte normal yaklaşımdan güvenli)."""
    if n == 0:
        return {"k": 0, "n": 0, "oran": None, "alt": None, "ust": None}
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return {"k": k, "n": n, "oran": round(p, 3), "alt": round(max(0.0, c - h), 3), "ust": round(min(1.0, c + h), 3)}


async def ayrinti(session: AsyncSession, workspace_id: uuid.UUID, kural_min_yanit: int | None = None) -> dict[str, Any]:
    k = load_catalog().don
    min_n = kural_min_yanit if kural_min_yanit is not None else load_catalog().izleme.kural_min_yanit
    rows = (await session.execute(text(
        "SELECT d.garden_id, g.ad, d.gece, d.en_soguk_c, d.seviye, d.kritik_c, b.yanit, ST_Y(ST_Centroid(g.geom)), ST_X(ST_Centroid(g.geom)) FROM don_risk d "
        "JOIN gardens g ON g.id = d.garden_id AND g.workspace_id = :w LEFT JOIN don_geri_bildirim b ON b.garden_id = d.garden_id AND b.gece = d.gece ORDER BY d.gece DESC, g.ad"), {"w": workspace_id})).all()
    istasyonlar = (await session.execute(text("SELECT id, ad, lat, lng, gozlem_baslangic, gozlem_bitis FROM stations"))).all()
    azami = load_catalog().dis_kanit.istasyon_azami_km
    en_yakin: dict[uuid.UUID, tuple[Any, float] | None] = {}
    for r in rows:
        if r[0] in en_yakin:
            continue
        adaylar = [(s, haversine_km(float(r[7]), float(r[8]), s[2], s[3])) for s in istasyonlar]
        adaylar = [a for a in adaylar if a[1] <= azami]
        en_yakin[r[0]] = min(adaylar, key=lambda a: a[1]) if adaylar else None
    sid = {a[0][0] for a in en_yakin.values() if a}
    gunler = {r[2] + timedelta(days=1) for r in rows}
    obs: dict[tuple[str, date], float] = {}
    if sid and gunler:
        for i, t, m in (await session.execute(text("SELECT istasyon_id, tarih, tmin FROM station_daily WHERE istasyon_id = ANY(:i) AND tarih = ANY(:t) AND tmin IS NOT NULL"), {"i": list(sid), "t": list(gunler)})).all():
            obs[(i, t)] = float(m)
    geceler: list[dict[str, Any]] = []
    kul_uyari = kul_oldu = kul_olmadi = kul_bilmiyorum = 0
    ist_uyari_gozlemli = ist_uyari_yanlis = ist_don = ist_don_uyarili = ist_gece = 0
    for r in rows:
        gid, ad, gece, en_soguk, seviye, kritik, yanit = r[:7]
        ey = en_yakin.get(gid)
        ist = None
        if ey is not None:
            s, km = ey
            ok = s[4] is not None and s[5] is not None and s[4] <= gece + timedelta(days=1) <= s[5]  # gerçek gözlem aralığı dışı satır model/dolgu: kanıt DEĞİL
            tmin = obs.get((s[0], gece + timedelta(days=1))) if ok else None
            if tmin is not None:
                ist = {"ad": s[1], "mesafe_km": round(km, 1), "tmin_c": tmin}
                ist_gece += 1
                don = tmin <= DON_C
                ist_don += int(don)
                if seviye == "uyari":
                    ist_uyari_gozlemli += 1
                    ist_uyari_yanlis += int(not don)
                    ist_don_uyarili += int(don)
        if seviye == "uyari":
            kul_uyari += 1
            kul_oldu += int(yanit == "oldu")
            kul_olmadi += int(yanit == "olmadi")
            kul_bilmiyorum += int(yanit == "bilmiyorum")
        if seviye in ("izle", "uyari") and len(geceler) < GECE_LIMIT:
            geceler.append({"gece": gece, "bahce": ad, "en_soguk_c": en_soguk, "kademe": "uyarı" if seviye == "uyari" else "izle", "kritik_c": kritik, "yanit": yanit, "istasyon": ist})
    yanitli = kul_oldu + kul_olmadi
    far_kul = wilson(kul_olmadi, yanitli)
    far_ist = wilson(ist_uyari_yanlis, ist_uyari_gozlemli)
    pod_ist = wilson(ist_don_uyarili, ist_don)
    for w in (far_kul, far_ist, pod_ist):
        w["yeterli"] = w["n"] >= min_n
    return {
        "referans": {"far": k.beklenen_kiyi_far, "pod": k.beklenen_kiyi_pod, "kaynak": "ADR 0031 §2 — kural A, Akdeniz kıyısı (2 kış, 39 don gecesi)", "min_n": min_n},
        "kullanici": {"uyari_gece": kul_uyari, "yanit": kul_oldu + kul_olmadi + kul_bilmiyorum, "oldu": kul_oldu, "olmadi": kul_olmadi, "bilmiyorum": kul_bilmiyorum, "far": far_kul, "aciklama": "FAR = «olmadı» / (oldu + olmadı): kullanıcının bildirdiği yanlış alarm oranı."},
        "istasyon": {"gozlemli_gece": ist_gece, "don_gecesi": ist_don, "uyari_gozlemli": ist_uyari_gozlemli, "far": far_ist, "pod": pod_ist, "aciklama": f"İstasyon gözlemi olan geceler (Meteostat ≈ 8 ay gecikmeli): don = en yakın istasyon (≤ 80 km) sabah en düşüğü ≤ {DON_C:g} °C."},
        "geceler": geceler,
    }
