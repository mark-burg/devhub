window.BENCHMARK_DATA = {
  "lastUpdate": 1789732800000,
  "repoUrl": "https://github.com/OWNER/REPO",
  "entries": {
    "Shop Web (benchmark.js)": [
      {
        "commit": {
          "id": "0e43b85cc8aad35bb0a7ec18eba9ee55d52464e8",
          "message": "Add saved-card checkout",
          "url": "https://github.com/OWNER/REPO/commit/0e43b85cc8aad35bb0a7ec18eba9ee55d52464e8",
          "timestamp": "2026-08-01T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1785589200000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 49084,
            "unit": "ops/sec",
            "range": "±2.26%"
          },
          {
            "name": "search.rank",
            "value": 8778.7,
            "unit": "ops/sec",
            "range": "±1.05%"
          },
          {
            "name": "render.productGrid",
            "value": 14.269,
            "unit": "ms",
            "range": "±1.52%"
          },
          {
            "name": "json.parse catalog",
            "value": 31.302,
            "unit": "ms",
            "range": "±0.89%"
          }
        ]
      },
      {
        "commit": {
          "id": "e055ae8264565893e7daa88bf6b49556ce1d1621",
          "message": "Fix flaky cart test",
          "url": "https://github.com/OWNER/REPO/commit/e055ae8264565893e7daa88bf6b49556ce1d1621",
          "timestamp": "2026-08-03T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1785762000000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 50113,
            "unit": "ops/sec",
            "range": "±0.94%"
          },
          {
            "name": "search.rank",
            "value": 9196.4,
            "unit": "ops/sec",
            "range": "±0.79%"
          },
          {
            "name": "render.productGrid",
            "value": 14.151,
            "unit": "ms",
            "range": "±1.69%"
          },
          {
            "name": "json.parse catalog",
            "value": 30.587,
            "unit": "ms",
            "range": "±2.34%"
          }
        ]
      },
      {
        "commit": {
          "id": "eeeec4031093b7b3e35e170eae0e3f9a43390cbb",
          "message": "Memoize price formatter",
          "url": "https://github.com/OWNER/REPO/commit/eeeec4031093b7b3e35e170eae0e3f9a43390cbb",
          "timestamp": "2026-08-05T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1785934800000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 48193,
            "unit": "ops/sec",
            "range": "±0.57%"
          },
          {
            "name": "search.rank",
            "value": 8816.3,
            "unit": "ops/sec",
            "range": "±2.34%"
          },
          {
            "name": "render.productGrid",
            "value": 13.781,
            "unit": "ms",
            "range": "±1.88%"
          },
          {
            "name": "json.parse catalog",
            "value": 32.49,
            "unit": "ms",
            "range": "±0.57%"
          }
        ]
      },
      {
        "commit": {
          "id": "edffc63be636e859b5b634ffade3a278cf7272a8",
          "message": "Search: debounce",
          "url": "https://github.com/OWNER/REPO/commit/edffc63be636e859b5b634ffade3a278cf7272a8",
          "timestamp": "2026-08-07T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1786107600000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 48437,
            "unit": "ops/sec",
            "range": "±1.51%"
          },
          {
            "name": "search.rank",
            "value": 9287.2,
            "unit": "ops/sec",
            "range": "±1.22%"
          },
          {
            "name": "render.productGrid",
            "value": 14.485,
            "unit": "ms",
            "range": "±0.55%"
          },
          {
            "name": "json.parse catalog",
            "value": 30.993,
            "unit": "ms",
            "range": "±1.58%"
          }
        ]
      },
      {
        "commit": {
          "id": "3b43a61cdeeaf0c9be0211109f323a37f6ac6603",
          "message": "Checkout v2 form",
          "url": "https://github.com/OWNER/REPO/commit/3b43a61cdeeaf0c9be0211109f323a37f6ac6603",
          "timestamp": "2026-08-09T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1786280400000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 49386,
            "unit": "ops/sec",
            "range": "±2.45%"
          },
          {
            "name": "search.rank",
            "value": 8847,
            "unit": "ops/sec",
            "range": "±2.35%"
          },
          {
            "name": "render.productGrid",
            "value": 14.21,
            "unit": "ms",
            "range": "±0.74%"
          },
          {
            "name": "json.parse catalog",
            "value": 30.77,
            "unit": "ms",
            "range": "±1.71%"
          }
        ]
      },
      {
        "commit": {
          "id": "214a87f16500613ecc6dfca956779baabedf77ff",
          "message": "Cache product images",
          "url": "https://github.com/OWNER/REPO/commit/214a87f16500613ecc6dfca956779baabedf77ff",
          "timestamp": "2026-08-11T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1786453200000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 47652,
            "unit": "ops/sec",
            "range": "±0.66%"
          },
          {
            "name": "search.rank",
            "value": 8985.5,
            "unit": "ops/sec",
            "range": "±2.27%"
          },
          {
            "name": "render.productGrid",
            "value": 14.437,
            "unit": "ms",
            "range": "±1.98%"
          },
          {
            "name": "json.parse catalog",
            "value": 32.647,
            "unit": "ms",
            "range": "±2.07%"
          }
        ]
      },
      {
        "commit": {
          "id": "33c1ecab87d9d4a66393ed5ae14e0260be23fb21",
          "message": "Tighten coupon validation",
          "url": "https://github.com/OWNER/REPO/commit/33c1ecab87d9d4a66393ed5ae14e0260be23fb21",
          "timestamp": "2026-08-13T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1786626000000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 48688,
            "unit": "ops/sec",
            "range": "±0.53%"
          },
          {
            "name": "search.rank",
            "value": 9327.1,
            "unit": "ops/sec",
            "range": "±1.68%"
          },
          {
            "name": "render.productGrid",
            "value": 14.485,
            "unit": "ms",
            "range": "±0.76%"
          },
          {
            "name": "json.parse catalog",
            "value": 31.075,
            "unit": "ms",
            "range": "±1.93%"
          }
        ]
      },
      {
        "commit": {
          "id": "f89cbb910939439ad3e0b6cac1e8d6dcbed3b22f",
          "message": "Upgrade to Node 24",
          "url": "https://github.com/OWNER/REPO/commit/f89cbb910939439ad3e0b6cac1e8d6dcbed3b22f",
          "timestamp": "2026-08-15T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1786798800000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 49954,
            "unit": "ops/sec",
            "range": "±0.61%"
          },
          {
            "name": "search.rank",
            "value": 8792,
            "unit": "ops/sec",
            "range": "±1.02%"
          },
          {
            "name": "render.productGrid",
            "value": 14.701,
            "unit": "ms",
            "range": "±2.24%"
          },
          {
            "name": "json.parse catalog",
            "value": 32.651,
            "unit": "ms",
            "range": "±1.05%"
          }
        ]
      },
      {
        "commit": {
          "id": "30782573001a7cb8b69fcfb9c21ba6867111553a",
          "message": "Virtualize product grid",
          "url": "https://github.com/OWNER/REPO/commit/30782573001a7cb8b69fcfb9c21ba6867111553a",
          "timestamp": "2026-08-17T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1786971600000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 46756,
            "unit": "ops/sec",
            "range": "±0.60%"
          },
          {
            "name": "search.rank",
            "value": 8737.2,
            "unit": "ops/sec",
            "range": "±2.17%"
          },
          {
            "name": "render.productGrid",
            "value": 14.62,
            "unit": "ms",
            "range": "±0.59%"
          },
          {
            "name": "json.parse catalog",
            "value": 32.176,
            "unit": "ms",
            "range": "±1.14%"
          }
        ]
      },
      {
        "commit": {
          "id": "6ec0f3a602cc3dd5744eda7dddcfb4b5d2dad7cd",
          "message": "Faster catalog parser",
          "url": "https://github.com/OWNER/REPO/commit/6ec0f3a602cc3dd5744eda7dddcfb4b5d2dad7cd",
          "timestamp": "2026-08-19T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1787144400000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 46436,
            "unit": "ops/sec",
            "range": "±0.96%"
          },
          {
            "name": "search.rank",
            "value": 8878.3,
            "unit": "ops/sec",
            "range": "±0.55%"
          },
          {
            "name": "render.productGrid",
            "value": 14.288,
            "unit": "ms",
            "range": "±2.12%"
          },
          {
            "name": "json.parse catalog",
            "value": 22.274,
            "unit": "ms",
            "range": "±2.21%"
          }
        ]
      },
      {
        "commit": {
          "id": "dd38768c8673bc4498f9599a92315ada65622076",
          "message": "Profile: avatar cropping",
          "url": "https://github.com/OWNER/REPO/commit/dd38768c8673bc4498f9599a92315ada65622076",
          "timestamp": "2026-08-21T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1787317200000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 46625,
            "unit": "ops/sec",
            "range": "±1.77%"
          },
          {
            "name": "search.rank",
            "value": 9029.8,
            "unit": "ops/sec",
            "range": "±1.41%"
          },
          {
            "name": "render.productGrid",
            "value": 13.745,
            "unit": "ms",
            "range": "±2.18%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.652,
            "unit": "ms",
            "range": "±1.11%"
          }
        ]
      },
      {
        "commit": {
          "id": "136399cc7da19be9f4f014deb838c2ca9f40b89b",
          "message": "Inline critical CSS",
          "url": "https://github.com/OWNER/REPO/commit/136399cc7da19be9f4f014deb838c2ca9f40b89b",
          "timestamp": "2026-08-23T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1787490000000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 48901,
            "unit": "ops/sec",
            "range": "±0.59%"
          },
          {
            "name": "search.rank",
            "value": 9250.2,
            "unit": "ops/sec",
            "range": "±2.46%"
          },
          {
            "name": "render.productGrid",
            "value": 14.593,
            "unit": "ms",
            "range": "±1.86%"
          },
          {
            "name": "json.parse catalog",
            "value": 22.168,
            "unit": "ms",
            "range": "±0.94%"
          }
        ]
      },
      {
        "commit": {
          "id": "a970daf4bf99337609cd149654156a8869ef7dfa",
          "message": "Add saved-card checkout",
          "url": "https://github.com/OWNER/REPO/commit/a970daf4bf99337609cd149654156a8869ef7dfa",
          "timestamp": "2026-08-25T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1787662800000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 56442,
            "unit": "ops/sec",
            "range": "±1.76%"
          },
          {
            "name": "search.rank",
            "value": 8774.3,
            "unit": "ops/sec",
            "range": "±1.07%"
          },
          {
            "name": "render.productGrid",
            "value": 13.664,
            "unit": "ms",
            "range": "±2.18%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.365,
            "unit": "ms",
            "range": "±0.98%"
          }
        ]
      },
      {
        "commit": {
          "id": "a342c49c0decf120f748dbc019b146caa2ef9b2e",
          "message": "Fix flaky cart test",
          "url": "https://github.com/OWNER/REPO/commit/a342c49c0decf120f748dbc019b146caa2ef9b2e",
          "timestamp": "2026-08-27T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1787835600000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 55327,
            "unit": "ops/sec",
            "range": "±1.19%"
          },
          {
            "name": "search.rank",
            "value": 9243.4,
            "unit": "ops/sec",
            "range": "±1.34%"
          },
          {
            "name": "render.productGrid",
            "value": 14.159,
            "unit": "ms",
            "range": "±2.47%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.958,
            "unit": "ms",
            "range": "±1.60%"
          }
        ]
      },
      {
        "commit": {
          "id": "a122d5f827808d631a62d0ebeaad4a701108135a",
          "message": "Memoize price formatter",
          "url": "https://github.com/OWNER/REPO/commit/a122d5f827808d631a62d0ebeaad4a701108135a",
          "timestamp": "2026-08-29T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1788008400000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 55713,
            "unit": "ops/sec",
            "range": "±0.99%"
          },
          {
            "name": "search.rank",
            "value": 9257.2,
            "unit": "ops/sec",
            "range": "±2.00%"
          },
          {
            "name": "render.productGrid",
            "value": 14.405,
            "unit": "ms",
            "range": "±2.23%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.486,
            "unit": "ms",
            "range": "±1.06%"
          }
        ]
      },
      {
        "commit": {
          "id": "86968ed65fbe3feb9ae277cbb904c808e0fa8dee",
          "message": "Search: debounce",
          "url": "https://github.com/OWNER/REPO/commit/86968ed65fbe3feb9ae277cbb904c808e0fa8dee",
          "timestamp": "2026-08-31T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1788181200000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 54853,
            "unit": "ops/sec",
            "range": "±2.01%"
          },
          {
            "name": "search.rank",
            "value": 9000.4,
            "unit": "ops/sec",
            "range": "±1.90%"
          },
          {
            "name": "render.productGrid",
            "value": 13.733,
            "unit": "ms",
            "range": "±1.32%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.308,
            "unit": "ms",
            "range": "±1.11%"
          }
        ]
      },
      {
        "commit": {
          "id": "556066cd079a21604a2fe826b46463039a0f11ba",
          "message": "Checkout v2 form",
          "url": "https://github.com/OWNER/REPO/commit/556066cd079a21604a2fe826b46463039a0f11ba",
          "timestamp": "2026-09-02T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1788354000000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 57694,
            "unit": "ops/sec",
            "range": "±1.66%"
          },
          {
            "name": "search.rank",
            "value": 9420.5,
            "unit": "ops/sec",
            "range": "±0.62%"
          },
          {
            "name": "render.productGrid",
            "value": 7.6501,
            "unit": "ms",
            "range": "±0.83%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.815,
            "unit": "ms",
            "range": "±1.15%"
          }
        ]
      },
      {
        "commit": {
          "id": "3028f28a2eabfb267426caadd805fabd6c580808",
          "message": "Cache product images",
          "url": "https://github.com/OWNER/REPO/commit/3028f28a2eabfb267426caadd805fabd6c580808",
          "timestamp": "2026-09-04T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1788526800000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 56832,
            "unit": "ops/sec",
            "range": "±1.27%"
          },
          {
            "name": "search.rank",
            "value": 8848.9,
            "unit": "ops/sec",
            "range": "±1.50%"
          },
          {
            "name": "render.productGrid",
            "value": 7.6134,
            "unit": "ms",
            "range": "±1.56%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.346,
            "unit": "ms",
            "range": "±0.55%"
          }
        ]
      },
      {
        "commit": {
          "id": "c8cdabd6e5501109a300bfedfb89157889a8b5d0",
          "message": "Tighten coupon validation",
          "url": "https://github.com/OWNER/REPO/commit/c8cdabd6e5501109a300bfedfb89157889a8b5d0",
          "timestamp": "2026-09-06T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1788699600000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 54786,
            "unit": "ops/sec",
            "range": "±1.84%"
          },
          {
            "name": "search.rank",
            "value": 9449.8,
            "unit": "ops/sec",
            "range": "±0.91%"
          },
          {
            "name": "render.productGrid",
            "value": 7.5032,
            "unit": "ms",
            "range": "±0.93%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.237,
            "unit": "ms",
            "range": "±1.39%"
          }
        ]
      },
      {
        "commit": {
          "id": "a96d0dd753a14a19e0e390e949586fdfe0488293",
          "message": "Upgrade to Node 24",
          "url": "https://github.com/OWNER/REPO/commit/a96d0dd753a14a19e0e390e949586fdfe0488293",
          "timestamp": "2026-09-08T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1788872400000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 56397,
            "unit": "ops/sec",
            "range": "±1.72%"
          },
          {
            "name": "search.rank",
            "value": 9347.9,
            "unit": "ops/sec",
            "range": "±1.21%"
          },
          {
            "name": "render.productGrid",
            "value": 7.5688,
            "unit": "ms",
            "range": "±0.84%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.588,
            "unit": "ms",
            "range": "±0.60%"
          }
        ]
      },
      {
        "commit": {
          "id": "ebad19d275caf02dd9187ba4116eadedb5acb8ab",
          "message": "Virtualize product grid",
          "url": "https://github.com/OWNER/REPO/commit/ebad19d275caf02dd9187ba4116eadedb5acb8ab",
          "timestamp": "2026-09-10T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1789045200000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 57286,
            "unit": "ops/sec",
            "range": "±0.85%"
          },
          {
            "name": "search.rank",
            "value": 9378.3,
            "unit": "ops/sec",
            "range": "±1.96%"
          },
          {
            "name": "render.productGrid",
            "value": 7.627,
            "unit": "ms",
            "range": "±1.25%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.416,
            "unit": "ms",
            "range": "±2.20%"
          }
        ]
      },
      {
        "commit": {
          "id": "35dbb1ac0b62037f9a063f13a4f23d6f40d65eab",
          "message": "Faster catalog parser",
          "url": "https://github.com/OWNER/REPO/commit/35dbb1ac0b62037f9a063f13a4f23d6f40d65eab",
          "timestamp": "2026-09-12T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1789218000000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 57662,
            "unit": "ops/sec",
            "range": "±1.18%"
          },
          {
            "name": "search.rank",
            "value": 9383.6,
            "unit": "ops/sec",
            "range": "±1.96%"
          },
          {
            "name": "render.productGrid",
            "value": 7.4977,
            "unit": "ms",
            "range": "±1.54%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.255,
            "unit": "ms",
            "range": "±1.45%"
          }
        ]
      },
      {
        "commit": {
          "id": "5b70fec898ad5afbbdbd186f2b5870a171029bd3",
          "message": "Profile: avatar cropping",
          "url": "https://github.com/OWNER/REPO/commit/5b70fec898ad5afbbdbd186f2b5870a171029bd3",
          "timestamp": "2026-09-14T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1789390800000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 54854,
            "unit": "ops/sec",
            "range": "±1.29%"
          },
          {
            "name": "search.rank",
            "value": 8780.2,
            "unit": "ops/sec",
            "range": "±2.29%"
          },
          {
            "name": "render.productGrid",
            "value": 8.0224,
            "unit": "ms",
            "range": "±1.59%"
          },
          {
            "name": "json.parse catalog",
            "value": 22.832,
            "unit": "ms",
            "range": "±2.45%"
          }
        ]
      },
      {
        "commit": {
          "id": "d3b8f4d2f67038bd58c7fa77550756c8e23c496a",
          "message": "Inline critical CSS",
          "url": "https://github.com/OWNER/REPO/commit/d3b8f4d2f67038bd58c7fa77550756c8e23c496a",
          "timestamp": "2026-09-16T12:00:00.000Z",
          "author": {
            "name": "dev"
          }
        },
        "date": 1789563600000,
        "tool": "benchmarkjs",
        "benches": [
          {
            "name": "cart.total (1k items)",
            "value": 56900,
            "unit": "ops/sec",
            "range": "±1.14%"
          },
          {
            "name": "search.rank",
            "value": 8826.6,
            "unit": "ops/sec",
            "range": "±1.30%"
          },
          {
            "name": "render.productGrid",
            "value": 7.8089,
            "unit": "ms",
            "range": "±2.01%"
          },
          {
            "name": "json.parse catalog",
            "value": 21.362,
            "unit": "ms",
            "range": "±2.14%"
          }
        ]
      }
    ]
  }
}
