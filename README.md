# KAVACH

**Turns a heat forecast into a safe, productive shift plan for one work site — by
simulating what the day will do to a worker's body.**

Team **Brawless** — Aadi Joshi · Atharva Gilbile · Hasan Rupawalla · Tanvesh Deshmukh

Built for the **Indradhanu 2026 International Grand Challenge**, PCCOE Pune. Theme: AI for
Climate Change (UN SDG 13). Domain: disaster resilience, public health and community
well-being.

**Demo video:** _link to be added_ · script: [docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md) · recorder: [`video/`](video/)

| Read this | For |
|---|---|
| [`/impact`](src/app/impact/page.tsx) in the app | The problem, where today's tools stop, case studies, business model |
| [`/how-it-works`](src/app/how-it-works/page.tsx) in the app | A plain-English walkthrough, no equations, full glossary |
| [docs/PITCH.md](docs/PITCH.md) | The full story, every design decision, honest answers to hard questions |
| [docs/IDEA.md](docs/IDEA.md) | Competition strategy, competitive analysis, Q&A defence |

---

## Why it matters

| | Figure | Source |
|---|---|---|
| Heat-exposed workers in India | ~380 million | IECC (UC Berkeley), EHI-N\* policy paper |
| Wages lost to heat each year | ~$78 billion, ≈2% of GDP | IIED, 2026 |
| Workdays lost per outdoor worker per year | ~24 | IIED / The Guardian, 2026 |
| Excess deaths from one day of extreme heat | ~3,400 | Frontiers in Environmental Health, 2026 |
| India in the most dangerous zone for heavy labour, Apr–Jun 2024 | **41.5%** — vs 9.6% flagged by the NOAA heat index | IECC technical report |
| Time to dangerous core temperature in that zone | 14–32 minutes | IECC technical report |

India's heat *data* is now excellent. What nobody answers is the question a site
supervisor faces at 6 AM with forty people at the gate: **can this crew work today, in
which hours, and with how much water?** Today that is a guess, biased by the fact that
stopping costs money immediately and heat stroke is only a probability.

## Where existing tools stop

| Layer | What it answers | Granularity | Who acts on it | Produces a schedule? | Proves the plan is safe? |
|---|---|---|---|---|---|
| IMD advisories | Is a heatwave coming? | District, days ahead | Disaster authorities, public | No | No |
| **SHRAM** (IECC, UC Berkeley) | How dangerous is the heat for physical work right now? | ~786 stations, live | Researchers, officials | No | No — it reports risk, very well |
| CHAITRA (IECC) | Which wards should a city invest in over years? | Ward, 12 cities | Municipal planners | No | No |
| City Heat Action Plans | Who does what when an alert is issued? | City, 250+ cities | Municipal departments | General guidance | No |
| **KAVACH** | Can this crew work today, when, with how much water? | One site, one day, minute by minute | Site supervisor; inspector reads the record | **Yes** | **Yes** — ISO 7933 simulation of every candidate |

SHRAM is our data source, not our competitor. Every KAVACH plan starts from its live
readings and uses its heat-stress zones. We build the layer after it.

---

## How it works

Four deterministic engines make every decision. A Nugen aligned language model then
phrases the result, and a fact-lock makes sure it cannot change it.

```
  SHRAM live readings ─┐
  Open-Meteo forecast ─┼─▶ ① DOWNSCALE ─▶ ② ISO 7933 ─▶ ③ OPTIMISE ─▶ plan
  Site land cover     ─┘    site, not      core temp     safe shift,
                            station        per minute    most real work
                                                              │
                                     ┌────────────────────────┘
                                     ▼
                           ④ NUGEN ALIGNED MODEL ──▶ FACT-LOCK ──▶ briefing
                              phrases the plan       every number      (or the
                              in मराठी / हिन्दी / EN    must be a plan    template,
                                                     number            with reason)
```

| Engine | What it does |
|---|---|
| **Downscaling** | Site conditions from a gridded forecast at the site's coordinates + live bias correction against the nearest SHRAM station + a land-cover urban-heat-island term |
| **ISO 7933 PHS** | Whole-body heat balance stepped every minute: predicted core temperature and sweat loss across the shift |
| **Optimiser** | Searches thousands of schedules, discards any that breaches a physiological limit, maximises *effective* labour inside Maharashtra's 06:00–11:00 / 16:00–20:00 windows |
| **Briefing** | Renders the plan as a spoken Marathi / Hindi / English briefing and answers supervisor questions — phrased by Nugen, checked by the fact-lock |

