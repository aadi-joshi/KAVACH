# KAVACH — demo video script (≈6:00)

Team **Brawlers** · Aadi Joshi · Atharva Gilbile · Hasan Rupawalla · Tanvesh Deshmukh

Read it like you're talking to one person across a table. Pauses at the `/` marks.
Timestamps match the cut of `kavach_demo.mp4`.

---

### 0:00 – 0:40 · The problem
*(title card → Rajesh at the gate → three stat cards)*

Pune, May twentieth. It's six in the morning and Rajesh Pawar has forty-two workers
waiting at the gate of a construction site in Hadapsar / The forecast says thirty-six
degrees. What it doesn't tell him is the one thing he needs to know — can his crew
work today, and until when?

Three hundred and eighty million Indians work in heat like this / Heat already costs
them around seventy-eight billion dollars a year in lost wages, and in the worst zone
a worker doing heavy labour can reach a dangerous body temperature in fourteen to
thirty-two minutes / Maharashtra already has rules for this. Nobody follows them,
because stopping work feels like losing money.

### 0:40 – 1:15 · The gap, and what we built
*(0:40 the "heat stack" ladder IMD → SHRAM → CHAITRA → KAVACH · 0:56 the comparison table · 1:10 "Team Brawlers presents KAVACH")*

India actually has great heat data. IMD gives the forecast, SHRAM from UC Berkeley
gives live heat stress for over eight hundred stations, CHAITRA maps it ward by ward /
But every one of them stops at "here's the risk". Nobody answers the supervisor's
question.

Most teams will stop at a red map or a heat score / We give the exact minute a body
crosses the limit, we build the actual safe shift, and the AI only translates it.

We're team Brawlers, and this is KAVACH.

### 1:15 – 1:45 · Live data
*(console header, live station count, Pune map)*

This is the supervisor console / Everything here is coming in live — eight hundred and
thirty-five SHRAM stations, seventeen of them in Pune, pulled minutes ago. Diamonds are
work sites, dots are weather stations coloured by heat danger / We'll plan against a
real recorded May heatwave day, at Magarpatta Site 7 / And the answer comes first —
work six to ten, stand down, come back four to eight.

### 1:45 – 2:15 · How hot is the site, really?
*(DownscalePanel — the bars)*

First problem — there's no weather station on this site / The forecast for this grid
cell says about thirty-six degrees. But this site is mostly concrete, barely any trees,
dark ground, and KAVACH adds that up term by term / The site itself comes out above
thirty-nine. Hotter than any station would tell you. And we show you which numbers
we're less sure about, instead of hiding them.

### 2:15 – 3:00 · ⭐ What the day does to a body
*(StrainChart — red line crosses 38.5 °C at 12:20, teal line stays under; zone strip)*

Now the main part / This red line is an ordinary nine-to-five day. KAVACH runs ISO
7933 — the international standard for heat strain — and simulates the worker's core
body temperature minute by minute / At twelve twenty it crosses thirty-eight point five.
That's the exact minute someone starts heading towards heat stroke.

The teal line is the plan KAVACH built / Work six to ten, stand down through the worst
of it, come back four to eight. Peak body temperature stays at thirty-seven point two.
It never touches the limit / Underneath — the hour-by-hour danger strip, the rest cycle,
and how much water each worker needs.

### 3:00 – 3:30 · The ledger — why contractors will actually use it
*(LedgerPanel: 84 → 105 labour-hours)*

Here's why a contractor will actually use this / Hours worked in zone five are mostly
spent recovering, so they produce almost nothing. The ordinary day gives eighty-four
real labour-hours and breaks the safety limit twice / The KAVACH day gives a hundred and
five, zero breaches, and it follows the legal SOP / Safer, and twenty-five percent more
productive. Safety stops being a cost.

### 3:30 – 4:00 · ⭐ The honest case
*(switch MET 4 → MET 6, everything recomputes; switch back)*

And we don't rig it / Switch to very heavy work. The ordinary day now crosses the limit
at nine thirty-six — thirty-six minutes after the shift starts / KAVACH recomputes
everything live, and the honest answer is that only three and a half hours of heavy
work is safe today. It says that on screen / A safety tool that only gives good news
isn't a safety tool.

### 4:00 – 4:45 · ⭐ Nugen, voice, and the fact-lock
*(BriefingPanel: Marathi briefing, voice plays, phrasing switch, confirm → ledger)*

Now the plan has to reach Rajesh, who doesn't read English dashboards / Nugen's aligned
model phrases it as a spoken briefing in Marathi or Hindi —
*(let ~3 seconds of the Marathi voice play)*
— but the AI never decides the schedule / Every number it writes is checked against the
plan — the times, the litres, the zone. If it invents even one, we throw it out and fall
back to the template / Switch the phrasing and the words change, the schedule doesn't
move. Rajesh confirms with one tap, and it lands in a compliance ledger the labour
department can audit.

### 4:45 – 5:15 · How it works
*(four-engine architecture animation)*

Under the hood it's four engines / Downscaling, the ISO 7933 body model, the shift
optimiser, and the Nugen briefing. No sensors, no wearables, no hardware anywhere / Our
heat-index model matches SHRAM's own published danger zones about ninety percent of the
time, and if the internet drops on site it still plans from a cached snapshot.

### 5:15 – 5:45 · Impact and scale
*(scale slide: 835 stations · ₹0 per site · B2G / B2B)*

Because there's no hardware, adding a site is just typing in coordinates / That's zero
rupees per site, and every district SHRAM covers, from day one / Labour departments get
SOP compliance they can actually check, contractors get more work out of the same day,
and NREGA sites get it free.

### 5:45 – 6:00 · Close
*(closing card)*

India already has the heat data / KAVACH makes the heat decision.
We're team Brawlers — Aadi, Atharva, Hasan and Tanvesh. Thank you.

---

**Numbers on screen, so nobody gets caught out in Q&A**

| Claim | Where it comes from |
|---|---|
| 380 M heat-exposed workers · ~$78 B/yr wage loss · 14–32 min to danger | `docs/PITCH.md` §2.1 (IECC, IIED 2026) |
| 835 live stations · 17 in Pune | live SHRAM feed on recording day (`/api/status`) |
| Site 39.2 °C vs 35.9 °C grid forecast | DownscalePanel, May-heatwave scenario |
| Breach at 12:20 · peak 39.01 → 37.23 °C | StrainChart, MET 4 direct sun |
| 84 → 105 labour-hours · +25% · 2 → 0 breaches | LedgerPanel, live refit (bundled snapshot reads 32 → 105) |
| MET 6: breach 09:36 after 36 min · 3.5 h safe | MET 6 recompute |
| ~90% zone agreement with SHRAM | `scripts/engine-check.ts` (89.9%) |
