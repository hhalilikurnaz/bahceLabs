import math
import uuid
from datetime import UTC, datetime

from bahcelab_backend.domain.agro.catalog import load_catalog
from bahcelab_backend.domain.agro.risks import RiskSonucu
from bahcelab_backend.domain.notifications import decision, templates
from bahcelab_backend.domain.notifications.channels import registry
from bahcelab_backend.domain.notifications.models import NotificationModel
from bahcelab_backend.domain.notifications.repository import NotificationRepository
from bahcelab_backend.domain.notifications.schemas import (
    BildirimListesi,
    BildirimYanit,
    DurumDegistir,
    TercihYanit,
    TopluOkundu,
)
from bahcelab_backend.domain.notifications.types import SISTEM_TURU, TYPES, Candidate
from bahcelab_backend.shared.errors import AppError, AppErrorCode


def effective_state(row: NotificationModel) -> str:
    """Süresi dolan erteleme yeniden «olustu» olarak görünür."""
    if row.durum == "ertelendi" and row.ertelendi_bitis is not None and row.ertelendi_bitis <= datetime.now(UTC):
        return "olustu"
    return row.durum


def to_response(row: NotificationModel) -> BildirimYanit:
    state = effective_state(row)
    return BildirimYanit(
        id=row.id, bahce_id=row.garden_id, tur=row.tur, tur_adi=TYPES.get(row.tur, {}).get("ad", row.tur), oncelik=row.oncelik,  # type: ignore[arg-type]
        baslik=row.baslik, metin=row.metin, baglanti=row.baglanti, okundu=state != "olustu", sistem=row.tur == SISTEM_TURU, durum=state, ogeler=list(row.ayrinti or []),  # type: ignore[arg-type]
        ertelendi_bitis=row.ertelendi_bitis if state == "ertelendi" else None, olusturma=row.created_at,
    )