### The Nugen layer and the fact-lock

The competition requires inference through Nugen's aligned models. We use it where a
language model is genuinely the right tool — the last hop, from a finished plan to words a
supervisor will act on — and nowhere near the safety decision.

1. The route renders the **deterministic template** first. It is always a valid answer.
2. If `NUGEN_API_KEY` is set, it sends the plan as a fact sheet to the aligned model,
   with the list of numbers it is allowed to use.
3. The **fact-lock** ([`src/lib/factlock.ts`](src/lib/factlock.ts)) extracts every date,
   clock time and number from the reply — Devanagari digits ०-९ are normalised first —
   and checks each against the plan. For briefings it also requires every work window and
   the water volume to appear, and the text to be in the requested script.
4. One unmatched number, one missing window, a truncated reply or a timeout, and the
   template is returned instead, with the reason in the response.

The console shows which writer produced the text — *"Phrased by Nugen aligned model ·
fact-lock passed (8/8 numbers match the plan)"* or *"Template phrasing — no Nugen key
configured · schedule identical"* — and a **Phrasing: Nugen / Template** switch so you
can watch the wording change while the schedule line underneath does not.

**API used** (from [docs.nugen.in](https://docs.nugen.in), API reference → Inference):

```
POST https://api.nugen.in/api/v3/inference/chat/completions
Authorization: Bearer $NUGEN_API_KEY
{ "model": "<aligned model id>", "messages": [...], "max_tokens": 800,
  "temperature": 0.3, "stream": false }

→ { "model", "choices": [{ "message": { "content" }, "finish_reason" }],
    "usage", "confidence_score" }
```

If `NUGEN_MODEL` is not set, the first aligned model with `deployment_status: "DEPLOYED"`
from `GET /api/v3/models/aligned` is used. `stream` defaults to true on Nugen, so it is
sent as `false`; a server-sent-event reply is still parsed if one arrives.
`<think>…</think>` reasoning traces are stripped before checking.

`/api/brief` and `/api/ask` respond with:

```ts
{
  text, lang,
  source: "nugen" | "template",
  model?, latencyMs?, confidence?,
  factLock: { passed, checked, rejected?: string[], subject: "nugen" | "template" },
  fallback?: { code: "no_key" | "no_model" | "request_failed" | "fact_lock_rejected", message }
}
```

> **Honest status:** the client is written against Nugen's published API reference and
> exercised against a local mock of it (JSON, SSE and rejection paths). It has not yet
> been run with a live key, because we do not have one. With no key, everything works
> and the console says it is using the template.

---

## Results on a recorded heatwave day

Pune, 2026-05-20 (Open-Meteo archive), bundled SHRAM snapshot. Engine output, reproducible
with `npx tsx scripts/impact-numbers.ts`.

| Site · work intensity | Normal 09:00–17:00 day | KAVACH | Change | Safe limit (38.5 °C) crossed |
|---|---|---|---|---|
| **Magarpatta Site 7** · MET 4, 42 workers | 32 labour-hours, peak 39.01 °C | **105**, peak 37.23 °C | **+233%** | normal: **12:20** · KAVACH: never |
| Magarpatta Site 7 · MET 6 (the case we lose) | 53 | **37** | **−30%** | normal: **09:36, after 36 min** · KAVACH: never |
| Magarpatta Site 7 · MET 5 (one step down) | 42 | 74 | +75% | normal: 10:06 · KAVACH: never |
| Chikhali NREGA works · MET 5, 68 workers | 136, peak 39.81 °C | 153, peak 37.64 °C | +13% | normal: 11:12 · KAVACH: never |

At very heavy labour some days genuinely cannot deliver a full safe day, and KAVACH says
so rather than rigging the comparison. For FC Road street vendors (MET 3) the body model
predicts no breach at all; the schedule change there comes from the zone guidance only, so
we do not headline it. Nobody has yet worked a real shift on a KAVACH schedule — this is a
carefully built simulation awaiting field validation.

---

## Running it

```bash
npm install
npm run dev                  # http://localhost:3000
```

**Without a Nugen key** — nothing to configure. The plan, charts, voice playback and
ledger all work; briefings use the deterministic template and say so.

**With a Nugen key:**

```bash
cp .env.example .env.local
# NUGEN_API_KEY=...            required to enable the model
# NUGEN_MODEL=model_...        your deployed aligned model (optional: auto-discovered)
# NUGEN_BASE_URL=...           optional, default https://api.nugen.in/api/v3/inference
npm run dev
curl -s localhost:3000/api/status    # → "nugen": { "configured": true, "model": ... }
```

Production: `npm run build && npm start`.

## Verifying

```bash
npx tsc --noEmit                      # typecheck
npx eslint src                        # lint
npx next build                        # production build

npx tsx scripts/engine-check.ts       # all sites, both scenarios, EHI fit diagnostics
npx tsx scripts/demo-numbers.ts       # the headline figures quoted in the docs
npx tsx scripts/impact-numbers.ts     # every /impact figure, fails on drift
npx tsx scripts/factlock-check.ts     # 960 template texts pass; tampered text is rejected
```

`engine-check` reports the EHI response-surface fit against SHRAM's own published values:
**RMSE 1.17, mean absolute error 0.79, 89.9% exact zone agreement**. The scripts use the
bundled station snapshot so their output is reproducible; the running app refits to the
live feed on every request, so its figures move with the weather while the direction holds.

Try the briefing route directly (the console posts the same facts):

```bash
curl -s -X POST localhost:3000/api/brief -H 'content-type: application/json' -d '{
  "lang": "en",
  "facts": { "siteName": "Magarpatta Site 7", "supervisor": "Rajesh Pawar",
    "phone": "+91 98220 11407", "date": "2026-05-20", "zone": 5,
    "zoneLabel": "Very high stress", "cadence": "15 min work / 45 min rest",
    "blocks": [{ "start": "06:00", "end": "10:00" }, { "start": "16:00", "end": "20:00" }],
    "rest": { "start": "10:00", "end": "16:00" }, "waterLitres": 3.1, "workers": 42,
    "peakCoreTempC": 37.23, "breachAt": "12:20", "effectiveHoursDelta": 21,
    "sopCompliant": true } }'
# no key → { "source": "template", "factLock": { "passed": true, "checked": 16, ... },
#            "fallback": { "code": "no_key", "message": "No Nugen key configured" } }
```

## Demo-day resilience

- The engines contain **no network calls**; data is fetched at the route boundary, so
  everything computes from a cached snapshot.
- A real 217-station SHRAM snapshot is **bundled** (`src/lib/fallback.ts`).
- The Nugen call has an **8-second budget** and can never block a briefing: the template
  renders first in the browser, and the server falls back on any failure.
- The map is a **hand-projected SVG**; voice uses the **Web Speech API**.

---

## Architecture

```
src/
  lib/
    shram.ts          live SHRAM ingestion, caching, offline fallback
    openmeteo.ts      gridded forecast + archive (heatwave scenario)
    ehi.ts            EHI response-surface fit + solar increment
    downscale.ts      site-level microclimate estimation
    phs.ts            ISO 7933 predicted heat strain
    optimizer.ts      shift search + productivity ledger
    plan.ts           pipeline orchestration
    briefing.ts       plan facts + deterministic multilingual briefing
    ask.ts            rule-based, plan-grounded supervisor Q&A
    nugen.ts          Nugen aligned-model client + fact-locked phrasing (server only)
    factlock.ts       number/time/window validator for model output
    phrasing.ts       prompts, response types, request guards
    impact.ts         figures quoted on /impact
  components/         console UI, hand-drawn SVG charts, BriefingPanel
  app/
    console/          supervisor console
    impact/           problem, gap, case studies, business model, team
    how-it-works/     plain-English explainer
    sites/ ledger/    site registry, compliance ledger
    api/              plan · brief · ask · status
scripts/              engine, impact and fact-lock verification (not part of the build)
```

## Data sources and credit

- **SHRAM** — India Energy & Climate Centre, UC Berkeley. Live EHI-N\* observations and
  heat-stress zones. Our anchor observation source; KAVACH builds on it.
- **Open-Meteo** — gridded hourly forecast and historical archive.
- **Nugen Intelligence** — aligned-model inference for briefing and Q&A.
- **ISO 7933 / ISO 7243 / ISO 8996** — heat-strain, heat-stress and metabolic-rate standards.
- **Prayas Pune** (2026) — fieldwork on informal workers and heat.
- **Hess et al. (2018)**, *Journal of Environmental and Public Health* — evaluation of
  Ahmedabad's Heat Action Plan, cited on `/impact`.

Heat-stress zones and EHI-N\* are SHRAM's. The downscaling, physiological simulation,
scheduling, productivity model and fact-lock are ours.
