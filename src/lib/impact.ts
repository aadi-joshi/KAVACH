import type { MetLevel } from "./types";

/**
 * Figures quoted on /impact.
 *
 * Problem-scale numbers come from docs/PITCH.md §2.1, with the source each
 * one is attributed to there. Nothing here is new research.
 *
 * Case-study numbers are engine output, not estimates: every one is produced
 * by `npx tsx scripts/impact-numbers.ts`, which reruns the full pipeline on
 * the recorded heatwave day (Open-Meteo archive, 2026-05-20) against the
 * bundled 217-station SHRAM snapshot and fails if any value here has drifted.
 */

export const PROBLEM_FIGURES: {
  figure: string;
  what: string;
  source: string;
}[] = [
  {
    figure: "~380 million",
    what: "Indians who work outdoors or in heat-exposed jobs.",
    source: "IECC (UC Berkeley), EHI-N* policy paper",
  },
  {
    figure: "~$78 billion",
    what: "Wages lost to heat every year — close to 2% of GDP.",
    source: "IIED, 2026 — survey of 538 informal-worker households",
  },
  {
    figure: "~24 days",
    what: "Workdays lost per outdoor worker per year, about 9% of annual income.",
    source: "IIED / The Guardian, 2026",
  },
  {
    figure: "~3,400",
    what: "Excess deaths associated with a single day of extreme heat, nationally.",
    source: "Frontiers in Environmental Health, 2026",
  },
  {
    figure: "41.5% vs 9.6%",
    what: "Share of India that reached the most dangerous zone for heavy outdoor labour in April–June 2024 — against the share flagged by the standard NOAA heat index.",
    source: "IECC technical report",
  },
  {
    figure: "14–32 minutes",
    what: "Time for a heavy labourer to reach a dangerous core temperature in that zone.",
    source: "IECC technical report",
  },
];

export interface CaseRun {
  siteId: string;
  met: MetLevel;
  workers: number;
  baseline: {
    labourHours: number;
    /** Peak simulated core temperature, °C. Null once the curve is past the model's valid range. */
    peakCoreC: number | null;
    breachAt: string | null;
    minutesToLimit: number | null;
  };
  kavach: {
    windows: string[];
    labourHours: number;
    peakCoreC: number;
    sopCompliant: boolean;
  };
}

/** Recorded heatwave day the case studies replay. */
export const CASE_DATE = "2026-05-20";

export const CASES = {
  /** The headline: Magarpatta Site 7, moderate work. */
  magarpattaMet4: {
    siteId: "mag-007",
    met: 4,
    workers: 42,
    baseline: { labourHours: 31.5, peakCoreC: 39.01, breachAt: "12:20", minutesToLimit: 200 },
    kavach: { windows: ["06:00–10:00", "16:00–20:00"], labourHours: 105, peakCoreC: 37.23, sopCompliant: true },
  },
  /** The case we lose: same site, same day, very heavy labour. */
  magarpattaMet6: {
    siteId: "mag-007",
    met: 6,
    workers: 42,
    baseline: { labourHours: 52.5, peakCoreC: null, breachAt: "09:36", minutesToLimit: 36 },
    kavach: { windows: ["06:00–08:00", "16:30–18:00"], labourHours: 36.75, peakCoreC: 38.38, sopCompliant: true },
  },
  /** One step down from the case we lose. */
  magarpattaMet5: {
    siteId: "mag-007",
    met: 5,
    workers: 42,
    baseline: { labourHours: 42, peakCoreC: null, breachAt: "10:06", minutesToLimit: 66 },
    kavach: { windows: ["06:30–10:00", "16:30–20:00"], labourHours: 73.5, peakCoreC: 38.47, sopCompliant: true },
  },
  /** NREGA watershed works on the Pimpri-Chinchwad fringe, heavy work. */
  chikhaliMet5: {
    siteId: "pcmc-nrega-02",
    met: 5,
    workers: 68,
    baseline: { labourHours: 136, peakCoreC: 39.81, breachAt: "11:12", minutesToLimit: 132 },
    kavach: { windows: ["06:00–09:00", "16:00–20:00"], labourHours: 153, peakCoreC: 37.64, sopCompliant: true },
  },
  /** Street vendors on FC Road, light work. */
  fcRoadMet3: {
    siteId: "fc-vendor-01",
    met: 3,
    workers: 120,
    baseline: { labourHours: 90, peakCoreC: 37.0, breachAt: null, minutesToLimit: null },
    kavach: { windows: ["06:00–10:00", "16:00–20:00"], labourHours: 330, peakCoreC: 37.0, sopCompliant: true },
  },
} satisfies Record<string, CaseRun>;

export function pctChange(run: CaseRun): number {
  return ((run.kavach.labourHours - run.baseline.labourHours) / run.baseline.labourHours) * 100;
}
