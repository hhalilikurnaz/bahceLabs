"""Olay listesini çiftçi doğrulaması için Markdown'a döker (SALT OKUNUR): docs/agro/olay-dogrulama.md.

Her olay için tarih, tür, güven ve kaynaklar yazılır; «Çiftçi doğrulaması» sütunu boş bırakılır (gerçekleşti / gerçekleşmedi / bilinmiyor).
  python scripts/export_event_validation.py --garden <id> [--garden <id> ...] [--cikti docs/agro/olay-dogrulama.md]
"""

import argparse
import asyncio
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select, text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions.models import AcquisitionModel, ChangeEventModel
from bahcelab_backend.domain.events.models import EventModel, EventSourceModel
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401

TUR = {"don": "Don", "asiri_yagis": "Aşırı yağış", "ruzgar": "Kuvvetli rüzgâr", "s2_dusus": "Ani düşüş (optik)", "radar_degisim": "Radar değişimi", "s2_suphe": "Atmosfer şüphesi (olay DEĞİL)"}
GUVEN = {"yuksek": "yüksek", "orta": "orta", "dusuk": "düşük"}
NEDEN = {"toparlandi": "sonraki görüntüde toparlandı", "tum_bahce_destek_yok": "bahçenin >%90'ı düştü, hava/radar desteği yok", "teyit_bekliyor": "sonraki net görüntü yok"}
EMPTY = "gerçekleşti / gerçekleşmedi / bilinmiyor"


def tr(v: float, digits: int = 1) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


def fmt_day(d: object) -> str:
    return d.strftime("%d.%m.%Y")  # type: ignore[attr-defined,no-any-return]


async def sources_text(session, event: EventModel) -> str:  # noqa: ANN001
    refs = (await session.execute(select(EventSourceModel).where(EventSourceModel.event_id == event.id).order_by(EventSourceModel.tarih))).scalars().all()
    d = event.ayrinti or {}
    parts: list[str] = []
    if "don" in event.turler:
        n = sum(1 for r in refs if r.rol == "don")
        parts.append(f"ERA5-Land saatlik 2 m sıcaklık: en düşük {tr(d.get('don.en_dusuk_c', 0))} °C ({n} gün)")
    if "asiri_yagis" in event.turler:
        parts.append(f"ERA5 saatlik yağış: 24 saatte en çok {tr(d.get('asiri_yagis.en_yuksek_24s_mm', 0))} mm")
    if "ruzgar" in event.turler:
        parts.append(f"ERA5 hamle (31 km, düşük güven): en çok {tr(d.get('ruzgar.en_yuksek_hamle_kmh', 0), 0)} km/s")
    acq_ids = [uuid.UUID(r.kaynak_kimligi) for r in refs if r.kaynak_tablosu == "acquisitions"]
    if acq_ids:
        acqs = {a.id: a for a in (await session.execute(select(AcquisitionModel).where(AcquisitionModel.id.in_(acq_ids)))).scalars().all()}
        days = sorted(acqs[i].tarih for i in acq_ids if i in acqs)
        key = "s2_dusus.delta_ndvi" if "s2_dusus.delta_ndvi" in d else None
        extra = f", Δ NDVI {tr(d[key], 2)}" if key else ""
        parts.append(f"Sentinel-2 NDVI {fmt_day(days[0])} → {fmt_day(days[-1])}{extra}")
    radar_ids = [uuid.UUID(r.kaynak_kimligi) for r in refs if r.kaynak_tablosu == "change_events"]
    if radar_ids:
        rows = (await session.execute(select(ChangeEventModel).where(ChangeEventModel.id.in_(radar_ids)))).scalars().all()
        for c in rows:
            parts.append(f"Sentinel-1 yörünge {c.yorunge} {fmt_day(c.tarih)}: {'azalış' if c.isaret == 'azalis' else 'artış'} {tr(abs(c.buyukluk_db))} dB, {tr(c.alan_m2 / 1000)} da")
    return "; ".join(parts) or "—"


