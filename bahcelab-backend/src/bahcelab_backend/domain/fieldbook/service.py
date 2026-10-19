"""Saha Defteri servisi (ADR 0019): kayıtlar, fotoğraflar, «Uydu haklı mıydı?» doğrulaması, doğruluk özeti ve saha turu.

Doğrulama olay ANAHTARIYLA bağlanır ve olayın özetini taşır (olay motoru olayları yeniden kurar; çiftçinin yargısı kaybolmaz). Saha turu noktaları mevcut kayıtlardan
OKUNUR (olay yaması merkezi, çok yıllı zayıf bölge, son net görüntüdeki stres yaması); yeni veri üretilmez. Hasat bilgisi yalnız hasat kayıtlarından gelir.
"""

from __future__ import annotations

import io
import json
import uuid
from datetime import date
from typing import Any

import numpy as np
from PIL import Image, UnidentifiedImageError
from shapely.geometry import shape
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.config import get_settings
from bahcelab_backend.domain.acquisitions import masking
from bahcelab_backend.domain.acquisitions.models import ACQ_NET, AcquisitionModel
from bahcelab_backend.domain.acquisitions.processor import SOURCE_ID as S2_SOURCE
from bahcelab_backend.domain.acquisitions.store import decode_grids
from bahcelab_backend.domain.agro import catalog as cat
from bahcelab_backend.domain.events.service import event_name, list_events
from bahcelab_backend.domain.fieldbook import rules as fr
from bahcelab_backend.domain.fieldbook.models import (
    EventVerificationModel,
    FieldPhotoModel,
    FieldRecordModel,
    TourVisitModel,
)
from bahcelab_backend.domain.fieldbook.schemas import (
    DogrulamaGirdisi,
    DogrulamaKarti,
    DogrulamaListesi,
    DogrulukOzeti,
    FotoYanit,
    KayitGirdisi,
    KayitGuncelle,
    KayitYanit,
    NoktaKonumu,
    SahaTuru,
    TurNoktasi,
    TurOzetiYanit,
)
from bahcelab_backend.domain.gecmis.schemas import HasatOzeti
from bahcelab_backend.domain.multiyear.grid import canonical_grid, pixel_center_lnglat
from bahcelab_backend.domain.multiyear.repository import MultiyearRepository
from bahcelab_backend.domain.notifications.models import NotificationModel
from bahcelab_backend.shared.clock import TIMEZONE
from bahcelab_backend.shared.errors import AppError, AppErrorCode
from bahcelab_backend.shared.storage import StorageBackend

MAX_LOCATION_DISTANCE_M = 500  # konum, bahçeye en çok bu kadar uzakta olabilir
MAX_AREA_M2 = 5_000_000
PHOTO_MAX_SIDE = 1600
NOTE = "Doğrulamalar çiftçi beyanıdır; uydu bulgusunun doğru çıkıp çıkmadığını ölçmek için kullanılır, ceza ya da puan üretmez."
TOUR_NOTE = "Sıra, noktalar arası düz çizgi mesafesine göre en yakın komşudur; gerçek yürüyüş yolu değildir. Başlangıç noktanızı verirseniz sıra oradan kurulur."


def _bad(message: str) -> AppError:
    return AppError(422, AppErrorCode.VALIDATION_ERROR, message)


def _not_found(what: str) -> AppError:
    return AppError(404, AppErrorCode.NOT_FOUND, f"{what} bulunamadı.")


