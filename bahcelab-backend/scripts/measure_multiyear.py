"""Çok yıllık analizi çalışan API üzerinde gerçek Planetary Computer verisiyle ölçer (rapor için). Kullanım: python scripts/measure_multiyear.py
Giriş: seed kullanıcısı (make db-seed). Bahçe: Erdemli ≈ 26 dekar (yalnızca ölçüm; ölçümden sonra silinir)."""

import math
import time

import httpx
from pyproj import Geod

BASE = "http://localhost:8001"
LNG, LAT, SIDE = 34.383, 36.659, 161.0
GEOD = Geod(ellps="WGS84")


def square() -> dict:
    ring = []
    for azimuth in (225, 315, 45, 135):
        x, y, _ = GEOD.fwd(LNG, LAT, azimuth, SIDE * math.sqrt(2) / 2)
        ring.append([x, y])
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def main() -> None:
    with httpx.Client(base_url=BASE, timeout=60) as c:
        assert c.post("/auth/login", json={"email": "test@bahcelab.com", "password": "test1234"}).status_code == 200
        garden = c.post("/gardens", json={"ad": "Ölçüm Bahçesi", "urun": "limon", "geometry": square(), "il": "Mersin", "ilce": "Erdemli"}).json()
        gid = garden["id"]
        try:
            started = time.monotonic()
            status = c.post(f"/gardens/{gid}/bolgeler/cok-yillik").json()
            print("başladı:", status["baslangic_yili"], "→", status["bitis_yili"], "arşiv:", status["arsiv_baslangic"])
            while status["durum"] == "isleniyor":
                time.sleep(5)
                status = c.get(f"/gardens/{gid}/bolgeler/cok-yillik/durum").json()
                print(f"  {time.monotonic() - started:5.0f} sn · {status['tamamlanan']}/{status['toplam']} yıl · işleniyor: {status['aktif_yil']}")
            total = time.monotonic() - started
            print(f"\nToplam süre: {total:.0f} sn ({total / max(1, status['toplam']):.1f} sn/yıl, ardışık ≤ 2 yıl paralel)")
            print("| Yıl | Net sahne | Aday | Süre (sn) | Durum |\n|---|---|---|---|---|")
            for y in status["yillar"]:
                print(f"| {y['yil']}{' (kısmi)' if y['kismi'] else ''} | {y['sahne_sayisi']} | {y['aday_sayisi']} | {y['sure_saniye']} | {y['durum']} {y['hata_mesaji'] or ''} |")
            for k in (3, 5):
                t0 = time.monotonic()
                r = c.get(f"/gardens/{gid}/bolgeler/cok-yillik/sonuc", params={"bolge_sayisi": k}).json()
                print(f"\nSonuç k={k} ({time.monotonic() - t0:.1f} sn): {r['durum']} · yıllar {r['yil_araligi']} · homojen={r['homojen']} · yayılım %{r['yayilim_yuzde']}")
                for b in r["ozet"]:
                    print(f"  {b['ad']}: {b['alan_dekar']} da · pay %{b['pay'] * 100:.0f} · fark %{b['fark_yuzde']} · istikrar {b['istikrar_sinifi']}")
                print("  yıllar:", [(y["yil"], y["korelasyon"], "uyumsuz" if y["uyumsuz"] else "ok") for y in r["yillar"]])
                print("  yorum:", r["yorumlar"])
        finally:
            c.delete(f"/gardens/{gid}")


if __name__ == "__main__":
    main()
