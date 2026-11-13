"""9J-4 kural performansı: aylık üretilen / yanıt / isabet; yanıtsız kural «ölçülemiyor» (isabet uydurulmaz)."""

import uuid
from datetime import date, timedelta

from sqlalchemy import text

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.izleme import kural_performans as kp

from .test_irrigation_panel import kur
from .test_water_api import TODAY, factory, user_client  # noqa: F401

K = load_catalog().izleme


def test_degerlendir_olculemiyor_kurallari():
    ay = date(2026, 9, 1)
    r = kp.degerlendir("sulama_onerisi", ay, 10, 4, 0, 0, 5, False)
    assert r.durum == "olculemiyor" and r.isabet is None and r.yanit_orani == 0.4 and "yer gerçeği" in r.neden
    az = kp.degerlendir("sistem_kontrol", ay, 8, 3, 2, 3, 5, True)  # 3 yanıt < 5: oran görünür, isabet YOK
    assert az.durum == "olculemiyor" and az.isabet is None and az.isabet_poz == 2 and "uydurulmaz" in az.neden
    ok = kp.degerlendir("sistem_kontrol", ay, 8, 6, 4, 6, 5, True)
    assert ok.durum == "olculuyor" and ok.isabet == 4 / 6 and ok.yanit_orani == 0.75
    assert kp.degerlendir("don", ay, 0, 0, 0, 0, 5, True).yanit_orani is None  # üretilen 0 → oran yok


async def test_kural_performansi_gercek_kayitlardan(user_client, factory):  # noqa: F811
    gid = await kur(user_client, factory)
    ws = (await user_client.get("/auth/me")).json()["workspace_id"]
    ay = date(TODAY.year, TODAY.month, 1)
    async with factory() as s:
        # sistem kontrol: 6 bildirim + 6 yanıt (4 isabetli) ; don: 2 uyarı, 0 doğrulama ; sulama: 3 bildirim, 1'i ardından sulama kaydı
        for i in range(6):
            await s.execute(text("INSERT INTO notifications (id, workspace_id, garden_id, tur, oncelik, baslik, metin, baglanti, dedupe_key, teslim, created_at) VALUES (gen_random_uuid(), :w, :g, 'sulama_sistem_kontrol', 'onemli', 'x', 'y', '/', :k, 'ozet', now())"), {"w": ws, "g": gid, "k": f"sk{i}"})
            await s.execute(text("INSERT INTO sk_yanit (garden_id, sektor_ad, sahne_tarihi, yanit) VALUES (:g, 'Bahçe', :t, :y)"), {"g": gid, "t": TODAY - timedelta(days=60 + i), "y": ("damlatici_tikali", "baska_sorun", "damlatici_tikali", "baska_sorun", "sorun_yok", "sorun_yok")[i]})
        for i in range(2):
            await s.execute(text("INSERT INTO notifications (id, workspace_id, garden_id, tur, oncelik, baslik, metin, baglanti, dedupe_key, teslim, created_at) VALUES (gen_random_uuid(), :w, :g, 'hava_don', 'kritik', 'x', 'y', '/', :k, 'anlik', now())"), {"w": ws, "g": gid, "k": f"don{i}"})
        for i in range(3):
            await s.execute(text("INSERT INTO notifications (id, workspace_id, garden_id, tur, oncelik, baslik, metin, baglanti, dedupe_key, teslim, created_at) VALUES (gen_random_uuid(), :w, :g, 'sulama_plani', 'onemli', 'x', 'y', '/', :k, 'ozet', now())"), {"w": ws, "g": gid, "k": f"sp{i}"})
        await s.execute(text("INSERT INTO field_records (id, garden_id, tur, tarih, aciklama, ayrinti) VALUES (gen_random_uuid(), :g, 'sulama', CURRENT_DATE + 1, 'x', '{}'::jsonb)"), {"g": gid})
        await s.commit()
        sat = await kp.kural_performansi(s, TODAY - timedelta(days=120), TODAY + timedelta(days=90))  # testlerde zaman dondurulur (TODAY); veritabanı now() gerçek saat: pencere geniş
    oz = kp.ozet(sat, K)
    sk = oz["sistem_kontrol"]
    assert sk["uretilen"] == 6 and sk["yanit"] == 6 and sk["isabet_n"] == 6 and sk["isabet"] == 4 / 6 and sk["durum"] == "olculuyor"  # (sk_yanit created_at = şimdi: bu aya)
    don = oz["don"]
    assert don["uretilen"] == 2 and don["yanit"] == 0 and don["isabet"] is None and don["durum"] == "olculemiyor"  # yanıtı olmayan kural: isabet UYDURULMAZ
    sul = oz["sulama_onerisi"]
    assert sul["uretilen"] == 3 and sul["yanit"] == 3 and sul["isabet"] is None and sul["durum"] == "olculemiyor"  # 3 bildirimin hepsinden sonra ≤ 2 günde sulama kaydı var
    assert {s.kural for s in sat} == set(kp.KURAL_AD) and all(s.ay.day == 1 for s in sat)
    assert uuid.UUID(str(gid))
