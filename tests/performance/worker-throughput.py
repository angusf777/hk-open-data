from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "services/worker"))

from hk_data_worker.monitor.evaluator import evaluate  # noqa: E402

from tests.qualification.test_seeded_failures import NOW, baseline, seeds, target  # noqa: E402

started = time.perf_counter()
count = 0
for _ in range(100):
    for seed in seeds():
        evaluate(target(), seed.evidence, baseline(), NOW, seeded_failure=True)
        count += 1
elapsed = time.perf_counter() - started
rate = count / elapsed
if rate < 100:
    raise SystemExit(f"worker throughput {rate:.1f}/s is below 100/s")
print(f'{{"observations":{count},"per_second":{rate:.1f}}}')
