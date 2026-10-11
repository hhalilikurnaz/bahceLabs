"""Görüntü arşivi: bir sezonun (takvim yılı) sahneleri; net / en net işaretleri ve sayfalama. Saf fonksiyonlar."""

from __future__ import annotations

import math
import uuid
from collections.abc import Sequence

from bahcelab_backend.domain.ndvi.indices import TRUE_COLOR
from bahcelab_backend.domain.ndvi.persist import thumbnail_url_path
from bahcelab_backend.domain.ndvi.repository import SceneWithIndices
from bahcelab_backend.domain.ndvi.schemas import ArsivSahne, ArsivYanit


def _is_net(item: SceneWithIndices, net_max: float) -> bool:
    cloud = item.scene.bulut_orani
    return item.scene.durum == "tamam" and (cloud is None or cloud <= net_max)


def _has_image(item: SceneWithIndices, parametre: str) -> bool:
    if item.scene.durum != "tamam":
        return False
    if parametre == TRUE_COLOR:
        return bool(item.scene.gercek_renk_png_yolu)
    row = item.indices.get(parametre)
    return bool(row and row.png_yolu)


def seasons_of(scenes: Sequence[SceneWithIndices]) -> list[int]:
    """Verisi olan sezonlar (yeniden eskiye)."""
    return sorted({s.scene.tarih.year for s in scenes}, reverse=True)


def build_archive(
    garden_id: uuid.UUID,
    scenes: Sequence[SceneWithIndices],
    *,
    parametre: str,
    sezon: int | None,
    sayfa: int,
    boyut: int,
    net_max: float,
) -> ArsivYanit:
    """Seçili sezonun sahneleri (yeniden eskiye). `en_net`: her ayın bulut oranı en düşük net görüntüsü."""
    seasons = seasons_of(scenes)
    season = sezon if sezon is not None else (seasons[0] if seasons else 0)
    year_scenes = sorted((s for s in scenes if s.scene.tarih.year == season), key=lambda s: s.scene.tarih, reverse=True)

    best_per_month: dict[tuple[int, int], SceneWithIndices] = {}
    for item in year_scenes:
        if not (_is_net(item, net_max) and _has_image(item, parametre)):
            continue
        key = (item.scene.tarih.year, item.scene.tarih.month)
        current = best_per_month.get(key)
        cloud = item.scene.bulut_orani if item.scene.bulut_orani is not None else 0.0
        current_cloud = (current.scene.bulut_orani or 0.0) if current else math.inf
        # Eşitlikte daha yeni tarih (liste yeniden eskiye gezildiği için ilk gelen) korunur
        if current is None or cloud < current_cloud:
            best_per_month[key] = item
    best_dates = {item.scene.tarih for item in best_per_month.values()}

    rows: list[ArsivSahne] = []
    for item in year_scenes:
        scene = item.scene
        has_image = _has_image(item, parametre)
        summary = item.indices.get(parametre) if parametre != TRUE_COLOR else None
        rows.append(
            ArsivSahne(
                tarih=scene.tarih,
                durum=scene.durum,  # type: ignore[arg-type]  # veritabanı değerleri şemadaki Literal ile aynı
                deger=summary.ortalama if summary and scene.durum == "tamam" else None,
                bulut_orani=scene.bulut_orani,
                gecerli_piksel_orani=scene.gecerli_piksel_orani,
                net=_is_net(item, net_max),
                en_net=scene.tarih in best_dates,
                kucuk_resim_url=thumbnail_url_path(garden_id, parametre, scene.tarih) if has_image else None,
                ham_veri_var=bool(summary and summary.veri_yolu),
            )
        )

    total = len(rows)
    pages = max(1, math.ceil(total / boyut))
    page = min(max(1, sayfa), pages)
    start = (page - 1) * boyut
    return ArsivYanit(
        parametre=parametre,
        sezon=season,
        sezonlar=seasons,
        toplam=total,
        net_sayisi=sum(1 for r in rows if r.net),
        bulutlu_sayisi=sum(1 for r in rows if r.durum == "bulutlu"),
        sayfa=page,
        boyut=boyut,
        sayfa_sayisi=pages,
        sahneler=rows[start : start + boyut],
    )
