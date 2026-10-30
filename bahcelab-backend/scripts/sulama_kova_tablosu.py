"""Günlük kova tablosu (YALNIZ OKUR, geri alınır): yağış (ham ERA5 / IMERG / kullanılan / etkili), ET0, Kc, ETc, tükenme, RAW, tetik, öneri + Su sekmesinin kök bölgesi doluluğu.
Kayıtlı profil yoksa geçici örnek profil (kaydedilmez). Kullanım: PYTHONPATH=src .venv/bin/python scripts/sulama_kova_tablosu.py <garden_id> 2026-10-01 2026-11-10"""

from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import date

from sqlalchemy import select, text

from bahcelab_backend.database import async_session_factory
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.models import GardenModel
from bahcelab_backend.domain.irrigation import engine as en
from bahcelab_backend.domain.irrigation.models import IrrigationProfileModel
from bahcelab_backend.domain.irrigation.service import IrrigationService
from bahcelab_backend.domain.water import balance as wb
from bahcelab_backend.domain.water.era5_sync import garden_cell
from bahcelab_backend.domain.water.service import WaterService

ORNEK = dict(sistem="damla", damlatici_sayisi=4, damlatici_debi_lh=4.0, sira_aralik_m=5.0, agac_aralik_m=4.0, pompa_kw=7.5, pompa_debi_m3h=40.0, enerji="sebeke")
f = lambda v, n=1: "—" if v is None else f"{v:.{n}f}".replace(".", ",")  # noqa: E731


async def main() -> None:
    gid = uuid.UUID(sys.argv[1])
    a, b = date.fromisoformat(sys.argv[2]), date.fromisoformat(sys.argv[3])
    async with async_session_factory() as s:
        g = (await s.execute(select(GardenModel).where(GardenModel.id == gid))).scalar_one()
        if await s.get(IrrigationProfileModel, gid) is None:
            s.add(IrrigationProfileModel(garden_id=gid, **ORNEK))
            await s.flush()
        svc = IrrigationService(s, g.workspace_id)
        plan = await svc.plan(gid)
        c = await svc._ctx(gid)  # noqa: SLF001
        su = cat.load_catalog().su
        cell, _, _ = await garden_cell(s, gid)
        era5 = {r[0]: (r[1], r[2]) for r in (await s.execute(text("SELECT tarih, yagis_mm, hava_kaynak FROM era5_daily WHERE cell_id=:c"), {"c": cell})).all()}
        imerg = {r[0]: r[1] for r in (await s.execute(text("SELECT tarih, deger FROM dogrulama_gozlem WHERE garden_id=:g AND source_id='imerg-daily'"), {"g": gid})).all()}
        wsvc = WaterService(s, g.workspace_id)
        rows = {r["tarih"]: r for r in (await s.execute(text("SELECT * FROM era5_daily WHERE cell_id=:c AND tarih BETWEEN :a AND :b"), {"c": cell, "a": a, "b": b})).mappings().all()}
        prog = c.rule.sistem_programi[c.profile.sistem]
        tetik = prog.tetik_orani * c.raw
        print(f"# bahçe {g.ad} · bugün {c.today} · TAW {f(c.taw)} · RAW {f(c.raw)} · tetik {f(tetik)} (damla {prog.tetik_orani}×RAW) · taç örtüsü %{f(c.cover,0)} · verim {c.eff}")
        print("| Tarih | ERA5 yağış | IMERG | kullanılan | etkili | ET0 | Kc | ETc | tükenme (plan kovası) | RAW | tetik | öneri (net mm) | Su sekmesi doluluk % |")
        print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
        by = {x.tarih: x for x in plan.gunler}
        for d in sorted(by):
            if not a <= d <= b:
                continue
            x = by[d]
            rain, et0 = c.weather.get(d, (None, None))
            e5 = era5.get(d, (None, None))[0]
            eff = None if rain is None else en.effective_rain_mm(rain, c.rule)
            kc = en.kc_monthly(d.month, c.cover, c.rule)
            fill = None
            r = rows.get(d)
            if r is not None and r["sm0"] is not None:
                fill = wb.root_zone_fill([r[f"sm{i}"] for i in range(4)], await wsvc.climatology(c.cell, su, d), su.kok_katman_agirliklari)
            print(f"| {d}{' ·t' if x.tahmin else ''} | {f(e5)} | {f(imerg.get(d))} | {f(rain)} | {f(eff)} | {f(et0)} | {f(kc,2)} | {f(x.etc_mm)} | {f(x.tukenme_mm)} | {f(c.raw)} | {f(tetik)} | {f(x.planli_net_mm) if x.planli_net_mm else '—'} | {f(fill,0)} |")
        await s.rollback()


asyncio.run(main())
