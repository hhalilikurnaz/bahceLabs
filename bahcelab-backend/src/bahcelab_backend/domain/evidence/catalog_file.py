"""Elle derlenmiş kamu kayıtları kataloğu (JSON). Boş katalog geçerlidir: «kanıt yok» üretir, asla kayıt uydurulmaz."""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from bahcelab_backend.domain.evidence.types import PublicRecord

CATALOG_PATH = Path(__file__).with_name("dis_olay_katalogu.json")


def parse_records(raw: dict) -> list[PublicRecord]:
    """Her satır kaynak URL'si taşımalıdır; taşımayan satır reddedilir (ValueError)."""
    out: list[PublicRecord] = []
    for i, r in enumerate(raw.get("kayitlar", [])):
        url = str(r.get("url") or "").strip()
        if not url.startswith(("http://", "https://")):
            raise ValueError(f"Katalog satırı {i + 1}: kaynak URL'si zorunlu")
        duzey = str(r.get("yer_duzeyi") or "ilce")
        if duzey not in ("il", "ilce"):
            raise ValueError(f"Katalog satırı {i + 1}: yer_duzeyi il | ilce olmalı")
        end = date.fromisoformat(r["tarih_bitis"]) if r.get("tarih_bitis") else None
        out.append(PublicRecord(date.fromisoformat(r["tarih"]), str(r["olay_turu"]), str(r["yer"]), str(r["kaynak"]), url, str(r.get("not") or ""), end, duzey))  # type: ignore[arg-type]
    return out


@lru_cache(maxsize=1)
def load_public_records() -> tuple[PublicRecord, ...]:
    return tuple(parse_records(json.loads(CATALOG_PATH.read_text(encoding="utf-8"))))
