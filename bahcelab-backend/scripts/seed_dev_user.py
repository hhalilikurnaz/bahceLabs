"""Geliştirme için test kullanıcısı oluşturur: test@bahcelab.com / test1234.

Migration'a gömülmez; yalnızca API_DEBUG=true iken çalışır, böylece bilinen bir şifre
üretim veritabanına yanlışlıkla yazılmaz. Birden fazla çalıştırmak güvenlidir.

Kullanım (bahcelab-backend klasöründen):  make db-seed
"""

import asyncio

from bahcelab_backend.config import get_settings
from bahcelab_backend.database import async_session_factory, engine
from bahcelab_backend.domain.auth.repository import AuthRepository
from bahcelab_backend.domain.auth.security import hash_password

EMAIL = "test@bahcelab.com"
PASSWORD = "test1234"
NAME = "Test Kullanıcı"


async def main() -> None:
    if not get_settings().api_debug:
        raise SystemExit("Reddedildi: seed yalnızca API_DEBUG=true ortamında çalışır.")

    async with async_session_factory() as session:
        repo = AuthRepository(session)
        if await repo.get_user_by_email(EMAIL) is not None:
            print(f"Zaten var: {EMAIL}")
        else:
            created = await repo.create_user_with_workspace(
                name=NAME, email=EMAIL, password_hash=hash_password(PASSWORD)
            )
            print(f"Oluşturuldu: {EMAIL} / {PASSWORD}" if created else "Oluşturulamadı")
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