class FieldbookService:
    def __init__(self, session: AsyncSession, storage: StorageBackend, user_id: uuid.UUID | None = None) -> None:
        self.session = session
        self.storage = storage
        self.user_id = user_id

    # ------------------------------------------------------------------ konum
    async def _garden_geojson(self, garden_id: uuid.UUID) -> dict[str, Any]:
        raw = (await self.session.execute(text("SELECT ST_AsGeoJSON(geom) FROM gardens WHERE id = :g"), {"g": garden_id})).scalar_one_or_none()
        if raw is None:
            raise _not_found("Bahçe")
        return json.loads(raw)

    async def _garden_center(self, garden_id: uuid.UUID) -> tuple[float, float]:
        c = shape(await self._garden_geojson(garden_id)).centroid
        return float(c.x), float(c.y)

    async def _check_location(self, garden_id: uuid.UUID, geojson: dict[str, Any]) -> str:
        """GeoJSON Point/Polygon doğrulanır ve bahçeye ≤ 500 m uzaklıkta olmalı. Dönüş: 'nokta' | 'alan'."""
        kind = geojson.get("type")
        if kind not in ("Point", "Polygon"):
            raise _bad("Konum bir nokta ya da çokgen (alan) olmalı.")
        try:
            geom = shape(geojson)
        except Exception as exc:  # noqa: BLE001
            raise _bad("Konum geçerli bir GeoJSON değil.") from exc
        minx, miny, maxx, maxy = geom.bounds
        if not (-180 <= minx <= maxx <= 180 and -90 <= miny <= maxy <= 90) or not geom.is_valid or geom.is_empty:
            raise _bad("Konum geçerli değil (koordinat aralığı ya da çokgen kendini kesiyor).")
        row = (
            await self.session.execute(
                text(
                    "SELECT ST_DWithin(g.geom::geography, ST_SetSRID(ST_GeomFromGeoJSON(:j), 4326)::geography, :d), "
                    "ST_Area(ST_SetSRID(ST_GeomFromGeoJSON(:j), 4326)::geography) FROM gardens g WHERE g.id = :g"
                ),
                {"j": json.dumps(geojson), "d": MAX_LOCATION_DISTANCE_M, "g": garden_id},
            )
        ).one()
        if not row[0]:
            raise _bad(f"Konum bahçeden {MAX_LOCATION_DISTANCE_M} m'den uzakta; haritada bahçenin yakınını işaretleyin.")
        if kind == "Polygon" and float(row[1]) > MAX_AREA_M2:
            raise _bad("Alan çok büyük (en çok 5.000 dekar).")
        return "nokta" if kind == "Point" else "alan"

    # ------------------------------------------------------------------ fotoğraf
    def _photo_url(self, garden_id: uuid.UUID, photo_id: uuid.UUID) -> str:
        return f"/gardens/{garden_id}/saha-fotograflari/{photo_id}"

    async def _photos_of(self, garden_id: uuid.UUID, *, record_ids: list[uuid.UUID] | None = None, verification_ids: list[uuid.UUID] | None = None) -> dict[uuid.UUID, list[FotoYanit]]:
        out: dict[uuid.UUID, list[FotoYanit]] = {}
        if record_ids:
            for p in (await self.session.execute(select(FieldPhotoModel).where(FieldPhotoModel.record_id.in_(record_ids)).order_by(FieldPhotoModel.created_at))).scalars().all():
                out.setdefault(p.record_id, []).append(FotoYanit(id=p.id, url=self._photo_url(garden_id, p.id), boyut_bayt=p.boyut_bayt))  # type: ignore[arg-type]
        if verification_ids:
            for p in (await self.session.execute(select(FieldPhotoModel).where(FieldPhotoModel.verification_id.in_(verification_ids)).order_by(FieldPhotoModel.created_at))).scalars().all():
                out.setdefault(p.verification_id, []).append(FotoYanit(id=p.id, url=self._photo_url(garden_id, p.id), boyut_bayt=p.boyut_bayt))  # type: ignore[arg-type]
        return out

    @staticmethod
    def _reencode(data: bytes) -> bytes:
        """Yüklenen görüntü doğrulanır (JPEG/PNG/WebP), uzun kenar 1600 px'e indirilir ve EXIF (konum dâhil) atılarak JPEG olarak yeniden kodlanır."""
        settings = get_settings()
        if len(data) > settings.field_photo_max_bytes:
            raise _bad(f"Fotoğraf en çok {settings.field_photo_max_bytes // 1_000_000} MB olabilir.")
        try:
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in ("JPEG", "PNG", "WEBP"):
                    raise _bad("Yalnız JPEG, PNG ya da WebP fotoğraf yüklenebilir.")
                image.load()
                rgb = image.convert("RGB")
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise _bad("Dosya geçerli bir fotoğraf değil.") from exc
        rgb.thumbnail((PHOTO_MAX_SIDE, PHOTO_MAX_SIDE))
        buffer = io.BytesIO()
        rgb.save(buffer, format="JPEG", quality=85)  # EXIF kaydedilmez
        return buffer.getvalue()

    async def add_photo(self, garden_id: uuid.UUID, data: bytes, *, record_id: uuid.UUID | None = None, verification_id: uuid.UUID | None = None) -> FotoYanit:
        existing = (
            await self.session.execute(select(func.count()).select_from(FieldPhotoModel).where(FieldPhotoModel.record_id == record_id if record_id else FieldPhotoModel.verification_id == verification_id))
        ).scalar_one()
        if existing >= get_settings().field_photo_max_per_owner:
            raise _bad(f"Bir kayda en çok {get_settings().field_photo_max_per_owner} fotoğraf eklenebilir.")
        encoded = self._reencode(data)
        photo_id = uuid.uuid4()
        key = f"field/{garden_id}/{photo_id}.jpg"
        self.storage.save(key, encoded)
        self.session.add(FieldPhotoModel(id=photo_id, garden_id=garden_id, record_id=record_id, verification_id=verification_id, dosya_yolu=key, icerik_turu="image/jpeg", boyut_bayt=len(encoded)))
        await self.session.flush()
        return FotoYanit(id=photo_id, url=self._photo_url(garden_id, photo_id), boyut_bayt=len(encoded))

    async def photo_bytes(self, garden_id: uuid.UUID, photo_id: uuid.UUID) -> bytes:
        photo = (await self.session.execute(select(FieldPhotoModel).where(FieldPhotoModel.id == photo_id, FieldPhotoModel.garden_id == garden_id))).scalar_one_or_none()
        if photo is None or not self.storage.exists(photo.dosya_yolu):
            raise _not_found("Fotoğraf")
        return self.storage.read(photo.dosya_yolu)

    async def delete_photo(self, garden_id: uuid.UUID, photo_id: uuid.UUID) -> None:
        photo = (await self.session.execute(select(FieldPhotoModel).where(FieldPhotoModel.id == photo_id, FieldPhotoModel.garden_id == garden_id))).scalar_one_or_none()
        if photo is None:
            raise _not_found("Fotoğraf")
        self.storage.delete(photo.dosya_yolu)
        await self.session.delete(photo)
        await self.session.flush()

    # ------------------------------------------------------------------ kayıtlar
    async def _record_response(self, garden_id: uuid.UUID, rows: list[tuple[FieldRecordModel, str | None]]) -> list[KayitYanit]:
        photos = await self._photos_of(garden_id, record_ids=[r.id for r, _ in rows])
        return [
            KayitYanit(
                id=r.id, tur=r.tur, tarih=r.tarih, konum_tur=r.konum_tur, konum=json.loads(geo) if geo else None, aciklama=r.aciklama, ayrinti=r.ayrinti,  # type: ignore[arg-type]
                fotograflar=photos.get(r.id, []), created_at=r.created_at,
            )
            for r, geo in rows
        ]

    async def _record_rows(self, garden_id: uuid.UUID, *extra: Any) -> list[tuple[FieldRecordModel, str | None]]:
        q = select(FieldRecordModel, func.ST_AsGeoJSON(FieldRecordModel.konum)).where(FieldRecordModel.garden_id == garden_id, *extra).order_by(FieldRecordModel.tarih.desc(), FieldRecordModel.created_at.desc())
        return [(r, g) for r, g in (await self.session.execute(q)).all()]

    async def create_record(self, garden_id: uuid.UUID, body: KayitGirdisi) -> KayitYanit:
        kind = await self._check_location(garden_id, body.konum) if body.konum else None
        row = FieldRecordModel(garden_id=garden_id, tur=body.tur, tarih=body.tarih, konum_tur=kind, aciklama=body.aciklama, ayrinti=body.ayrinti, created_by=self.user_id)
        if body.konum:
            row.konum = func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(body.konum)), 4326)
        self.session.add(row)
        await self.session.flush()
        return (await self._record_response(garden_id, await self._record_rows(garden_id, FieldRecordModel.id == row.id)))[0]

    async def list_records(self, garden_id: uuid.UUID, *, tur: str | None = None, since: date | None = None, until: date | None = None) -> list[KayitYanit]:
        extra: list[Any] = []
        if tur:
            extra.append(FieldRecordModel.tur == tur)
        if since:
            extra.append(FieldRecordModel.tarih >= since)
        if until:
            extra.append(FieldRecordModel.tarih <= until)
        return await self._record_response(garden_id, await self._record_rows(garden_id, *extra))

    async def update_record(self, garden_id: uuid.UUID, record_id: uuid.UUID, body: KayitGuncelle) -> KayitYanit:
        row = (await self.session.execute(select(FieldRecordModel).where(FieldRecordModel.id == record_id, FieldRecordModel.garden_id == garden_id))).scalar_one_or_none()
        if row is None:
            raise _not_found("Kayıt")
        fields = body.model_fields_set
        if body.tur is not None:
            row.tur = body.tur
        if body.tarih is not None:
            row.tarih = body.tarih
        if "aciklama" in fields:
            row.aciklama = (body.aciklama or "").strip() or None
        if "ayrinti" in fields:
            row.ayrinti = body.ayrinti
        if body.konumu_sil:
            row.konum, row.konum_tur = None, None
        elif body.konum:
            row.konum_tur = await self._check_location(garden_id, body.konum)
            row.konum = func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(body.konum)), 4326)
        await self.session.flush()
        await self.session.refresh(row)
        return (await self._record_response(garden_id, await self._record_rows(garden_id, FieldRecordModel.id == record_id)))[0]

    async def delete_record(self, garden_id: uuid.UUID, record_id: uuid.UUID) -> None:
        row = (await self.session.execute(select(FieldRecordModel).where(FieldRecordModel.id == record_id, FieldRecordModel.garden_id == garden_id))).scalar_one_or_none()
        if row is None:
            raise _not_found("Kayıt")
        for photo in (await self.session.execute(select(FieldPhotoModel).where(FieldPhotoModel.record_id == record_id))).scalars().all():
            self.storage.delete(photo.dosya_yolu)
        await self.session.delete(row)
        await self.session.flush()

    async def owns_record(self, garden_id: uuid.UUID, record_id: uuid.UUID) -> bool:
        return (await self.session.execute(select(FieldRecordModel.id).where(FieldRecordModel.id == record_id, FieldRecordModel.garden_id == garden_id))).first() is not None

    async def harvest_by_year(self, garden_id: uuid.UUID) -> dict[int, HasatOzeti]:
        """Hasat kayıtlarının yıl özeti (Geçmiş sayfasındaki hasat sütunu). Kayıt yoksa yıl yer almaz → «kayıt yok»."""
        rows = (await self.session.execute(select(FieldRecordModel.tarih).where(FieldRecordModel.garden_id == garden_id, FieldRecordModel.tur == "hasat"))).scalars().all()
        out: dict[int, HasatOzeti] = {}
        for day in rows:
            cur = out.get(day.year)
            out[day.year] = HasatOzeti(durum="kayit", adet=(cur.adet if cur else 0) + 1, son_tarih=max(day, cur.son_tarih) if cur and cur.son_tarih else day)
        return out

    # ------------------------------------------------------------------ doğrulama
    async def verification_results(self, garden_id: uuid.UUID) -> dict[tuple[str, str], str]:
        rows = (await self.session.execute(select(EventVerificationModel.hedef_tur, EventVerificationModel.hedef_anahtar, EventVerificationModel.sonuc).where(EventVerificationModel.garden_id == garden_id))).all()
        return {(t, k): s for t, k, s in rows}

    async def cards(self, garden_id: uuid.UUID) -> list[DogrulamaKarti]:
        """Her olay (doğrulama bekleyenler dâhil), her uyarı ve (hedefi artık görünmeyen) geçmiş doğrulamalar için «Uydu haklı mıydı?» kartı."""
        verifications = {(v.hedef_tur, v.hedef_anahtar): v for v in (await self.session.execute(select(EventVerificationModel).where(EventVerificationModel.garden_id == garden_id))).scalars().all()}
        photos = await self._photos_of(garden_id, verification_ids=[v.id for v in verifications.values()])
        cards: list[DogrulamaKarti] = []
        seen: set[tuple[str, str]] = set()

        def card(hedef_tur: str, anahtar: str, baslik: str, grup: str, start: date, end: date, guven: str | None, durum: str, olay_id: uuid.UUID | None) -> None:
            v = verifications.get((hedef_tur, anahtar))
            seen.add((hedef_tur, anahtar))
            cards.append(
                DogrulamaKarti(
                    hedef_tur=hedef_tur, hedef_anahtar=anahtar, baslik=baslik, tur_grubu=grup, baslangic=start, bitis=end, guven=guven, durum=durum, olay_id=olay_id,  # type: ignore[arg-type]
                    sonuc=v.sonuc if v else None, aciklama=v.aciklama if v else None, dogrulama_id=v.id if v else None, fotograflar=photos.get(v.id, []) if v else [], dogrulandi=v.updated_at if v else None,  # type: ignore[arg-type]
                )
            )

        for e in await list_events(self.session, garden_id):
            card("olay", e.anahtar, event_name(e), fr.tur_grubu(e.tur, e.turler), e.baslangic, e.bitis, e.guven, e.durum, e.id)
        warnings = (await self.session.execute(select(NotificationModel).where(NotificationModel.garden_id == garden_id, ~NotificationModel.dedupe_key.like("%olay:%"), NotificationModel.oncelik.in_(("kritik", "uyari"))).order_by(NotificationModel.created_at.desc()))).scalars().all()
        for n in warnings:
            day = n.created_at.astimezone(TIMEZONE).date()
            card("uyari", n.dedupe_key, n.baslik, "uyari", day, day, None, "uyari", None)
        for (hedef_tur, anahtar), v in verifications.items():  # hedefi artık listelenmeyen (olay yeniden kurulunca kalkmış) doğrulamalar: özet kayıttan
            if (hedef_tur, anahtar) not in seen:
                card(hedef_tur, anahtar, v.baslik, v.tur_grubu, v.baslangic, v.bitis, v.guven, v.durum_anlik, None)
        order = {"bekliyor": 0, "olay": 1, "uyari": 2, "suphe": 3}
        cards.sort(key=lambda c: (c.sonuc is not None, order.get(c.durum, 4), -c.bitis.toordinal()))
        return cards

    async def card_list(self, garden_id: uuid.UUID) -> DogrulamaListesi:
        cards = await self.cards(garden_id)
        return DogrulamaListesi(kartlar=cards, bekleyen=sum(1 for c in cards if c.sonuc is None), not_=NOTE)

    async def verify(self, garden_id: uuid.UUID, body: DogrulamaGirdisi) -> DogrulamaKarti:
        match = next((c for c in await self.cards(garden_id) if c.hedef_tur == body.hedef_tur and c.hedef_anahtar == body.hedef_anahtar), None)
        if match is None:
            raise _not_found("Doğrulanacak olay ya da uyarı")
        existing = (
            await self.session.execute(select(EventVerificationModel).where(EventVerificationModel.garden_id == garden_id, EventVerificationModel.hedef_tur == body.hedef_tur, EventVerificationModel.hedef_anahtar == body.hedef_anahtar))
        ).scalar_one_or_none()
        note = (body.aciklama or "").strip() or None
        if existing is None:
            self.session.add(
                EventVerificationModel(
                    garden_id=garden_id, hedef_tur=body.hedef_tur, hedef_anahtar=body.hedef_anahtar, baslik=match.baslik, tur_grubu=match.tur_grubu, turler=[],
                    baslangic=match.baslangic, bitis=match.bitis, guven=match.guven, durum_anlik=match.durum, sonuc=body.sonuc, aciklama=note, created_by=self.user_id,
                )
            )
        else:
            existing.sonuc, existing.aciklama = body.sonuc, note
        await self.session.flush()
        return next(c for c in await self.cards(garden_id) if c.hedef_tur == body.hedef_tur and c.hedef_anahtar == body.hedef_anahtar)

    async def verification_id(self, garden_id: uuid.UUID, verification_id: uuid.UUID) -> bool:
        return (await self.session.execute(select(EventVerificationModel.id).where(EventVerificationModel.id == verification_id, EventVerificationModel.garden_id == garden_id))).first() is not None

    async def delete_verification(self, garden_id: uuid.UUID, verification_id: uuid.UUID) -> None:
        row = (await self.session.execute(select(EventVerificationModel).where(EventVerificationModel.id == verification_id, EventVerificationModel.garden_id == garden_id))).scalar_one_or_none()
        if row is None:
            raise _not_found("Doğrulama")
        for photo in (await self.session.execute(select(FieldPhotoModel).where(FieldPhotoModel.verification_id == verification_id))).scalars().all():
            self.storage.delete(photo.dosya_yolu)
        await self.session.delete(row)
        await self.session.flush()

    async def accuracy_summary(self, garden_id: uuid.UUID) -> DogrulukOzeti:
        rule = cat.load_catalog().saha
        cards = await self.cards(garden_id)
        summary = fr.accuracy([(c.tur_grubu, c.sonuc) for c in cards if c.durum != "suphe"], rule.dogruluk_asgari_n)
        return DogrulukOzeti(
            turler=[TurOzetiYanit(**s.__dict__) for s in summary], asgari_dogrulama=rule.dogruluk_asgari_n,
            esik_durumu=f"ön değer · {'mühendis onayı bekliyor' if rule.durum == 'dogrulanmadi' else 'mühendis onaylı'}", not_=NOTE,
        )

    # ------------------------------------------------------------------ saha turu
    async def _stress_point(self, garden_id: uuid.UUID, rule: cat.SahaKurali) -> dict[str, Any] | None:
        acq = (
            await self.session.execute(
                select(AcquisitionModel).where(AcquisitionModel.garden_id == garden_id, AcquisitionModel.source_id == S2_SOURCE, AcquisitionModel.durum == ACQ_NET, AcquisitionModel.izgara_yolu.is_not(None)).order_by(AcquisitionModel.tarih.desc()).limit(1)
            )
        ).scalar_one_or_none()
        if acq is None or not acq.izgara_yolu or not self.storage.exists(acq.izgara_yolu):
            return None
        grid = decode_grids(self.storage.read(acq.izgara_yolu)).get("ndvi")
        geometry = await self._garden_geojson(garden_id)
        if grid is None:
            return None
        values = masking.apply(grid, masking.mask_for(geometry)).astype(np.float32)
        patch = fr.stress_patch(values, rule.stres_yuzdelik, rule.stres_min_da)
        if patch is None:
            return None
        lng, lat = pixel_center_lnglat(canonical_grid(geometry), patch.row, patch.col)
        return {
            "anahtar": f"yama:{acq.tarih}", "tur": "stres_yamasi", "baslik": "Stres yaması",
            "neden": f"{acq.tarih:%d.%m.%Y} görüntüsünde bahçenin kendi en zayıf %{rule.stres_yuzdelik:g}'ünün altında, yaklaşık {patch.area_da:.1f} da bitişik yama".replace(".", ","),
            "lng": lng, "lat": lat, "onem": 2,
        }

    async def _weak_zone_points(self, garden_id: uuid.UUID) -> list[dict[str, Any]]:
        settings = get_settings()
        repo = MultiyearRepository(self.session)
        model = await repo.active_result(garden_id, 3)
        if model is None or model.durum != "tamam" or model.homojen:
            return []
        out: list[dict[str, Any]] = []
        for r in await repo.zones(model.id):
            z = r.zone
            if z.tur == "bolge" and z.sinif == 1 and (z.fark_yuzde or 0.0) <= -settings.multiyear_weak_zone_diff_percent and (z.istikrar or 0.0) >= settings.multiyear_stability_mid:
                geom = shape(r.geojson)
                parts = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
                c = max(parts, key=lambda g: g.area).representative_point()
                out.append(
                    {
                        "anahtar": f"bolge:{z.sinif}:{model.versiyon}", "tur": "zayif_kesim", "baslik": "Zayıf kesim",
                        "neden": f"Yıllardır çevresine göre belirgin zayıf kalan kesim (yaklaşık {z.alan_m2 / 1000.0:.1f} da); kontrol önerilir".replace(".", ","), "lng": float(c.x), "lat": float(c.y), "onem": 3,
                    }
                )
        return out

    async def tour(self, garden_id: uuid.UUID, start: tuple[float, float] | None = None) -> SahaTuru:
        rule = cat.load_catalog().saha
        center = await self._garden_center(garden_id)
        candidates: list[dict[str, Any]] = []
        for e in await list_events(self.session, garden_id):
            if e.durum != "bekliyor":
                continue
            lng, lat = (e.ayrinti or {}).get("s2_dusus.merkez_lng"), (e.ayrinti or {}).get("s2_dusus.merkez_lat")
            here = (float(lng), float(lat)) if isinstance(lng, (int, float)) and isinstance(lat, (int, float)) else center
            candidates.append(
                {
                    "anahtar": f"olay:{e.anahtar}", "tur": "bekliyor", "baslik": "Doğrulama bekleyen düşüş",
                    "neden": "Son görüntüde ani canlılık düşüşü görüldü; sonraki net görüntü doğrulayacak. Sahada bakın." + ("" if here != center else " (konum: bahçe geneli)"),
                    "lng": here[0], "lat": here[1], "onem": 4, "olay_anahtar": e.anahtar,
                }
            )
        candidates += await self._weak_zone_points(garden_id)
        stress = await self._stress_point(garden_id, rule)
        if stress:
            candidates.append(stress)
        candidates.sort(key=lambda c: -c["onem"])
        candidates = candidates[: rule.tur_azami_nokta]

        visits = {v.nokta_anahtar: v for v in (await self.session.execute(select(TourVisitModel).where(TourVisitModel.garden_id == garden_id))).scalars().all()}
        pending = [c for c in candidates if c["anahtar"] not in visits]
        done = [c for c in candidates if c["anahtar"] in visits]
        origin = start or center
        coords = [(c["lng"], c["lat"]) for c in pending]
        order = fr.nearest_neighbour(coords, origin)
        leg = fr.legs(coords, order, origin)
        ordered = [pending[i] for i in order]
        points: list[TurNoktasi] = []
        for n, (c, d) in enumerate(zip(ordered, leg, strict=True), start=1):
            points.append(TurNoktasi(anahtar=c["anahtar"], tur=c["tur"], baslik=c["baslik"], neden=c["neden"], lng=c["lng"], lat=c["lat"], sira=n, mesafe_m=round(d), ziyaret_edildi=False, ziyaret_zamani=None, kayit_id=None, olay_anahtar=c.get("olay_anahtar")))
        for k, c in enumerate(done, start=len(points) + 1):
            v = visits[c["anahtar"]]
            points.append(TurNoktasi(anahtar=c["anahtar"], tur=c["tur"], baslik=c["baslik"], neden=c["neden"], lng=c["lng"], lat=c["lat"], sira=k, mesafe_m=0, ziyaret_edildi=True, ziyaret_zamani=v.ziyaret_zamani, kayit_id=v.record_id, olay_anahtar=c.get("olay_anahtar")))
        total = float(sum(leg))
        return SahaTuru(
            noktalar=points, baslangic=NoktaKonumu(lng=origin[0], lat=origin[1]), rota=[[origin[0], origin[1]], *[[p.lng, p.lat] for p in points if not p.ziyaret_edildi]], toplam_m=round(total),
            sure_dk=fr.tour_minutes(total, len(pending), rule.tur_hiz_m_dk, rule.tur_nokta_dk), ziyaret_edilen=len(done),
            esik_durumu=f"ön değer · {'mühendis onayı bekliyor' if rule.durum == 'dogrulanmadi' else 'mühendis onaylı'}", not_=TOUR_NOTE,
        )

    async def set_visit(self, garden_id: uuid.UUID, anahtar: str, *, visited: bool, record_id: uuid.UUID | None) -> None:
        if record_id is not None and not await self.owns_record(garden_id, record_id):
            raise _not_found("Kayıt")
        existing = (await self.session.execute(select(TourVisitModel).where(TourVisitModel.garden_id == garden_id, TourVisitModel.nokta_anahtar == anahtar))).scalar_one_or_none()
        if not visited:
            if existing is not None:
                await self.session.execute(delete(TourVisitModel).where(TourVisitModel.id == existing.id))
            return
        if existing is None:
            self.session.add(TourVisitModel(garden_id=garden_id, nokta_anahtar=anahtar, record_id=record_id, created_by=self.user_id))
        else:
            existing.record_id = record_id or existing.record_id
        await self.session.flush()
