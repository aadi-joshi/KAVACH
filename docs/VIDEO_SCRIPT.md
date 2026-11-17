# KAVACH demo video script (6:00)

Team **Brawless**: Aadi Joshi · Atharva Gilbile · Hasan Rupawalla · Tanvesh Deshmukh

The narration is identical to [`video/VOICEOVER.txt`](../video/VOICEOVER.txt), the plain file for text-to-speech. This version adds what is on screen in `video/kavach_demo.mp4` at each point. Brand names are spelled the way they are spoken (Kavach, Shram, Chaitra).

---

### 01 · 0:00 · Intro and the problem
*On screen: 0:00 KAVACH title card · 0:06 Rajesh at the gate · 0:16 stat cards 380M / $78B / 14–32 min · 0:29 "the rules already exist"*

Hi, we're team Brawless, and this is Kavach.

Six in the morning, Pune. Rajesh, a site supervisor, has forty-two workers at the gate, and the forecast says thirty-six degrees. But that doesn't answer his real question: can his crew work today, and for how long?

Three hundred and eighty million Indians work in heat like this. It costs them about seventy-eight billion dollars a year in lost wages, and in extreme heat, heavy work can turn dangerous within fourteen minutes. There are rules for this, but they're rarely followed, because stopping work looks like losing money.

### 02 · 0:40 · The gap, and what we built
*On screen: 0:40 heat-stack ladder IMD → SHRAM → CHAITRA → KAVACH · 0:56 "what most teams submit" table · 1:10 "Live demo" title card*

India already has good heat data. IMD gives forecasts, Shram from UC Berkeley tracks heat stress live at over eight hundred stations, and Chaitra maps the risk ward by ward. But they all stop at telling you the risk. None of them tell Rajesh what to actually do.

Kavach goes one step further. It predicts the exact minute a worker's body gets into danger, and builds a safe shift around it. Let's see it live.

### 03 · 1:15 · Live data
*On screen: 1:15 live SHRAM chip (835 stations) · 1:22 Pune map · 1:29 click "A May heatwave" · 1:35 the verdict panel*

This is the supervisor console, running on live data from eight hundred and thirty-five weather stations, seventeen in Pune. The diamonds are work sites, and the dots are stations, coloured by how dangerous the heat is.

We'll use a real May heatwave day at Magarpatta. The answer is right at the top: work from six to ten, rest through the afternoon, and come back from four to eight.

### 04 · 1:45 · How hot is the site, really?
*On screen: 1:45 site-heat panel, 35.9 → 39.2 °C · 2:01 "what we are less sure about"*

There's no weather station on this site, so Kavach estimates it. The forecast says about thirty-six degrees, but this site is mostly concrete with almost no trees, and that adds heat. So the site itself comes out above thirty-nine, hotter than any nearby station would show. And where we're less sure about a number, we say so.

### 05 · 2:15 · ⭐ What the day does to a body
*On screen: 2:15 strain chart, red line breaches at 12:20 · 2:33 teal KAVACH line, peak 37.2 °C · 2:46 zone strip, water, rest cycle*

This is the heart of Kavach. The red line is a normal nine-to-five day. Using ISO seventy-nine thirty-three, the international standard for heat stress, Kavach simulates a worker's body temperature, minute by minute. At twelve twenty, it crosses thirty-eight point five degrees, where the risk of heat stroke begins.

The teal line is Kavach's plan: work early, rest through the hottest hours, and come back in the evening. Body temperature peaks at thirty-seven point two, safely under the limit. Below that, you can see the danger level for each hour, the rest breaks, and how much water each worker needs.

### 06 · 3:00 · The productivity ledger
*On screen: 3:00 ledger 84 → 105 labour-hours, 2 → 0 breaches · 3:15 "+25%"*

And here's why contractors will actually use it. In extreme heat, workers spend most of each hour just recovering, so very little gets done. A normal day gives eighty-four real hours of work, and crosses the safety limit twice. Kavach's plan gives a hundred and five, with zero breaches, and it follows the state's rules. Safer, and twenty-five percent more productive.

### 07 · 3:30 · ⭐ The honest case
*On screen: 3:30 click MET 6 · 3:37 breach 09:36, only 3.5 h safe · 3:51 back to MET 4*

We don't hide the hard cases either. If we switch to very heavy work, a normal day turns dangerous at nine thirty-six, just thirty-six minutes in. Kavach recalculates everything instantly, and tells you honestly that only three and a half hours of heavy work is safe today. A safety tool that only gives good news isn't really a safety tool.

### 08 · 4:00 · ⭐ Nugen, voice and the fact-lock
*On screen: 4:00 briefing panel with Nugen source line · 4:07 voice plays · 4:16 Hindi / English / Marathi switch · 4:27 send → confirm · 4:38 compliance ledger*

Next, the plan has to reach Rajesh in his own language. Nugen's aligned model turns it into a spoken briefing, in Marathi or Hindi.

*(short pause while the Marathi voice plays)*

But the AI never decides the schedule. Every number it says is checked against the plan, and if anything doesn't match, we fall back to a fixed template. Change the language, and only the words change, never the schedule. Rajesh confirms with one tap, and it's saved in a compliance record the labour department can check.

### 09 · 4:45 · How it works
*On screen: 4:45 four-engine diagram builds · 4:59 chips: 0 sensors, RMSE 1.17, 89.9 %, offline, AI never decides*

Behind the scenes, Kavach runs four engines: site heat estimation, the body simulation, the shift planner, and the Nugen briefing. It needs no sensors, no wearables, and no hardware at all. Our heat model matches Shram's official danger zones about ninety percent of the time, and it keeps working even if the internet goes down.

### 10 · 5:15 · Impact and scale
*On screen: 5:15 835 · ₹0 · +25 % · 10 s · 5:23 B2G / B2B / NREGA*

Because there's no hardware, adding a new site just means entering its location. It costs nothing per site, it works anywhere Shram has coverage, and it takes a supervisor about ten seconds each morning. Labour departments get proof that safety rules are being followed, contractors get more work done, and rural NREGA worksites get it for free.

### 11 · 5:45 · Close
*On screen: 5:45 "India has the heat data. KAVACH makes the heat decision." · team names*

India already has the heat data. Kavach makes the heat decision. We're team Brawless: Aadi, Atharva, Hasan, and Tanvesh. Thank you.

---

**Numbers on screen, so nobody gets caught out in Q&A**

| Claim | Where it comes from |
|---|---|
| 380 M heat-exposed workers · ~$78 B/yr wage loss · 14–32 min to danger | `docs/PITCH.md` §2.1 (IECC, IIED 2026) |
| 835 live stations · 17 in Pune | live SHRAM feed on recording day (`/api/status`) |
| Site 39.2 °C vs 35.9 °C grid forecast | site-heat panel, May-heatwave scenario |
| Breach at 12:20 · peak 39.01 → 37.23 °C | strain chart, MET 4, direct sun |
| 84 → 105 labour-hours · +25 % · 2 → 0 breaches | ledger panel, live refit (the bundled snapshot reads 32 → 105) |
| MET 6: breach 09:36 after 36 min · 3.5 h safe | MET 6 recompute |
| ~90 % zone agreement with SHRAM | `scripts/engine-check.ts` (89.9 %) |
