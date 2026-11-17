import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Chrome } from "@/components/Chrome";
import { CASES, CASE_DATE, PROBLEM_FIGURES, pctChange, type CaseRun } from "@/lib/impact";
import { getSite } from "@/lib/sites";
import { MET_LABEL } from "@/lib/zones";

export const metadata: Metadata = {
  title: "Impact",
  description:
    "The scale of occupational heat in India, where existing tools stop, what KAVACH changes on a real heatwave day, and who it is for.",
};

/**
 * The impact page.
 *
 * Written for a judge or an officer deciding whether this matters. Every
 * problem figure is attributed, every case-study number is engine output
 * reproducible from scripts/impact-numbers.ts, and the case where KAVACH
 * reduces output is shown next to the ones where it wins.
 */

const STACK: {
  name: string;
  by?: string;
  answers: string;
  granularity: string;
  actor: string;
  schedule: string;
  proves: string;
  ours?: boolean;
}[] = [
  {
    name: "IMD heatwave advisories",
    answers: "Is a heatwave coming to my district?",
    granularity: "District, days ahead",
    actor: "Disaster authorities, the public",
    schedule: "No",
    proves: "No",
  },
  {
    name: "SHRAM",
    by: "India Energy & Climate Centre, UC Berkeley",
    answers: "How dangerous is the heat right now for people doing physical work?",
    granularity: "~786 stations, live, by work intensity",
    actor: "Researchers, officials, anyone who checks",
    schedule: "No",
    proves: "No — it reports risk, and does that very well",
  },
  {
    name: "CHAITRA",
    by: "IECC, UC Berkeley",
    answers: "Which wards should this city invest in over the coming years?",
    granularity: "Ward, 12 cities",
    actor: "Municipal planners",
    schedule: "No",
    proves: "No",
  },
  {
    name: "City Heat Action Plans",
    answers: "Who does what when a heat alert is issued?",
    granularity: "City, 250+ cities",
    actor: "Municipal departments, health system",
    schedule: "General guidance, such as avoiding midday work",
    proves: "No",
  },
  {
    name: "KAVACH",
    answers: "Can this crew work today, in which hours, with how much water?",
    granularity: "One work site, one day, minute by minute",
    actor: "The site supervisor; the labour officer checks the record",
    schedule: "Yes — the actual shift, within Maharashtra’s work windows",
    proves: "Yes — every schedule is simulated through ISO 7933 and any that crosses 38.5 °C is discarded",
    ours: true,
  },
];

const DIFFERENT: { title: string; body: string }[] = [
  {
    title: "It names the minute",
    body: "Not “Zone 5, high risk”. It says when a worker on this site would cross the safe core-temperature limit — 12:20 on our headline day — and builds a day where that never happens.",
  },
  {
    title: "It simulates a body, not a map",
    body: "ISO 7933, the international standard for heat strain, is run minute by minute: heat made by working, heat taken in from sun and air, heat lost by sweating. The output is a core-temperature curve, not a colour.",
  },
  {
    title: "It builds the actual shift",
    body: "Thousands of candidate schedules are simulated. Any that breaches a physiological limit is thrown away. Of the rest, the one that delivers the most usable work inside Maharashtra’s outdoor-work windows is kept.",
  },
  {
    title: "The AI only translates, and is checked",
    body: "A Nugen aligned model turns the finished plan into a Marathi, Hindi or English briefing. A fact-lock compares every number it writes with the plan; one mismatch and the text is replaced by the deterministic template.",
  },
  {
    title: "Nothing to install",
    body: "No sensor, no box, no app for workers. A new site is a pair of coordinates. The marginal cost of one more site is ₹0, and SHRAM’s ~786 stations cover the country on day one.",
  },
];

function SectionHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <>
      <p className="label">{kicker}</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[24px] leading-snug">
        {title}
      </h2>
      {children && (
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[var(--color-ink-muted)]">
          {children}
        </p>
      )}
    </>
  );
}

function hours(n: number): string {
  return String(Math.round(n));
}

function signedPct(run: CaseRun): string {
  const p = Math.round(pctChange(run));
  return `${p >= 0 ? "+" : "−"}${Math.abs(p)}%`;
}

