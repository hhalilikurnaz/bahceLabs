"""Stres yaması RAPORU (SALT OKUNUR): bahçenin her net S2 görüntüsünde «stres yaması» kuralının (katalog `saha`) kaç kez yama ürettiğini yıl yıl sayar.

Amaç: kuralın alarm sağanağına yol açıp açmadığını görmek. Yama = görüntünün KENDİ dağılımının alt %10'unun altında bitişik küme (≥ 1 da ve alt %10'daki piksellerin ≥ yarısı).
«Bölüm» = ardışık yamalı görüntüler (≤ 30 gün ara, merkezler ≤ 60 m): aynı olgu birden çok görüntüde görünse tek bölüm sayılır.
  python scripts/report_stress_patches.py --ad jlnnlk --ad "soğuk hava" [--cikti ../docs/agro/stres-yamasi-raporu.md]
"""

import argparse
import asyncio
from collections import defaultdict
from datetime import date

from sqlalchemy import select, text

from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.acquisitions import masking
from bahcelab_backend.domain.acquisitions.models import ACQ_NET, AcquisitionModel
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID as S2_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.fieldbook import rules as fr
from bahcelab_backend.domain.fieldbook.service import FieldbookService  # noqa: F401
from bahcelab_backend.domain.gardens import models as _garden_models  # noqa: F401
from bahcelab_backend.domain.multiyear.grid import canonical_grid, pixel_center_lnglat
from bahcelab_backend.shared.storage import get_storage


async def scan(session, gid, rule):  # noqa: ANN001, ANN201
    storage = get_storage()
    geometry = await AcquisitionRepository(session).geometry_geojson(gid)
    mask = masking.mask_for(geometry)
    grid = canonical_grid(geometry)
    rows = (await session.execute(select(AcquisitionModel).where(AcquisitionModel.garden_id == gid, AcquisitionModel.source_id == S2_SOURCE, AcquisitionModel.durum == ACQ_NET, AcquisitionModel.izgara_yolu.is_not(None)).order_by(AcquisitionModel.tarih))).scalars().all()
    found: list[tuple[date, float, tuple[float, float]]] = []
    total: dict[int, int] = defaultdict(int)
    for acq in rows:
        if not acq.izgara_yolu or not storage.exists(acq.izgara_yolu):
            continue
        ndvi = decode_grids(storage.read(acq.izgara_yolu)).get("ndvi")
        if ndvi is None:
            continue
        total[acq.tarih.year] += 1
        patch = fr.stress_patch(masking.apply(ndvi, mask), rule.stres_yuzdelik, rule.stres_min_da, min_share=rule.stres_kume_orani)
        if patch is not None:
            found.append((acq.tarih, patch.area_da, pixel_center_lnglat(grid, patch.row, patch.col)))
    return total, found


def episodes(found):  # noqa: ANN001, ANN201
    out: list[list[tuple[date, float, tuple[float, float]]]] = []
    for item in found:
        last = out[-1][-1] if out else None
        if last and (item[0] - last[0]).days <= 30 and fr.haversine_m(last[2], item[2]) <= 60:
            out[-1].append(item)
        else:
            out.append([item])
    return out


async def main() -> None:
    ap = argparse.ArgumentParser(description="Stres yaması yıllık sayım raporu (salt okunur)")
    ap.add_argument("--ad", action="append", required=True)
    ap.add_argument("--cikti")
    args = ap.parse_args()
    rule = cat.load_catalog().saha
    body = [
        "# Stres yaması: yıl yıl kaç yama? (alarm sağanağı denetimi)", "",
        f"Kural (katalog `saha`, ön değer · mühendis onayı bekliyor): görüntünün KENDİ dağılımının alt %{rule.stres_yuzdelik:g}'unun altında bitişik yama; ≥ {rule.stres_min_da:g} da ve alt %{rule.stres_yuzdelik:g}'daki piksellerin ≥ %{round(rule.stres_kume_orani * 100)}'ini içeren küme. "
        "«Yamalı görüntü» = kuralın o görüntüde yama bulduğu sahne sayısı; «bölüm» = ardışık (≤ 30 gün, merkezler ≤ 60 m) yamalı görüntüler tek olgu sayılır.", "",
        "**Önemli:** saha turuna yalnız **en son** net görüntüdeki yama girer (geçmiş yamalar tura düşmez); bu rapor kuralın geçmişte ne kadar sık tetiklendiğini ölçer.", "",
    ]
    async with async_session_factory() as s:
        for ad in args.ad:
            for gid, name in (await s.execute(text("SELECT id, ad FROM gardens WHERE ad ILIKE :a ORDER BY ad"), {"a": f"%{ad}%"})).all():
                total, found = await scan(s, gid, rule)
                eps = episodes(found)
                by_year: dict[int, list] = defaultdict(list)
                for item in found:
                    by_year[item[0].year].append(item)
                ep_year: dict[int, int] = defaultdict(int)
                for e in eps:
                    ep_year[e[0][0].year] += 1
                body += [f"## {name}", "", "| Yıl | Net görüntü | Yamalı görüntü | Pay | Bölüm | Ortanca yama alanı (da) |", "|---|---|---|---|---|---|"]
                for y in sorted(total):
                    items = by_year.get(y, [])
                    areas = sorted(a for _, a, _ in items)
                    med = f"{areas[len(areas) // 2]:.1f}".replace(".", ",") if areas else "—"
                    body.append(f"| {y} | {total[y]} | {len(items)} | %{round(100 * len(items) / total[y])} | {ep_year.get(y, 0)} | {med} |")
                n_all, n_found = sum(total.values()), len(found)
                per_year = len(eps) / max(1, len(total))
                body += ["", f"**Toplam:** {n_all} net görüntüde {n_found} yamalı görüntü (%{round(100 * n_found / max(1, n_all))}), {len(eps)} bölüm → yılda ortalama {f'{per_year:.1f}'.replace('.', ',')} bölüm.", ""]
    text_out = "\n".join(body)
    if args.cikti:
        open(args.cikti, "w", encoding="utf-8").write(text_out)
    else:
        print(text_out)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
