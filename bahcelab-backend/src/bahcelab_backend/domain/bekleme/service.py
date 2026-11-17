from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from bahcelab_backend.domain.bekleme.models import BeklemeListesiModel
from bahcelab_backend.domain.bekleme.schemas import AYDINLATMA_SURUMU, BeklemeBasvurusu


async def basvuru_yaz(session: AsyncSession, basvuru: BeklemeBasvurusu) -> bool:
    """Başvuruyu yazar; e-posta zaten varsa dokunmaz (ilk kayıt korunur). Yeni satır yazıldıysa True."""
    result = await session.execute(
        insert(BeklemeListesiModel)
        .values(email=basvuru.email, il=basvuru.il, urun=basvuru.urun, aydinlatma_surumu=AYDINLATMA_SURUMU)
        .on_conflict_do_nothing(index_elements=[BeklemeListesiModel.email])
        .returning(BeklemeListesiModel.id)
    )
    return result.scalar_one_or_none() is not None