/** A normal day vs the KAVACH day, for one case. */
function Comparison({ run }: { run: CaseRun }) {
  const b = run.baseline;
  const k = run.kavach;
  const rows: { label: string; normal: ReactNode; kavach: ReactNode }[] = [
    {
      label: "Hours on site",
      normal: "09:00–17:00, straight through",
      kavach: k.windows.join(" and "),
    },
    {
      label: "Real work delivered",
      normal: <span className="tnum">{hours(b.labourHours)} labour-hours</span>,
      kavach: (
        <span className="tnum font-medium">
          {hours(k.labourHours)} labour-hours ({signedPct(run)})
        </span>
      ),
    },
    {
      label: "Peak core temperature",
      normal: (
        <span className="tnum">
          {b.peakCoreC !== null ? `${b.peakCoreC.toFixed(2)} °C` : "beyond what the model can predict"}
        </span>
      ),
      kavach: <span className="tnum">{k.peakCoreC.toFixed(2)} °C</span>,
    },
    {
      label: "Safe limit (38.5 °C) crossed",
      normal: b.breachAt ? (
        <span className="tnum text-[var(--color-danger)]">
          at {b.breachAt}, after {b.minutesToLimit} min
        </span>
      ) : (
        "no"
      ),
      kavach: <span className="text-[var(--color-safe)]">never</span>,
    },
  ];

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-rule-strong)]">
            <th className="label pb-2 pr-4 font-normal" />
            <th className="label pb-2 pr-4 font-normal">A normal day</th>
            <th className="label pb-2 font-normal">The KAVACH day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--color-rule)] align-top">
              <td className="py-2.5 pr-4 text-[var(--color-ink-muted)]">{r.label}</td>
              <td className="py-2.5 pr-4">{r.normal}</td>
              <td className="py-2.5">{r.kavach}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaseHead({ run, kicker }: { run: CaseRun; kicker: string }) {
  const site = getSite(run.siteId);
  return (
    <>
      <p className="label">{kicker}</p>
      <h3 className="mt-1.5 text-[16px] font-semibold">
        {site?.name ?? run.siteId}
        <span className="font-normal text-[var(--color-ink-muted)]">
          {" "}· {site?.locality} · {run.workers} workers · {MET_LABEL[run.met].toLowerCase()} (MET {run.met})
        </span>
      </h3>
    </>
  );
}

