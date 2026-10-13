"""Veri temeli servisi: yetki denetimi + geçmiş doldurma durumu + normal bantlar."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.acquisitions import masking
from bahcelab_backend.domain.acquisitions.backfill import BackfillService
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID
from bahcelab_backend.domain.acquisitions.radar_events import delta_grid, eligible_primary
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
    RadarDegisim,
    RadarDegisimler,
    RadarEdinim,
    RadarEdinimler,
    RadarNokta,
    RadarNoktaDegeri,
    RadarYorunge,
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

    async def radar_changes(self, garden_id: uuid.UUID, *, durum: str | None = None, since: date | None = None) -> RadarDegisimler:
        """Radar değişim kayıtları (aday ve gürültü), yörünge özeti ve katalog eşikleri (ön değer)."""
        await self._check(garden_id)
        rule = cat.load_catalog().radar
        events = await self.repo.change_events(garden_id, RADAR_SOURCE, durum=durum, since=since)
        orbits = await self.repo.orbits(garden_id)
        return RadarDegisimler(
            yorungeler=[RadarYorunge(yorunge=o.yorunge, gecis_yonu=o.gecis_yonu, sahne_sayisi=o.sahne_sayisi, birincil=o.birincil) for o in orbits],
            esikler={"anlamli_degisim_db": rule.anlamli_degisim_db, "anlamli_alan_orani": rule.anlamli_alan_orani, "anlamli_alan_min_da": rule.anlamli_alan_min_da, "azami_maske_orani": rule.azami_maske_orani},
            esik_durumu=rule.durum,
            degisimler=[RadarDegisim.model_validate(e, from_attributes=True) for e in events],
        )

    async def radar_acquisitions(self, garden_id: uuid.UUID, *, since: date | None = None) -> RadarEdinimler:
        """Radar geçişleri (tüm yörüngeler, kompakt): Su sekmesi şeridi, tarih kutusu ve mini seri bunu kullanır."""
        geometry = await self._check(garden_id)
        grid = canonical_grid(geometry)
        primary = await self.repo.primary_orbit(garden_id)
        rows = await self.repo.radar_scenes(garden_id, RADAR_SOURCE, since=since)
        items = [
            RadarEdinim(
                tarih=a.tarih, scene_id=a.scene_id, yorunge=a.yorunge or 0, gecis_yonu=a.gecis_yonu or "", birincil=primary == (a.yorunge, a.gecis_yonu),
                maskeli_oran=a.maskeli_oran, izgara=bool(a.izgara_yolu), vh_db=stats.get("vh_db"), rvi=stats.get("rvi"),
            )
            for a, stats in rows
        ]
        return RadarEdinimler(
            izgara=IzgaraBilgisi(satir=grid.shape[0], sutun=grid.shape[1], koordinatlar=[list(c) for c in image_corners(grid.transform, grid.crs, grid.shape)]) if items else None,
            yorungeler=[RadarYorunge(yorunge=o.yorunge, gecis_yonu=o.gecis_yonu, sahne_sayisi=o.sahne_sayisi, birincil=o.birincil) for o in await self.repo.orbits(garden_id)],
            edinimler=items,
        )

    async def radar_grid_bytes(self, garden_id: uuid.UUID, day: date, indicator: str) -> bytes:
        """Birincil yörüngenin o günkü Lee filtreli gösterge ızgarası (float32 LE, NaN = geçersiz)."""
        geometry = await self._check(garden_id)
        primary = await self.repo.primary_orbit(garden_id)
        acq = next((a for a, _ in await self.repo.radar_scenes(garden_id, RADAR_SOURCE, since=day) if a.tarih == day and a.izgara_yolu and (a.yorunge, a.gecis_yonu) == primary), None)
        if acq is None or not acq.izgara_yolu or not self.storage.exists(acq.izgara_yolu):
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu tarih için radar görüntüsü yok.")
        grids = decode_grids(self.storage.read(acq.izgara_yolu))
        if indicator not in grids:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu gösterge bu tarih için hesaplanmadı.")
        return masking.apply(grids[indicator], masking.mask_for(geometry)).astype("<f4").tobytes()

    async def radar_change_grid_bytes(self, garden_id: uuid.UUID, day: date) -> bytes:
        """Radar değişimi: sahne − aynı yörüngedeki önceki 3 sahnenin ortancası (dB, float32 LE)."""
        geometry = await self._check(garden_id)
        delta = await delta_grid(self.session, self.storage, garden_id, day, masking.mask_for(geometry))
        if delta is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu tarih için radar değişimi hesaplanamadı (aynı yörüngede yeterli önceki sahne yok).")
        return delta.astype("<f4").tobytes()

    async def radar_point(self, garden_id: uuid.UUID, row: int, col: int, day: date, count: int = 6) -> RadarNokta:
        """Bir pikselin son `count` birincil-yörünge sahnesindeki VH dB değeri (gün dahil)."""
        geometry = await self._check(garden_id)
        mask = masking.mask_for(geometry)
        _, scenes = await eligible_primary(self.session, garden_id)
        picked = [a for a, _ in scenes if a.tarih <= day][-count:]
        series: list[RadarNoktaDegeri] = []
        for acq in picked:
            grid = decode_grids(self.storage.read(acq.izgara_yolu)).get("vh_db") if acq.izgara_yolu and self.storage.exists(acq.izgara_yolu) else None
            grid = masking.apply(grid, mask) if grid is not None else None
            value = None
            if grid is not None and 0 <= row < grid.shape[0] and 0 <= col < grid.shape[1] and grid[row, col] == grid[row, col]:
                value = float(grid[row, col])
            series.append(RadarNoktaDegeri(tarih=acq.tarih, vh_db=value))
        return RadarNokta(seri=series)

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
            net_sayisi=len(items), bulutlu_sayisi=await self.repo.count_cloudy(garden_id, SOURCE_ID), bulutlu_tarihler=await self.repo.cloudy_dates(garden_id, SOURCE_ID), edinimler=items,
        )

    async def grid_bytes(self, garden_id: uuid.UUID, day: date, indicator: str) -> bytes:
        """Bir edinimin gösterge ızgarası: float32 LE, satır sırasıyla, geçersiz = NaN (bahçe dışı ve bulutlu dahil)."""
        geometry = await self._check(garden_id)
        acq = await self.repo.acquisition_on(garden_id, SOURCE_ID, day)
        if acq is None or not acq.izgara_yolu or not self.storage.exists(acq.izgara_yolu):
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu tarih için görüntü yok.")
        grids = decode_grids(self.storage.read(acq.izgara_yolu))
        if indicator not in grids:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bu gösterge bu tarih için hesaplanmadı.")
        return masking.apply(grids[indicator], masking.mask_for(geometry)).astype("<f4").tobytes()
