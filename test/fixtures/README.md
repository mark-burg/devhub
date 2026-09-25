# Publisher fixtures

Real output from each tool, generated on a throwaway sample project and trimmed to the files
`scripts/hub.mjs` reads. Large HTML reports are replaced by stub pages.

| Folder | Produced by | Kept verbatim |
|---|---|---|
| `coverage-py/` | coverage.py 7.16 (`coverage json`, `coverage html`) | `coverage.json`; hashed asset name |
| `coverage-py-default/` | coverage.py `coverage html` only (its default output — no numbers) | hashed asset name |
| `cobertura/` | coverage.py `coverage xml` (Cobertura format) | `coverage.xml` |
| `jacoco/` | JaCoCo 0.8.15 CLI | `jacoco.xml`, `jacoco-sessions.html` |
| `junit/` | pytest 8 `--junitxml` (no totals on `<testsuites>`) | `pytest.xml` |
| `allure2/` | allure-commandline 2 | `widgets/summary.json` |
| `allure3-multi/` | Allure 3.18 with the awesome + dashboard plugins | both `summary.json` files |
| `istanbul/`, `lcov/` | c8 (`json-summary`, `lcov` reporters) | `coverage-summary.json`, `lcov.info` |
| `lighthouse/` | Lighthouse 12.8 | categories and scores from the LHR |
| `playwright/` | Playwright 1.63 JSON reporter | `results.json` |