export default function ImpactPage() {
  const m4 = CASES.magarpattaMet4;
  const m6 = CASES.magarpattaMet6;
  const m5 = CASES.magarpattaMet5;
  const nrega = CASES.chikhaliMet5;
  const vendor = CASES.fcRoadMet3;

  return (
    <Chrome wide={false}>
      <main className="mx-auto max-w-[860px] px-5 py-10">
        <p className="label">Impact · Indradhanu 2026 · SDG 13</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] leading-tight sm:text-[40px]">
          Heat is already costing India workers, wages and lives
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          The data to see it coming is now very good. What has been missing is the step
          after the data: a specific, safe plan for a specific crew, in time for a
          supervisor to act on it. This page sets out the size of the problem, where
          today&rsquo;s tools stop, and what changes on a real heatwave day when that
          step exists.
        </p>

        {/* ---- (a) The problem ---- */}
        <section className="mt-12 border-t border-[var(--color-rule)] pt-8">
          <SectionHead kicker="The problem" title="Six numbers">
            Each figure is quoted from the source beside it. We have not added any of our own.
          </SectionHead>
          <dl className="mt-6 divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
            {PROBLEM_FIGURES.map((p) => (
              <div key={p.figure} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[180px_1fr]">
                <dt className="tnum text-[22px] font-medium leading-tight">{p.figure}</dt>
                <dd>
                  <p className="text-[14px] leading-relaxed">{p.what}</p>
                  <p className="mt-1 text-[11.5px] text-[var(--color-ink-faint)]">{p.source}</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
            The fifth row is the one to sit with. The heat index most weather services use
            describes how hot it feels to a person at rest. Applied to someone digging in the
            sun, it understates the danger roughly fourfold. Much of this crisis has been
            invisible because it was measured with the wrong instrument.
          </p>
        </section>

        {/* ---- (b) The stack ---- */}
        <section className="mt-12 border-t border-[var(--color-rule)] pt-8">
          <SectionHead kicker="The gap" title="India’s heat stack stops one step short">
            Every layer below does its job well. None of them produces the thing a
            supervisor at a site gate at 6 AM actually needs: a schedule, and evidence that
            it is safe.
          </SectionHead>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-rule-strong)]">
                  <th className="label pb-2 pr-3 font-normal">Layer</th>
                  <th className="label pb-2 pr-3 font-normal">What it answers</th>
                  <th className="label pb-2 pr-3 font-normal">Granularity</th>
                  <th className="label pb-2 pr-3 font-normal">Who acts on it</th>
                  <th className="label pb-2 pr-3 font-normal">Produces a schedule?</th>
                  <th className="label pb-2 font-normal">Proves the plan is safe?</th>
                </tr>
              </thead>
              <tbody>
                {STACK.map((s) => (
                  <tr
                    key={s.name}
                    className={`border-b align-top ${
                      s.ours
                        ? "border-[var(--color-rule-strong)] bg-[var(--color-paper-sunk)]"
                        : "border-[var(--color-rule)]"
                    }`}
                  >
                    <td className="py-3 pl-1 pr-3">
                      <div className={s.ours ? "font-semibold" : "font-medium"}>{s.name}</div>
                      {s.by && (
                        <div className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">{s.by}</div>
                      )}
                    </td>
                    <td className="py-3 pr-3 leading-relaxed">{s.answers}</td>
                    <td className="py-3 pr-3 leading-relaxed text-[var(--color-ink-muted)]">{s.granularity}</td>
                    <td className="py-3 pr-3 leading-relaxed text-[var(--color-ink-muted)]">{s.actor}</td>
                    <td className="py-3 pr-3 leading-relaxed">{s.schedule}</td>
                    <td className="py-3 leading-relaxed">{s.proves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
            <strong className="text-[var(--color-ink)]">SHRAM is our data source, not our competitor.</strong>{" "}
            Every KAVACH plan starts from its live readings, and its heat-stress zones are
            the scale the console uses. SHRAM answers &ldquo;what is the risk?&rdquo; better
            than we could. We build the layer after it: what this crew does tomorrow, and
            what it costs either way.
          </p>
        </section>

        {/* ---- (c) Case studies ---- */}
        <section className="mt-12 border-t border-[var(--color-rule)] pt-8">
          <SectionHead kicker="Evidence" title="What it changes on a real day">
            A recorded Pune heatwave day ({CASE_DATE}), replayed through the full pipeline.
            Every number below is engine output, and the case where KAVACH loses is shown
            next to the ones where it wins.
          </SectionHead>

          <div className="mt-8">
            <CaseHead run={m4} kicker="Headline" />
            <Comparison run={m4} />
            <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
              More than three times the usable work, and nobody crosses the limit. Hours in
              the middle of a Zone 6 day return almost nothing, because most of each hour has
              to be spent recovering. Moving the same crew into the cool ends of the day is
              both the safe choice and the productive one.
            </p>
          </div>

          <div className="mt-10">
            <CaseHead run={m6} kicker="The case we lose" />
            <Comparison run={m6} />
            <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
              At very heavy labour, the same day cannot safely deliver what a normal day
              appears to — {hours(m6.baseline.labourHours)} labour-hours become{" "}
              {hours(m6.kavach.labourHours)}. The &ldquo;normal&rdquo; figure is bought by a
              worker crossing the limit {m6.baseline.minutesToLimit} minutes into the shift.
              KAVACH says so on screen rather than rigging the comparison, and shows the way
              out: drop one step to heavy work (MET 5) and the same day gives{" "}
              <span className="tnum">
                {hours(m5.baseline.labourHours)} → {hours(m5.kavach.labourHours)}
              </span>{" "}
              labour-hours ({signedPct(m5)}) with nobody past the limit; at moderate work it
              is the headline result above.
            </p>
          </div>

          <div className="mt-10">
            <CaseHead run={nrega} kicker="Government scheme" />
            <Comparison run={nrega} />
            <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
              A rural-fringe NREGA worksite runs cooler than dense built-up Hadapsar, so the
              output gain is modest ({signedPct(nrega)}). The point here is the breach: an
              ordinary day takes a heavy-work crew past the limit by {nrega.baseline.breachAt}.
              The KAVACH schedule keeps them under it, inside the state&rsquo;s work windows.
            </p>
          </div>

          <div className="mt-10 rounded-[10px] bg-[var(--color-note-tint)] px-4 py-3.5">
            <p className="text-[12.5px] font-semibold">
              Where our two models disagree: FC Road street vendors
            </p>
            <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
              For light work (MET 3) on the same day, the body simulation predicts no breach at
              all — core temperature stays at {vendor.baseline.peakCoreC.toFixed(1)} °C even
              through a 09:00–17:00 day. The heat-stress zone, though, reaches Zone 6 at midday,
              and the zone guidance says stop outdoor work. The engines move the vendors&rsquo;
              hours to {vendor.kavach.windows.join(" and ")}, which counts as{" "}
              <span className="tnum">
                {hours(vendor.baseline.labourHours)} → {hours(vendor.kavach.labourHours)}
              </span>{" "}
              usable hours by that guidance. Because the physiology does not back it up, we do
              not headline that figure.
            </p>
          </div>

          <p className="mt-6 text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
            Bundled 217-station SHRAM snapshot, Open-Meteo archive for {CASE_DATE}, standard
            65 kg acclimatised worker. Reproduce with{" "}
            <code className="tnum">npx tsx scripts/impact-numbers.ts</code>, which fails if
            any number on this page drifts from the engines. The live console refits to the
            current feed, so its figures move with the weather; the direction holds.
            Nobody has yet worked a real shift on a KAVACH schedule — this is a carefully
            built simulation awaiting field validation.
          </p>

          <div className="mt-10">
            <p className="label">Precedent</p>
            <h3 className="mt-1.5 text-[16px] font-semibold">
              Acting on a heat forecast has worked before, at city scale
            </h3>
            <ul className="mt-3 max-w-[62ch] space-y-3 text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
              <li>
                <strong className="text-[var(--color-ink)]">Ahmedabad, 2013.</strong> After the
                May 2010 heatwave, Ahmedabad launched South Asia&rsquo;s first Heat Action Plan:
                early warnings, and clear instructions to the people who could act on them. A
                2018 pilot evaluation (Hess et al., <em>Journal of Environmental and Public
                Health</em>) estimated about 1,190 deaths avoided per year in the summers after
                — an observational estimate with a wide range (162–2,218), but the clearest
                evidence that warning plus instruction saves lives.
              </li>
              <li>
                <strong className="text-[var(--color-ink)]">Maharashtra&rsquo;s heat SOP.</strong>{" "}
                The state tells outdoor work to happen 06:00–11:00 and 16:00–20:00 during heat
                alerts, and places that duty on the employer. There is no tool to comply with
                it or to show that a site did. KAVACH schedules are built inside those windows,
                and every confirmed briefing is written to a ledger an inspector can read.
              </li>
            </ul>
            <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
              City plans reach a city. KAVACH carries the same idea down to one gate, one
              crew and one day.
            </p>
          </div>
        </section>

        {/* ---- (d) Why different ---- */}
        <section className="mt-12 border-t border-[var(--color-rule)] pt-8">
          <SectionHead kicker="Approach" title="Why KAVACH is different" />
          <ol className="mt-6 space-y-5">
            {DIFFERENT.map((d, i) => (
              <li key={d.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="tnum mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[12px] text-[var(--color-paper)]"
                >
                  {i + 1}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">{d.title}</div>
                  <p className="mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-[var(--color-ink-muted)]">
                    {d.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- (e) Scale + business model ---- */}
        <section className="mt-12 border-t border-[var(--color-rule)] pt-8">
          <SectionHead kicker="Scale" title="How it scales without hardware">
            No hardware means no rollout. Adding a site is typing its coordinates. The
            schedule is computed from public data that already covers the country, and the
            last hop is a language model, so the briefing can be in any language the
            supervisor speaks.
          </SectionHead>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-rule-strong)]">
                  <th className="label pb-2 pr-4 font-normal">Who</th>
                  <th className="label pb-2 pr-4 font-normal">What they get</th>
                  <th className="label pb-2 font-normal">Why they pay, or don&rsquo;t</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--color-rule)] align-top">
                  <td className="py-3 pr-4 font-medium">
                    State labour departments, municipal corporations
                    <div className="mt-0.5 text-[11px] font-normal text-[var(--color-ink-faint)]">B2G licence</div>
                  </td>
                  <td className="py-3 pr-4 leading-relaxed text-[var(--color-ink-muted)]">
                    A compliance ledger: which sites were briefed, which confirmed, and whether
                    each schedule sat inside the SOP windows.
                  </td>
                  <td className="py-3 leading-relaxed text-[var(--color-ink-muted)]">
                    Turns an advisory nobody can enforce into a record somebody can audit. A
                    statutory need with a budget line.
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-rule)] align-top">
                  <td className="py-3 pr-4 font-medium">
                    Contractors, gig platforms
                    <div className="mt-0.5 text-[11px] font-normal text-[var(--color-ink-faint)]">B2B subscription</div>
                  </td>
                  <td className="py-3 pr-4 leading-relaxed text-[var(--color-ink-muted)]">
                    The daily shift plan and briefing per site, the productivity ledger, and
                    heat-adjusted dispatch windows for riders.
                  </td>
                  <td className="py-3 leading-relaxed text-[var(--color-ink-muted)]">
                    On most hot days the safe schedule delivers more usable work. Output and
                    legal cover — safety is the side effect.
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-rule)] align-top">
                  <td className="py-3 pr-4 font-medium">
                    NREGA worksites
                    <div className="mt-0.5 text-[11px] font-normal text-[var(--color-ink-faint)]">Free</div>
                  </td>
                  <td className="py-3 pr-4 leading-relaxed text-[var(--color-ink-muted)]">
                    The same plans and briefings, tied to the muster-roll day.
                  </td>
                  <td className="py-3 leading-relaxed text-[var(--color-ink-muted)]">
                    A public scheme with a duty of care and no tool today. One more site costs
                    us nothing to serve.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {[
              { k: "Stations on day one", v: "~786" },
              { k: "Hardware per site", v: "None" },
              { k: "Marginal cost per site", v: "₹0" },
              { k: "Briefing languages", v: "मराठी · हिन्दी · EN" },
            ].map((x) => (
              <div key={x.k}>
                <dt className="label mb-1.5">{x.k}</dt>
                <dd className="tnum text-[18px] font-medium leading-none">{x.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- (f) Team ---- */}
        <section className="mt-12 border-t border-[var(--color-rule)] pt-8">
          <SectionHead kicker="Team" title="Brawless">
            Built for the Indradhanu 2026 International Grand Challenge at PCCOE Pune, under
            the theme AI for Climate Change (UN SDG 13).
          </SectionHead>
          <ul className="mt-5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {["Aadi Joshi", "Atharva Gilbile", "Hasan Rupawalla", "Tanvesh Deshmukh"].map((name) => (
              <li key={name} className="border-b border-[var(--color-rule)] py-3 text-[15px]">
                {name}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-12 border-t border-[var(--color-rule)] pt-6">
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/console"
              className="inline-flex items-center rounded-full bg-[var(--color-ink)] px-4 py-2 text-[13px] font-medium text-[var(--color-paper)] transition-opacity hover:opacity-85"
            >
              Open the console
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center rounded-full border border-[var(--color-rule-strong)] px-4 py-2 text-[13px] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-paper-sunk)]"
            >
              How it works
            </Link>
          </div>
          <p className="mt-5 max-w-[62ch] text-[11.5px] leading-relaxed text-[var(--color-ink-faint)]">
            Heat readings come from SHRAM (India Energy &amp; Climate Centre, UC Berkeley)
            and forecasts from Open-Meteo. The physiological simulation follows ISO 7933.
            Briefings are phrased by a Nugen aligned model and checked by the fact-lock. The
            site estimation, scheduling and productivity model are ours.
          </p>
        </footer>
      </main>
    </Chrome>
  );
}