class NotificationService:
    def __init__(self, repo: NotificationRepository) -> None:
        self.repo = repo

    async def list_page(
        self, *, tur: str | None, garden_id: uuid.UUID | None, unread_only: bool, page: int, size: int, durum: str = "aktif"
    ) -> BildirimListesi:
        if tur is not None and tur not in TYPES:
            raise AppError(422, AppErrorCode.VALIDATION_ERROR, "Bilinmeyen bildirim türü.")
        rows, total = await self.repo.page(tur=tur, garden_id=garden_id, unread_only=unread_only, page=page, size=size, durum=durum)
        return BildirimListesi(
            sayfa=page, boyut=size, toplam=total, sayfa_sayisi=max(1, math.ceil(total / size)),
            okunmamis_sayisi=await self.repo.unread_count(),
            okunmamis_urun_sayisi=await self.repo.unread_count(sistem=False), okunmamis_sistem_sayisi=await self.repo.unread_count(sistem=True),
            ogeler=[to_response(r) for r in rows],
        )

    async def unread_count(self) -> int:
        return await self.repo.unread_count()

    async def mark_read(self, notification_id: uuid.UUID) -> BildirimYanit:
        row = await self.repo.get(notification_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bildirim bulunamadı.")
        await self.repo.mark_read(row)
        return to_response(row)

    async def set_state(self, notification_id: uuid.UUID, body: DurumDegistir) -> BildirimYanit:
        row = await self.repo.get(notification_id)
        if row is None:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bildirim bulunamadı.")
        await self.repo.set_state(row, body.durum, body.erteleme_gun)
        return to_response(row)

    async def mark_all_read(self, *, tur: str | None, garden_id: uuid.UUID | None) -> TopluOkundu:
        updated = await self.repo.mark_all_read(tur=tur, garden_id=garden_id)
        return TopluOkundu(guncellenen=updated, okunmamis_sayisi=await self.repo.unread_count())

    async def preferences(self) -> list[TercihYanit]:
        saved = await self.repo.preferences()
        return [TercihYanit(tur=k, ad=v["ad"], aciklama=v["aciklama"], acik=saved.get(k, True)) for k, v in TYPES.items()]

    async def set_preference(self, tur: str, enabled: bool) -> list[TercihYanit]:
        if tur not in TYPES:
            raise AppError(404, AppErrorCode.NOT_FOUND, "Bilinmeyen bildirim türü.")
        await self.repo.set_preference(tur, enabled)
        return await self.preferences()

    async def reconcile_risks(self, garden_id: uuid.UUID, garden_name: str, risks: list[RiskSonucu]) -> int:
        """Zararlı/hastalık riski bildirimi riskin SEVİYESİNİ izler; bahçe + risk başına tek bildirim (anahtar `risk:<bahçe>:<kod>`).

        yüksek: yoksa oluşturulur; sistem tarafından çözülmüşse yeniden açılır (kullanıcı elle çözdüyse risk sürerken açılmaz).
        orta: var olan aktif bildirim «orta risk» olarak güncellenir; yeni bildirim üretilmez.
        düşük / veri yok / risk yok: var olan aktif bildirim otomatik «çözüldü» olur. Dönüş: yeni oluşturulan sayısı."""
        prefs = await self.repo.preferences()
        created = 0
        for risk in risks:
            key = f"risk:{garden_id}:{risk.kod}"
            level = risk.seviye if risk.veri_yeterli else "dusuk"
            existing = await self.repo.by_key(key)
            title = f"{garden_name}: {risk.ad} – {'yüksek' if level == 'yuksek' else 'orta'} risk"
            if level in ("yuksek", "orta") and not prefs.get("zararli_riski", True):
                continue
            if level == "yuksek":
                if existing is None:
                    row = await self.repo.insert_if_new(Candidate(garden_id, "zararli_riski", "kritik", title, risk.sade, "hava", key))
                    if row is not None:
                        created += 1
                        await registry.deliver(self.repo.workspace_id, row)
                elif existing.oncelik != "kritik":  # özette bekleyen / önemli seviyesindeki risk yüksek oldu: kritik, anında
                    await self.repo.update_risk(existing, title, risk.sade, reopen=False)
                    await self.repo.escalate(existing)
                    created += 1
                    await registry.deliver(self.repo.workspace_id, existing)
                else:
                    await self.repo.update_risk(existing, title, risk.sade, reopen=existing.durum == "cozuldu" and existing.otomatik_cozuldu)
            elif level == "orta":
                if existing is None:  # orta risk: ÖNEMLİ, günlük özette (anında değil)
                    row = await self.repo.insert_if_new(Candidate(garden_id, "zararli_riski", "onemli", title, risk.sade, "hava", key), teslim="ozet")
                    if row is not None:
                        created += 1
                elif existing.durum != "cozuldu":
                    await self.repo.update_risk(existing, title, risk.sade, reopen=False)
            elif existing is not None and existing.durum != "cozuldu":
                await self.repo.resolve_auto(existing)
        return created

    async def publish_operational(self, candidates: list[Candidate]) -> list[NotificationModel]:
        """İşletme bildirimi (veri akışı kesildi/başarısız): günlük özeti BEKLEMEZ, listede ANINDA görünür (tercihi kapalıysa atlanır). Aynı anahtar için tek bildirim."""
        prefs = await self.repo.preferences()
        created: list[NotificationModel] = []
        for candidate in candidates:
            if not prefs.get(candidate.tur, True):
                continue
            row = await self.repo.insert_if_new(candidate, teslim="anlik")
            if row is not None:
                created.append(row)
        return created

    async def publish(self, candidates: list[Candidate]) -> list[NotificationModel]:
        """Karar katmanı: tercihi kapalı türler atlanır; kritik ANINDA (kanallara iletilir), önemli ve bilgi günlük özete bırakılır.
        Aynı olay (dedupe) için yalnızca ilk çağrı kayıt üretir."""
        prefs = await self.repo.preferences()
        rule = load_catalog().bildirim
        created: list[NotificationModel] = []
        for candidate in candidates:
            if not prefs.get(candidate.tur, True):
                continue
            teslim = "anlik" if decision.delivery(candidate.oncelik, rule) == "hemen" else "ozet"
            row = await self.repo.insert_if_new(candidate, teslim=teslim)
            if row is not None:
                created.append(row)
                if teslim == "anlik":
                    await registry.deliver(self.repo.workspace_id, row)
        return created

    async def build_digest(self, now_local: datetime) -> NotificationModel | None:
        """Günlük TEK özet: bekleyen önemli ve bilgi maddelerini şablonla birleştirir. Vakti gelmediyse, sessiz saatteyse, bugün üretildiyse ya da madde yoksa None. İdempotent."""
        rule = load_catalog().bildirim
        key = f"ozet:{self.repo.workspace_id}:{now_local.date().isoformat()}"
        if not decision.digest_due(now_local.hour, now_local.date(), now_local.date() if await self.repo.by_key(key) is not None else None, rule):
            return None
        prefs = await self.repo.preferences()
        items = sorted(await self.repo.pending_digest_items(), key=lambda i: (0 if i.oncelik == "onemli" else 1, i.created_at, i.baslik))  # önemliler önce
        if not items or not prefs.get("ozet", True):
            return None
        title, body = templates.digest_text(now_local.date(), [(i.oncelik, i.baslik, i.baglanti) for i in items], rule)
        candidate = Candidate(None, "ozet", "onemli" if any(i.oncelik == "onemli" for i in items) else "bilgi", title, body, "durum", key)
        row = await self.repo.insert_if_new(candidate, teslim="anlik")
        if row is None:
            return None
        row.baglanti = "/bahceler"
        await self.repo.set_digest_detail(row, [{"onem": i.oncelik, "baslik": i.baslik, "metin": i.metin, "baglanti": i.baglanti, "tur": i.tur} for i in items])
        await self.repo.attach_digest(items, row.id)
        await registry.deliver(self.repo.workspace_id, row)
        return row
