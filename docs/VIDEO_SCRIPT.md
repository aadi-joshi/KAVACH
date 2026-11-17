# KAVACH demo video script (6:00)

Team **Brawlers**: Aadi Joshi · Atharva Gilbile · Hasan Rupawalla · Tanvesh Deshmukh

The narration is identical to [`video/VOICEOVER.txt`](../video/VOICEOVER.txt), which is the plain file to feed to text-to-speech. This version adds what is on screen at each moment of `video/kavach_demo.mp4`. Brand names are spelled the way they are spoken (Kavach, Shram, Chaitra).

---

### 01 · 0:00 · The problem (max 40 s)
*On screen: 0:00 title card · 0:06 Rajesh at the gate · 0:16 stat cards 380M / $78B / 14–32 min · 0:29 "the rules already exist"*

Pune, May twentieth, six in the morning. Rajesh Pawar has forty-two workers at the gate of a construction site in Hadapsar, and the forecast says thirty-six degrees. But can his crew work today, and until when? The forecast doesn't say. Three hundred and eighty million Indians work in heat like this. It costs them about seventy-eight billion dollars a year in lost wages, and in the worst heat, a labourer can hit a dangerous body temperature in fourteen to thirty-two minutes. Maharashtra has rules for this, but nobody follows them, because stopping work feels like losing money.

### 02 · 0:40 · The gap, and what we built (max 35 s)
*On screen: 0:40 heat-stack ladder IMD → SHRAM → CHAITRA → KAVACH · 0:56 "what most teams submit" table · 1:10 "Team Brawlers presents KAVACH"*

India actually has great heat data. IMD gives the forecast, Shram from UC Berkeley gives live heat stress for over eight hundred stations, and Chaitra maps it ward by ward. But they all stop at "here's the risk". Nobody answers the supervisor's question. Most teams stop at a red map or a heat score. We tell you the exact minute a body crosses the limit, we build the actual safe shift, and the AI only translates it. We're team Brawlers, and this is Kavach.

### 03 · 1:15 · Live data (max 30 s)
*On screen: 1:15 live SHRAM chip (835 stations) · 1:22 Pune map · 1:29 click "A May heatwave" · 1:35 the verdict panel*

This is the supervisor console, and everything here is live. Eight hundred and thirty-five Shram stations, seventeen of them in Pune, pulled just minutes ago. The diamonds are work sites, and the dots are weather stations, coloured by heat danger. Let's plan against a real recorded May heatwave, at Magarpatta Site 7. And the answer comes first: work six to ten, stand down, and come back four to eight.

### 04 · 1:45 · How hot is the site, really? (max 30 s)
*On screen: 1:45 downscale panel 35.9 → 39.2 °C · 2:01 "what we are less sure about"*

First problem, there's no weather station on this site. The grid forecast says about thirty-six degrees, but this site is mostly concrete, barely any trees, dark ground, and Kavach adds that up term by term. The site itself comes out above thirty-nine, hotter than any station would tell you. And we show which numbers we're less sure about, instead of hiding them.

### 05 · 2:15 · ⭐ What the day does to a body (max 45 s)
*On screen: 2:15 strain chart, red line breaches at 12:20 · 2:33 teal KAVACH line, peak 37.2 °C · 2:46 zone strip, water, rest cycle*

Now the main part. This red line is an ordinary nine-to-five day. Kavach runs ISO seventy-nine thirty-three, the international standard for heat strain, and simulates the worker's core body temperature, minute by minute. At twelve twenty, it crosses thirty-eight point five, and that's the exact minute someone starts heading towards heat stroke. The teal line is the plan Kavach built. Work six to ten, stand down through the worst of it, come back four to eight, and the body peaks at thirty-seven point two. It never even touches the limit. Underneath, you've got the hour-by-hour danger strip, the rest cycle, and how much water each worker needs.

### 06 · 3:00 · The productivity ledger (max 30 s)
*On screen: 3:00 ledger 84 → 105 labour-hours, 2 → 0 breaches · 3:15 "+25%, safety stops being a cost"*

