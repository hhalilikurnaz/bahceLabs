"""Bildirim kanalları. Uygulama içi kanal veritabanı kaydıdır (her zaman açık); WhatsApp/SMS (Adım 18) aynı arayüze eklenecek:
`channels.register(MyChannel())` — yalnızca YENİ oluşturulan (tekrar olmayan) bildirimler için çağrılır."""

from __future__ import annotations

import uuid
from typing import Protocol

from bahcelab_backend.domain.notifications.models import NotificationModel


class NotificationChannel(Protocol):
    name: str

    async def deliver(self, workspace_id: uuid.UUID, notification: NotificationModel) -> None: ...


class ChannelRegistry:
    def __init__(self) -> None:
        self._extra: list[NotificationChannel] = []

    def register(self, channel: NotificationChannel) -> None:
        self._extra.append(channel)

    @property
    def extra(self) -> list[NotificationChannel]:
        return list(self._extra)

    async def deliver(self, workspace_id: uuid.UUID, notification: NotificationModel) -> None:
        for channel in self._extra:
            await channel.deliver(workspace_id, notification)


# Süreç genelinde tek kayıt; uygulama içi kanal ayrıca kaydedilmez (kayıt = uygulama içi bildirim)
registry = ChannelRegistry()
