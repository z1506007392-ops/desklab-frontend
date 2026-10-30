# AI layout evaluation

Measures how well the real model's suggestions survive DeskLab's checks
(roadmap task C6; thresholds in `lib.mjs`).

```bash
DEEPSEEK_API_KEY=sk-... npm run dev:api        # terminal 1
npm run eval:ai                                # terminal 2
```

- Scenes are built in code (`buildEvalScenes()`): the three templates as is,
  three "messy" variants of each (monitor off-centre or turned away, laptop at
  the back, tower in the legroom, power strip on the desk, cable far too long),
  old-save shapes, and an empty desk. Each scene has 1–2 user goals.
- Each run saves every raw answer and the metrics to `results/<timestamp>/`
  (ignored by git) and exits 1 if a threshold is missed, 2 if the endpoint is
  missing, has no key, or rate-limits.
- After a run, copy a few representative answers into
  `test/fixtures/ai/recorded/` so unit tests can replay them, and record the
  metrics in `docs/memory_bank.md` ("Prompt iterations").

| Metric | Threshold |
|---|---|
| JSON answers that parse | ≥ 98% |
| Messy scenes with at least one accepted suggestion | ≥ 80% |
| Average score improvement of accepted answers | > 0 |
| New errors after an accepted suggestion | 0 (guaranteed by validation) |
| Suggestions whose text contains English or ids | 0 |

`AI_MOCK=1 npm run dev:api` runs the harness against the rule-based mock;
the mock is not expected to meet the thresholds.