Now here's why a contractor will actually use this. Hours worked in zone five are mostly spent recovering, so they produce almost nothing. The ordinary day gets eighty-four real labour-hours, and breaks the safety limit twice. The Kavach day gets a hundred and five, with zero breaches, and it follows the legal SOP. So it's safer, and twenty-five percent more productive. Safety stops being a cost.

### 07 · 3:30 · ⭐ The honest case (max 30 s)
*On screen: 3:30 click MET 6 · 3:37 breach 09:36, only 3.5 h safe · 3:51 back to MET 4*

And we don't rig it. Let's switch to very heavy work. Now the ordinary day crosses the limit at nine thirty-six, just thirty-six minutes into the shift. Kavach recalculates everything live, and the honest answer is that only three and a half hours of heavy work is safe today, and it says that right on screen. Because a safety tool that only gives good news isn't a safety tool.

### 08 · 4:00 · ⭐ Nugen, voice and the fact-lock (max 45 s)
*On screen: 4:00 briefing panel, Nugen source line · 4:07 voice plays · 4:16 Hindi / English / Marathi switch · 4:27 send → confirm · 4:38 compliance ledger*

Now the plan has to reach Rajesh, who isn't going to read an English dashboard. So Nugen's aligned model turns it into a spoken briefing, in Marathi or Hindi.
*(3 second pause while the Marathi voice plays)*
Switch the language and the words change, but the schedule never moves, because the AI never decides it. Every number it writes gets checked against the plan, the times, the litres, the zone, and if it invents even one, we throw it out and use the template. Rajesh confirms with one tap, and it lands in a compliance ledger the labour department can audit.

### 09 · 4:45 · How it works (max 30 s)
*On screen: 4:45 four-engine diagram builds · 4:59 chips: 0 sensors, RMSE 1.17, 89.9 %, offline, AI never decides*

Under the hood, it's four engines. Downscaling, the ISO seventy-nine thirty-three body model, the shift optimiser, and the Nugen briefing. No sensors, no wearables, no hardware anywhere. Our heat-index model matches Shram's own published danger zones about ninety percent of the time, and if the internet drops on site, it still plans from a cached snapshot.

### 10 · 5:15 · Impact and scale (max 30 s)
*On screen: 5:15 835 · ₹0 · +25 % · 10 s · 5:23 B2G / B2B / NREGA*

And because there's no hardware, adding a new site just means typing in its coordinates. That's zero rupees per site, every district Shram covers from day one, and about ten seconds of a supervisor's morning. Labour departments get SOP compliance they can actually check, contractors get more work out of the same day, and NREGA sites get it for free.

### 11 · 5:45 · Close (max 15 s)
*On screen: 5:45 "India has the heat data. KAVACH makes the heat decision." · team names*

India already has the heat data. Kavach makes the heat decision. We're team Brawlers. Aadi, Atharva, Hasan, and Tanvesh. Thank you.

---

**Numbers on screen, so nobody gets caught out in Q&A**

| Claim | Where it comes from |
|---|---|
| 380 M heat-exposed workers · ~$78 B/yr wage loss · 14–32 min to danger | `docs/PITCH.md` §2.1 (IECC, IIED 2026) |
| 835 live stations · 17 in Pune | live SHRAM feed on recording day (`/api/status`) |
| Site 39.2 °C vs 35.9 °C grid forecast | downscale panel, May-heatwave scenario |
| Breach at 12:20 · peak 39.01 → 37.23 °C | strain chart, MET 4, direct sun |
| 84 → 105 labour-hours · +25 % · 2 → 0 breaches | ledger panel, live refit (the bundled snapshot reads 32 → 105) |
| MET 6: breach 09:36 after 36 min · 3.5 h safe | MET 6 recompute |
| ~90 % zone agreement with SHRAM | `scripts/engine-check.ts` (89.9 %) |
