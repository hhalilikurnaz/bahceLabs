"""Sahne analizini depolamaya (PNG, ham ızgara) ve veritabanı kayıtlarına çevirir."""

from __future__ import annotations

import uuid
from datetime import date

from bahcelab_backend.domain.ndvi.indices import ALL_OUTPUTS, INDEX_IDS, TRUE_COLOR
from bahcelab_backend.domain.ndvi.models import IndexObservationModel, SceneObservationModel
from bahcelab_backend.domain.ndvi.processing import SceneAnalysis
from bahcelab_backend.domain.ndvi.repository import SceneWithIndices
from bahcelab_backend.shared.storage import StorageBackend


def storage_prefix(garden_id: uuid.UUID) -> str:
    return f"indeks/{garden_id}"


def png_key(garden_id: uuid.UUID, tarih: date, indeks: str) -> str:
    return f"{storage_prefix(garden_id)}/{tarih.isoformat()}/{indeks}.png"


def thumb_key(garden_id: uuid.UUID, tarih: date, indeks: str) -> str:
    return f"{storage_prefix(garden_id)}/{tarih.isoformat()}/{indeks}-kucuk.png"


def grid_key(garden_id: uuid.UUID, tarih: date, indeks: str) -> str:
    return f"{storage_prefix(garden_id)}/{tarih.isoformat()}/{indeks}.bin"


def missing_outputs(item: SceneWithIndices | None) -> set[str]:
    """Bu sahne için henüz üretilmemiş çıktılar. Bulutlu sahnede hiçbir şey beklenmez.

    Eski (yalnızca NDVI) kayıtlarda ham ızgara yoktur (`veri_yolu` boş): yalnızca gereken bantlar
    yeniden okunarak tamamlanır.
    """
    if item is None:
        return set(ALL_OUTPUTS)
    if item.scene.durum == "bulutlu":
        return set()
    missing = {
        index_id
        for index_id in INDEX_IDS
        if index_id not in item.indices or item.indices[index_id].veri_yolu is None
    }
    if not item.scene.gercek_renk_png_yolu:
        missing.add(TRUE_COLOR)
    return missing


def persist_analysis(
    *,
    garden_id: uuid.UUID,
    tarih: date,
    scene_id: str,
    cloud_cover: float | None,
    analysis: SceneAnalysis,
    storage: StorageBackend,
    existing: SceneWithIndices | None,
    source: str = "sentinel-2",
) -> tuple[SceneObservationModel | None, SceneObservationModel | None, list[IndexObservationModel]]:
    """Dosyaları yazar; (yeni sahne satırı, güncellenecek mevcut sahne satırı, indeks satırları) döner."""
    new_scene: SceneObservationModel | None = None
    scene = existing.scene if existing else None

    if scene is None:
        new_scene = scene = SceneObservationModel(
            garden_id=garden_id,
            tarih=tarih,
            scene_id=scene_id,
            durum="bulutlu" if analysis.bulutlu else "tamam",
            bulut_orani=cloud_cover,
            gecerli_piksel_orani=analysis.gecerli_piksel_orani,
            kaynak=source,
        )
    if analysis.bulutlu:
        return new_scene, None, []

    scene.satir = analysis.satir
    scene.sutun = analysis.sutun
    scene.goruntu_koordinatlari = analysis.koordinatlar
    if analysis.gercek_renk_png:
        key = png_key(garden_id, tarih, TRUE_COLOR)
        storage.save(key, analysis.gercek_renk_png)
        scene.gercek_renk_png_yolu = key

    rows: list[IndexObservationModel] = []
    for index_id, result in analysis.indeksler.items():
        png, grid = png_key(garden_id, tarih, index_id), grid_key(garden_id, tarih, index_id)
        storage.save(png, result.png)
        storage.save(grid, result.grid)
        rows.append(
            IndexObservationModel(
                garden_id=garden_id,
                tarih=tarih,
                indeks=index_id,
                ortalama=result.ortalama,
                medyan=result.medyan,
                p10=result.p10,
                p90=result.p90,
                minimum=result.minimum,
                maksimum=result.maksimum,
                png_yolu=png,
                veri_yolu=grid,
                sorunlu_bolge_geojson=result.sorunlu_bolgeler,
            )
        )
    return new_scene, (None if new_scene else scene), rows
