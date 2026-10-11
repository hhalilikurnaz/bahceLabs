# ADR 0004 — Planlama simülasyonunun arayüzden kaldırılması

**Durum:** kabul (Adım 7B-1)

**Karar.** `/planning` rotaları kapatıldı (`/bahcem`'e yönlendirir) ve hiçbir menü/bağlantı planlamaya götürmez. Kod ve backend uçları silinmedi (`features/planning-simulation`, `domain/planning`); gerektiğinde yeniden açılabilir. Planlama tasarım sistemine taşınmadı; eski paleti token takma adlarıyla ayakta tutuluyordu.

**Sonuç.** Bakım yükü azalır; planlama yeniden açılırsa önce yeni tasarım sistemine taşınmalıdır.
