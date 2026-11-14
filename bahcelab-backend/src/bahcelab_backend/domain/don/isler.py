"""Gece don işi (saatlik zamanlayıcı): topografya profili (bir kez) + 3 gecelik risk (≥ 3 saatte bir ya da bildirim saatinde taze) + 18:00 uyarı bildirimi + ertesi sabah «Don oldu mu?» sorusu.
Bildirim ve soru YALNIZ `don.bildirim_acik` ise üretilir (Dilim 2 onayına kadar kapalı; eski «hava_don» ile çift uyarı olmasın). Hata bir bahçede diğerlerini durdurmaz."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bahcelab_backend.domain.agro.catalog import DonKurali, load_catalog
from bahcelab_backend.domain.don import servis, topografya
from bahcelab_backend.domain.don.tahmin import TahminSaglayici
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.service import NotificationService
from bahcelab_backend.domain.notifications.types import Candidate

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]
TAZE_SAAT = 3


def uyari_adayi(garden_id: uuid.UUID, ad: str, gece: date, en_soguk: float, kritik: float) -> Candidate:
    return Candidate(
        garden_id, "don_gece", "kritik", f"{ad}: bu gece don olasılığı yüksek",
        f"En soğuk model tahmini {en_soguk:.1f} °C (bu dönemde hassas organ için kritik ≈ {kritik:.1f} °C). Uyarılarımız bilerek temkinlidir; don olmayabilir. Ayrıntı ve nasıl hesaplandığı Durum ekranında.",
        "durum", f"don_gece:{garden_id}:{gece.isoformat()}", {"gece": gece.isoformat()},
    )


def soru_adayi(garden_id: uuid.UUID, ad: str, gece: date) -> Candidate:
    return Candidate(
        garden_id, "don_soru", "onemli", f"{ad}: dün gece don oldu mu?",
        "Dün gece için don uyarısı vermiştik. Bahçenizde don oldu mu? (oldu / olmadı / bilmiyorum) Yanıtınız uyarıları iyileştirir.",
        "durum", f"don_soru:{garden_id}:{gece.isoformat()}", {"gece": gece.isoformat()},
    )


async def don_isi(factory: SessionFactory, saglayici: TahminSaglayici | None = None, simdi: datetime | None = None, kural: DonKurali | None = None, pencere_fn: Any = None) -> dict[str, int]:
    k = kural or load_catalog().don
    sonuc = {"bahce": 0, "topografya": 0, "risk": 0, "uyari_bildirimi": 0, "soru": 0, "hata": 0}
    async with factory() as s:
        bahceler = [(r[0], r[1], r[2], r[3]) for r in (await s.execute(text("SELECT id, workspace_id, ad, zaman_dilimi FROM gardens"))).all()]
    for gid, ws, ad, tz in bahceler:
        sonuc["bahce"] += 1
        yerel = (simdi or datetime.now(ZoneInfo(tz))).astimezone(ZoneInfo(tz))
        bugun = yerel.date()
        try:
            async with factory() as s:
                if await topografya.hesapla(s, gid, k, pencere_fn) is not None:
                    sonuc["topografya"] += 1
                son = (await s.execute(text("SELECT max(uretildi) FROM don_risk WHERE garden_id = :g AND gece >= :b"), {"g": gid, "b": bugun})).scalar()
                eski = son is None or (datetime.now(son.tzinfo) - son) > timedelta(hours=TAZE_SAAT) or yerel.hour == k.uyari_saat
                if eski:
                    sonuc["risk"] += len(await servis.hesapla_ve_yaz(s, gid, saglayici, k, bugun))
                await s.commit()
            if not k.bildirim_acik:
                continue
            adaylar: list[Candidate] = []
            async with factory() as s:
                if yerel.hour == k.uyari_saat:
                    r = (await s.execute(text("SELECT en_soguk_c, kritik_c FROM don_risk WHERE garden_id = :g AND gece = :n AND seviye = 'uyari'"), {"g": gid, "n": bugun})).first()
                    if r is not None:
                        adaylar.append(uyari_adayi(gid, ad, bugun, r[0], r[1]))
                        sonuc["uyari_bildirimi"] += 1
                if yerel.hour == k.soru_saat:
                    dun = bugun - timedelta(days=1)
                    r = (await s.execute(text("SELECT 1 FROM don_risk d WHERE d.garden_id = :g AND d.gece = :n AND d.seviye = 'uyari' AND NOT EXISTS (SELECT 1 FROM don_geri_bildirim b WHERE b.garden_id = d.garden_id AND b.gece = d.gece)"), {"g": gid, "n": dun})).first()
                    if r is not None:
                        adaylar.append(soru_adayi(gid, ad, dun))
                        sonuc["soru"] += 1
                if adaylar:
                    await NotificationService(NotificationRepository(s, ws)).publish(adaylar)
                await s.commit()
        except Exception:  # noqa: BLE001
            logger.exception("Gece don işi başarısız (bahçe %s)", gid)
            sonuc["hata"] += 1
    return sonuc
