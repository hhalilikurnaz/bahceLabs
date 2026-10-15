"""Bildirim metin şablonları (SAF): serbest metin üretimi YOKTUR; her metin şablon + veriden kurulur. Kanal soyutlaması aynı metni kullanır (uygulama içi, ileride WhatsApp/SMS)."""

from __future__ import annotations

from datetime import date

from bahcelab_backend.domain.agro.catalog import BildirimKurali

AY = ("Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara")
TR_TIER = {"iyi": "İyi", "izle": "İzle", "dikkat": "Dikkat", "sorun": "Sorun"}
EVENT_TITLES = {
    "don": "don olayı", "asiri_yagis": "aşırı yağış olayı", "ruzgar": "kuvvetli rüzgâr olayı", "s2_dusus": "uydu görüntüsünde ani canlılık düşüşü", "radar_degisim": "radarla ani değişim",
}
EVENT_BODIES = {
    "don": "Sıcaklık {en_dusuk_c} °C'ye indi{siddetli}. Don hasarı için yaprak ve sürgünleri sahada kontrol edin.",
    "asiri_yagis": "24 saatte yaklaşık {yagis_mm} mm yağış. Su birikmesi ve sürgün hasarı için sahayı kontrol edin.",
    "ruzgar": "Rüzgâr hamlesi {hamle_kmh} km/s'e ulaştı. Kırılan dal ve devrilen destekleri kontrol edin.",
    "s2_dusus": "{alan_da} da alanda canlılık bu dönemin normalinin altına indi ve sürdü. Sahada kontrol edin.",
    "radar_degisim": "Radar geri saçılımında belirgin değişim ({alan_da} da). Sahada kontrol edin.",
}


def day_text(d: date) -> str:
    return f"{d.day} {AY[d.month - 1]}"


def span_text(start: date, end: date) -> str:
    return day_text(start) if start == end else f"{day_text(start)}–{day_text(end)}"


def tr_number(v: float, digits: int = 1) -> str:
    return f"{v:.{digits}f}".replace(".", ",")


def event_text(garden: str, tur: str, start: date, end: date, data: dict[str, float | str | None], *, forecast: bool = False, severe: bool = False, pending: bool = False, damage: bool = False) -> tuple[str, str]:
    """Olay bildirimi: başlık «<Bahçe>: <tarih> <tür>», gövde şablondan. Eksik veri alanı boş geçilir, uydurulmaz."""
    body = EVENT_BODIES[tur].format(
        en_dusuk_c=tr_number(float(data.get("en_dusuk_c") or 0)), siddetli=" (şiddetli)" if severe else "", yagis_mm=tr_number(float(data.get("yagis_mm") or 0), 0),
        hamle_kmh=tr_number(float(data.get("hamle_kmh") or 0), 0), alan_da=tr_number(float(data.get("alan_da") or 0)),
    )
    prefix = "Tahmin: " if forecast else ""
    title = f"{garden}: {prefix}{span_text(start, end)} {EVENT_TITLES[tur]}"
    if damage:  # don + optik hasar izi
        title = f"{garden}: {span_text(start, end)} don + optik hasar izi"
        body += " Uydu görüntüsünde canlılık düşüşü de görüldü."
    if pending:
        title += " (doğrulama bekliyor)"
        body += " Sonraki net uydu görüntüsü doğrulayacak; doğrulanmazsa bildirim atmosfer notuyla kapanır."
    return title, body


def tier_text(garden: str, old: str, new: str, sentences: list[str]) -> tuple[str, str]:
    return f"{garden}: durum {TR_TIER[old]} → {TR_TIER[new]}", " ".join(sentences[:2])


def digest_text(day: date, items: list[tuple[str, str, str]], rule: BildirimKurali) -> tuple[str, str]:
    """Günlük özet: (başlık, gövde). `items`: (önem, başlık, bağlantı) — önemliler önce. Gövde madde başına tek satır; fazlası «+N madde daha»."""
    important = [i for i in items if i[0] == "onemli"]
    info = [i for i in items if i[0] != "onemli"]
    head = f"Günlük özet · {day_text(day)}: {len(important)} önemli, {len(info)} bilgi"
    ordered = [*important, *info]
    lines = [f"• {title}" for _, title, _ in ordered[: rule.ozet_azami_madde]]
    if len(ordered) > rule.ozet_azami_madde:
        lines.append(f"+{len(ordered) - rule.ozet_azami_madde} madde daha")
    return head, "\n".join(lines)
