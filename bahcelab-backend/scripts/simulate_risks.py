"""Risk kurallarının yıl boyu simülasyonunu tablo olarak yazdırır (rapor için). Kullanım: python scripts/simulate_risks.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bahcelab_backend.domain.agro.rulebook import load_risk_rules  # noqa: E402
from bahcelab_backend.domain.agro.simulation import simulate_year  # noqa: E402
from tests.support.weather_year import load_year  # noqa: E402

result = simulate_year(load_risk_rules(), load_year(), 2025)
print("| Kural | Düşük | Orta | Yüksek | Yüksek % |\n|---|---|---|---|---|")
for code, counts in result.items():
    total = sum(counts.values())
    print(f"| {code} | {counts['dusuk']} | {counts['orta']} | {counts['yuksek']} | %{100 * counts['yuksek'] / total:.1f} |")
