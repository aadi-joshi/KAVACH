import { FALLBACK_STATIONS } from "../src/lib/fallback";
import { buildPlan, ledgerDelta } from "../src/lib/plan";
import { getSite } from "../src/lib/sites";
import { fmt } from "../src/lib/optimizer";
import { CORE_TEMP_CEILING } from "../src/lib/phs";
import { CASES, CASE_DATE, type CaseRun } from "../src/lib/impact";

/**
 * Recomputes every case study quoted on /impact and checks it against
 * src/lib/impact.ts, so the page cannot drift from the engines.
 *
 * Uses the recorded heatwave day from the Open-Meteo archive and the bundled
 * SHRAM snapshot. Needs network for the archive; offline, the grid falls back
 * to a synthetic day and this script will (correctly) report a mismatch.
 */

let mismatches = 0;

function check(label: string, actual: unknown, expected: unknown, tol = 0) {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) <= tol
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    mismatches++;
    console.log(`    MISMATCH ${label}: engine ${JSON.stringify(actual)} vs page ${JSON.stringify(expected)}`);
  }
}

async function run(name: string, c: CaseRun) {
  const site = getSite(c.siteId)!;
  const { plan } = await buildPlan({
    site, stations: FALLBACK_STATIONS, scenario: "heatwave", metLevel: c.met,
  });
  const b = plan.baseline;
  const o = plan.optimised;
  const d = ledgerDelta(plan);
  const breach = b.strain.breachAtClock !== null ? fmt(b.strain.breachAtClock) : null;
  const basePeak =
    b.strain.peakCoreTempC >= CORE_TEMP_CEILING - 1e-6 ? null : Number(b.strain.peakCoreTempC.toFixed(2));
  const windows = plan.blocks.map((x) => `${fmt(x.startMin)}–${fmt(x.endMin)}`);

  console.log(`\n${name} — ${plan.site.name}, MET ${c.met}, ${plan.site.workers} workers, ${plan.date}`);
  console.log(`  normal 09:00–17:00   ${b.ledger.effectiveLabourHours.toFixed(2)} labour-h | peak core ${basePeak ?? "past model range"} | limit crossed ${breach ?? "never"}${b.strain.dLimCoreMin ? ` after ${b.strain.dLimCoreMin} min` : ""}`);
  console.log(`  KAVACH ${windows.join(" + ").padEnd(14)} ${o.ledger.effectiveLabourHours.toFixed(2)} labour-h | peak core ${o.strain.peakCoreTempC.toFixed(2)} | safe ${o.strain.safe} | SOP ${o.ledger.sopCompliant}`);
  console.log(`  change               ${d.deltaHours >= 0 ? "+" : ""}${d.deltaHours.toFixed(1)} h (${d.deltaPct >= 0 ? "+" : ""}${d.deltaPct.toFixed(0)}%)`);

  check(`${name} date`, plan.date, CASE_DATE);
  check(`${name} workers`, plan.site.workers, c.workers);
  check(`${name} baseline labour`, b.ledger.effectiveLabourHours, c.baseline.labourHours, 0.05);
  check(`${name} baseline peak`, basePeak, c.baseline.peakCoreC, 0.005);
  check(`${name} breach`, breach, c.baseline.breachAt);
  check(`${name} minutes to limit`, b.strain.dLimCoreMin, c.baseline.minutesToLimit);
  check(`${name} windows`, windows, c.kavach.windows);
  check(`${name} kavach labour`, o.ledger.effectiveLabourHours, c.kavach.labourHours, 0.05);
  check(`${name} kavach peak`, Number(o.strain.peakCoreTempC.toFixed(2)), c.kavach.peakCoreC, 0.005);
  check(`${name} SOP`, o.ledger.sopCompliant, c.kavach.sopCompliant);
  check(`${name} kavach safe`, o.strain.safe, true);
}

async function main() {
  for (const [name, c] of Object.entries(CASES)) await run(name, c);
  console.log(mismatches ? `\n${mismatches} figure(s) on /impact differ from the engines.` : "\nEvery /impact figure matches the engines.");
  process.exit(mismatches ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