async def section(session, gid: uuid.UUID, name: str) -> str:  # noqa: ANN001
    area = (await session.execute(text("SELECT alan_dekar FROM gardens WHERE id = :g"), {"g": gid})).scalar_one()
    events = (await session.execute(select(EventModel).where(EventModel.garden_id == gid, EventModel.durum == "olay").order_by(EventModel.baslangic))).scalars().all()
    doubts = (await session.execute(select(EventModel).where(EventModel.garden_id == gid, EventModel.durum == "suphe").order_by(EventModel.baslangic))).scalars().all()
    lines = [f"## {name} ({tr(float(area))} da)", "", f"Olay: {len(events)} · atmosfer şüphesi (olay değil): {len(doubts)}", "", "### Olaylar", ""]
    lines += ["| # | Tarih | Tür | Güven | Kaynaklar | Çiftçi doğrulaması |", "|---|---|---|---|---|---|"]
    for i, e in enumerate(events, 1):
        span = fmt_day(e.baslangic) if e.baslangic == e.bitis else f"{fmt_day(e.baslangic)} – {fmt_day(e.bitis)}"
        kinds = TUR[e.tur] + (f" + {', '.join(TUR[k].lower() for k in e.turler if k != e.tur)}" if len(e.turler) > 1 else "") + (" (şiddetli)" if e.siddet == "siddetli" else "") + (" — TAHMİN" if e.tahmin else "")
        lines.append(f"| {i} | {span} | {kinds} | {GUVEN[e.guven]} | {await sources_text(session, e)} | {EMPTY} |")
    lines += ["", "### Atmosfer şüpheleri (olay sayılmadı; bilgi için)", "", "| # | Tarih | Neden olay sayılmadı | Kaynaklar |", "|---|---|---|---|"]
    for i, e in enumerate(doubts, 1):
        lines.append(f"| {i} | {fmt_day(e.baslangic)} – {fmt_day(e.bitis)} | {NEDEN.get(str((e.ayrinti or {}).get('s2_dusus.neden')), '—')} | {await sources_text(session, e)} |")
    return "\n".join(lines)


async def main() -> None:
    ap = argparse.ArgumentParser(description="Olay doğrulama listesi (salt okunur)")
    ap.add_argument("--garden", action="append", required=True)
    ap.add_argument("--cikti", default="../docs/agro/olay-dogrulama.md")
    args = ap.parse_args()
    out = [
        "# Olay doğrulama listesi (çiftçi için)", "",
        f"Oluşturma: {datetime.now(UTC).date().isoformat()} · Kaynak: olay motoru (ADR 0018, formül olay-v2). Eşikler ön değerdir; mühendis onayı bekliyor.", "",
        "**Nasıl kullanılır:** «Çiftçi doğrulaması» sütununa her olay için **gerçekleşti**, **gerçekleşmedi** ya da **bilinmiyor** yazın. Tarihler uydu geçiş ve ERA5 günlük tarihleridir; "
        "gerçek olay birkaç gün önce/sonra olabilir. Don, yağış ve rüzgâr olayları 9–31 km ERA5 ızgarasından gelir (bahçeye birebir ölçüm değildir); rüzgâr hamlesi ERA5'te düşük çıkar, bu yüzden güven düşüktür.", "",
        "**Güven:** yüksek = birden çok kaynak ailesi (ör. hava + uydu) aynı pencerede; orta = tek güvenilir kaynak; düşük = tek kaynak ve zayıf (geçmiş rüzgâr).", "",
    ]
    async with async_session_factory() as session:
        for g in args.garden:
            gid = uuid.UUID(g)
            name = (await session.execute(text("SELECT ad FROM gardens WHERE id = :g"), {"g": gid})).scalar_one()
            out += [await section(session, gid, name), ""]
    path = Path(args.cikti)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out), encoding="utf-8")
    print(f"yazıldı: {path.resolve()}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
