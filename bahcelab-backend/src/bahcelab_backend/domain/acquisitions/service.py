"""Veri temeli servisi: yetki denetimi + geçmiş doldurma durumu + normal bantlar."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions.backfill import BackfillService
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.radar_processor import RADAR_SOURCE
from bahcelab_backend.domain.acquisitions.repository import AcquisitionRepository
from bahcelab_backend.domain.acquisitions.schemas import (
    Edinim,
    Edinimler,
    GecmisAy,
    GecmisDoldurmaDurumu,
    GostergeIstatistigi,
    IzgaraBilgisi,
    NormalBantAy,
    NormalBantlar,
    TipikBantBilgisi,
)
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.gardens.repository import GardenRepository
from bahcelab_backend.domain.multiyear.grid import canonical_grid
from bahcelab_backend.domain.ndvi.processing import image_corners
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import StorageBackend

SOURCES = {"sentinel2": SOURCE_ID, "radar": RADAR_SOURCE}


class DataFoundationService:
    def __init__(self, session: AsyncSession, workspace_id: uuid.UUID, backfill: BackfillService, storage: StorageBackend | None = None) -> None:
        self.session = session
        self.gardens = GardenRepository(session, workspace_id)
        self.repo = AcquisitionRepository(session)
        self.backfill = backfill
        self.storage = storage or backfill.storage

    async def _check(self, garden_id: uuid.UUID) -> dict:
        row = await self.gardens.get(garden_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        return row.geojson

    async def start(self, garden_id: uuid.UUID, kaynak: str = "sentinel2") -> GecmisDoldurmaDurumu:
        await self._check(garden_id)
        return GecmisDoldurmaDurumu(**await self.backfill.start(garden_id, source=SOURCES[kaynak]))

    async def status(self, garden_id: uuid.UUID, *, detail: bool = False, kaynak: str = "sentinel2") -> GecmisDoldurmaDurumu:
        await self._check(garden_id)
        source = SOURCES[kaynak]
        data = await self.backfill.status(garden_id, source)
        months = None
        if detail:
            months = [GecmisAy(ay=m.ay, durum=m.durum, net_sahne=m.net_sahne, aday_sayisi=m.aday_sayisi, hata_mesaji=m.hata_mesaji, sure_saniye=m.sure_saniye) for m in await self.repo.month_rows(garden_id, source)]  # type: ignore[arg-type]
        return GecmisDoldurmaDurumu(**data, aylar=months)

    async def normal_bands(self, garden_id: uuid.UUID) -> NormalBantlar:
        geometry_row = await self.gardens.get(garden_id)
        if geometry_row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bahçe bulunamadı.")
        garden = geometry_row.garden
        rule = cat.load_catalog().normal_bant
        rows = await self.repo.bands(garden_id, SOURCE_ID)
        out: dict[str, list[NormalBantAy]] = {}
        for r in rows:
            state = "yeterli" if r.onluk_yeterli else "kismi" if r.ceyrek_yeterli else "yetersiz_gecmis"
            out.setdefault(r.indeks, []).append(
                NormalBantAy(ay=r.ay, yil_sayisi=r.yil_sayisi, yillar=list(r.yillar), p10=r.p10, p25=r.p25, p50=r.p50, p75=r.p75, p90=r.p90, ceyrek_yeterli=r.ceyrek_yeterli, onluk_yeterli=r.onluk_yeterli, durum=state)  # type: ignore[arg-type]
            )
        progress = await self.backfill.status(garden_id)
        product = cat.load_catalog().urun(garden.urun)
        typical = {k: TipikBantBilgisi(alt=v.alt, ust=v.ust, durum=v.durum) for k, v in (product.tipik_bantlar if product else {}).items()}
        return NormalBantlar(
            tipik_bantlar=typical,
            kaynak=SOURCE_ID, formul_surumu=rows[0].formul_surumu if rows else None, asgari_yil_ceyrek=rule.asgari_yil_ceyrek, asgari_yil_onluk=rule.asgari_yil_onluk,
            esik_durumu=rule.durum, gostergeler=out, hazir=progress["durum"] == "tamam" and bool(rows),
        )

    async def acquisitions(self, garden_id: uuid.UUID) -> Edinimler:
        """Net edinimler (tarih, bulut, gösterge istatistikleri) ve bahçenin ortak ızgara bilgisi: harita tarihleri ve sezon eğrisi bunu kullanır."""
        geometry = await self._check(garden_id)
        grid = canonical_grid(geometry)
        rows = await self.repo.net_with_stats(garden_id, SOURCE_ID)
        items = [
            Edinim(
                tarih=a.tarih, scene_id=a.scene_id, bulut_orani=a.bulut_orani, gecerli_oran=a.gecerli_oran, isleme_surumu=a.isleme_surumu, formul_surumu=a.formul_surumu,
                gostergeler={s.indeks: GostergeIstatistigi(ortalama=s.ortalama, medyan=s.medyan, p10=s.p10, p25=s.p25, p75=s.p75, p90=s.p90, gecerli_piksel=s.gecerli_piksel) for s in stats},
            )
            for a, stats in rows
        ]
        return Edinimler(
            izgara=IzgaraBilgisi(satir=grid.shape[0], sutun=grid.shape[1], koordinatlar=[list(c) for c in image_corners(grid.transform, grid.crs, grid.shape)]) if items else None,
            net_sayisi=len(items), bulutlu_sayisi=await self.repo.count_cloudy(garden_id, SOURCE_ID), edinimler=items,
        )

    async def grid_bytes(self, garden_id: uuid.UUID, day: date, indicator: str) -> bytes:
        """Bir edinimin gösterge ızgarası: float32 LE, satır sırasıyla, geçersiz = NaN (bahçe dışı ve bulutlu dahil)."""
        await self._check(garden_id)
        acq = await self.repo.acquisition_on(garden_id, SOURCE_ID, day)
        if acq is None or not acq.izgara_yolu or not self.storage.exists(acq.izgara_yolu):
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu tarih için görüntü yok.")
        grids = decode_grids(self.storage.read(acq.izgara_yolu))
        if indicator not in grids:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu gösterge bu tarih için hesaplanmadı.")
        return grids[indicator].astype("<f4").tobytes()
