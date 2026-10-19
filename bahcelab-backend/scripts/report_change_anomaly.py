"""«Değişim anomalisi» RAPORU (SALT OKUNUR; kural değiştirmez): dona bağlanan S2 aday düşüşü, diğer yılların AYNI takvim penceresindeki Δ dağılımına göre sıra dışı mı?

Her don olayı için, don bitişinden sonraki 0..+don_hasar_gun gün içinde biten ilk net S2 çifti alınır; çiftin bahçe ortancası ΔNDVI'si, DİĞER yılların son tarihi
aynı ±s2_pencere_gun penceresine düşen çiftlerinin Δ dağılımıyla (p10, medyan, örnek sayısı) kıyaslanır. Çıktı Markdown tablosudur; hiçbir kayıt yazılmaz.
  python scripts/report_change_anomaly.py --ad jlnnlk --ad "soğuk hava" [--cikti ../docs/agro/degisim-anomalisi.md]
"""

import argparse
import asyncio
import statistics
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np
from sqlalchemy import select, text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions import masking
from bahcelab_backend.domain.acquisitions.models import ACQ_NET, AcquisitionModel
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID as S2_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.events import rules as er
from bahcelab_backend.domain.events import service as events
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.shared.storage import get_storage


@dataclass
class Pair:
    onceki: date
    sonraki: date
    delta: float  # bahçe ortancası ΔNDVI (yumuşatılmış ızgaralar)


async def pairs_of(session, storage, garden_id, rule: cat.OlayKurali) -> list[Pair]:  # noqa: ANN001
    geometry = await AcquisitionRepository(session).geometry_geojson(garden_id)
    mask = masking.mask_for(geometry) if geometry else None
    scenes = (
        await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == S2_SOURCE, AcquisitionModel.durum == ACQ_NET, AcquisitionModel.izgara_yolu.is_not(None)).order_by(AcquisitionModel.tarih))
    ).scalars().all()
    loaded: list[tuple[date, np.ndarray]] = []
    for acq in scenes:
        if not acq.izgara_yolu or not storage.exists(acq.izgara_yolu):
            continue
        grid = decode_grids(storage.read(acq.izgara_yolu)).get("ndvi")
        if grid is not None:
            loaded.append((acq.tarih, er.smooth_valid(masking.apply(grid, mask) if mask is not None else grid, rule.s2_yumusatma)))
    out: list[Pair] = []
    for (d0, g0), (d1, g1) in zip(loaded, loaded[1:], strict=False):
        if (d1 - d0).days > rule.s2_azami_aralik_gun or g0.shape != g1.shape:
            continue
        delta = g1 - g0
        valid = delta[np.isfinite(delta)]
        if valid.size:
            out.append(Pair(d0, d1, float(np.median(valid))))
    return out


def tr(v: float, digits: int = 3) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


def p10_of(values: list[float]) -> float:
    return float(np.percentile(values, 10))


async def report_for(session, storage, gid, name: str, rule: cat.OlayKurali, today: date) -> list[str]:  # noqa: ANN001
    pairs = await pairs_of(session, storage, gid, rule)
    frosts = sorted((s for s in await events.collect_signals(session, storage, gid, today) if s.tur == "don"), key=lambda s: s.baslangic)
    lines = [f"### {name}", "", f"Net S2 çifti: {len(pairs)}; don olayı: {len(frosts)}.", "", "| Don (bitiş) | Bağlanan S2 çifti | Δ NDVI (bahçe ortancası) | Diğer yıllar aynı pencere: n | p10 | medyan | Δ ≤ p10? |", "|---|---|---|---|---|---|---|"]
    for frost in frosts:
        bound = next((p for p in pairs if p.sonraki >= frost.bitis and p.onceki + timedelta(days=1) <= frost.bitis + timedelta(days=rule.don_hasar_gun)), None)
        if bound is None:
            lines.append(f"| {frost.bitis:%d.%m.%Y} | çift yok (pencerede net görüntü yok) | — | — | — | — | — |")
            continue
        others = [p.delta for p in pairs if p.sonraki.year != bound.sonraki.year and er.circular_doy_gap(p.sonraki, bound.sonraki) <= rule.s2_pencere_gun]
        if len(others) < 3:
            lines.append(f"| {frost.bitis:%d.%m.%Y} | {bound.onceki:%d.%m.%Y} → {bound.sonraki:%d.%m.%Y} | {tr(bound.delta)} | {len(others)} | — | — | karşılaştırılamaz (örnek az) |")
            continue
        p10 = p10_of(others)
        lines.append(f"| {frost.bitis:%d.%m.%Y} | {bound.onceki:%d.%m.%Y} → {bound.sonraki:%d.%m.%Y} | {tr(bound.delta)} | {len(others)} | {tr(p10)} | {tr(statistics.median(others))} | {'evet' if bound.delta <= p10 else 'hayır'} |")
    return [*lines, ""]


async def main() -> None:
    ap = argparse.ArgumentParser(description="Değişim anomalisi raporu (salt okunur)")
    ap.add_argument("--ad", action="append", required=True, help="Bahçe adı (alt dize, büyük/küçük harf duyarsız)")
    ap.add_argument("--cikti", help="Markdown çıktı dosyası (verilmezse ekrana)")
    args = ap.parse_args()
    today = datetime.now(UTC).date()
    rule = cat.load_catalog().olay
    storage = get_storage()
    body = [
        "# Değişim anomalisi raporu (yalnız rapor — kural değişmedi)", "",
        f"Üretim: {today:%d.%m.%Y}. Soru: dona bağlanan S2 aday düşüşü, **diğer yılların aynı takvim penceresindeki** (±{rule.s2_pencere_gun} gün) Δ dağılımının p10'unun altında mı? "
        "Δ = ardışık iki net S2 görüntüsü arasında bahçe piksellerinin ortanca ΔNDVI'si. Karşılaştırma örneği: diğer yıllarda son tarihi aynı pencereye düşen çiftler.", "",
    ]
    async with async_session_factory() as s:
        for ad in args.ad:
            rows = (await s.execute(text("SELECT id, ad FROM gardens WHERE ad ILIKE :a ORDER BY ad"), {"a": f"%{ad}%"})).all()
            if not rows:
                body += [f"### {ad}", "", "Bahçe bulunamadı.", ""]
            for gid, name in rows:
                body += await report_for(s, storage, gid, name, rule, today)
    text_out = "\n".join(body)
    if args.cikti:
        Path(args.cikti).write_text(text_out, encoding="utf-8")
    else:
        print(text_out)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
