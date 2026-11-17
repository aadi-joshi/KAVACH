import type { BriefingFacts, Language } from "./briefing";
import { SOP_WINDOWS, fmt } from "./optimizer";
import { CORE_TEMP_LIMIT } from "./phs";

/**
 * Fact-lock.
 *
 * The language model is allowed to choose words. It is not allowed to choose
 * numbers. Every time, volume, zone, head-count and temperature in a phrased
 * briefing has to be one the engines already produced, so this module pulls
 * every number out of the model's text and checks it against the plan.
 *
 * One unmatched number is enough to reject the whole text: a briefing that is
 * 95% right and says "work until 13:00" is worse than no briefing at all.
 *
 * The check is deliberately mechanical. It does not understand Marathi; it
 * does not need to. It only needs to know which numbers exist in the plan.
 */

export interface FactLockResult {
  passed: boolean;
  /** How many numbers and times were found in the text and checked. */
  checked: number;
  /** Plain-English reasons for rejection. Absent when the check passed. */
  rejected?: string[];
}

export interface FactLockOptions {
  /** Require every work window's start and end time to appear. */
  requireWindows?: boolean;
  /** Require the per-worker water volume to appear. */
  requireWater?: boolean;
  /** Require the text to be written mostly in this language's script. */
  lang?: Language;
}

/**
 * Values that are not part of a particular plan but that every plan is judged
 * against, and which the deterministic templates themselves quote: the
 * unmanaged 09:00–17:00 day, the 38.5 °C core-temperature limit, and
 * Maharashtra's 06:00–11:00 / 16:00–20:00 outdoor-work windows.
 */
const BASELINE_TIMES = ["09:00", "17:00"];
const SOP_TIMES = SOP_WINDOWS.flatMap((w) => [fmt(w.startMin), fmt(w.endMin)]);

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Devanagari digits to ASCII, and drop thousands separators between digits. */
export function normaliseDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const i = DEVANAGARI_DIGITS.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  // "2,940" -> "2940", "1,23,456" -> "123456". A comma followed by a space
  // ("06:00, 16:00") is a list separator and is left alone.
  return out.replace(/(\d),(?=\d{2,3}(?!\d))/g, "$1");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function digitsOf(text: string): number[] {
  return (normaliseDigits(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

interface Allowed {
  times: Set<string>;
  numbers: number[];
  date: { y: number; m: number; d: number } | null;
}

/** Everything a phrased text is allowed to quote, derived from the plan. */
export function allowedValues(f: BriefingFacts): Allowed {
  const planTimes = [
    ...f.blocks.flatMap((b) => [b.start, b.end]),
    ...(f.rest ? [f.rest.start, f.rest.end] : []),
    ...(f.breachAt ? [f.breachAt] : []),
  ];
  const times = new Set([...planTimes, ...BASELINE_TIMES, ...SOP_TIMES]);

  // Deliberately narrow. A bare "20" is not accepted just because the plan
  // has a 20:00 or the date is the 20th — "take a 20 minute break" would then
  // pass. Times must be written as times and the date as a date. When in
  // doubt the fact-lock rejects: a false rejection costs nicer wording, a
  // false acceptance costs a wrong instruction.
  const numbers: number[] = [
    f.zone,
    f.workers,
    f.waterLitres,
    Math.round(f.waterLitres * f.workers),
    Number(f.peakCoreTempC.toFixed(1)),
    Number(f.peakCoreTempC.toFixed(2)),
    Math.abs(f.effectiveHoursDelta),
    CORE_TEMP_LIMIT,
    // Rest pattern minutes, e.g. "30 min work / 30 min rest".
    ...digitsOf(f.cadence),
    // Digits that are part of a name: "Magarpatta Site 7", "Tower 3".
    ...digitsOf(f.siteName),
    ...digitsOf(f.supervisor),
  ];

  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date);
  const date = dm ? { y: Number(dm[1]), m: Number(dm[2]), d: Number(dm[3]) } : null;

  return { times, numbers, date };
}

function numberAllowed(value: number, allowed: Allowed): boolean {
  return allowed.numbers.some((n) => Math.abs(n - value) < 1e-6);
}

/**
 * Script check. A Marathi or Hindi text must be written in Devanagari, and an
 * English one in Latin script. Site and person names are allowed to stay in
 * Latin script, so they are removed before counting.
 */
function scriptOk(text: string, lang: Language, f: BriefingFacts): boolean {
  const body = [f.siteName, f.supervisor]
    .filter(Boolean)
    .reduce((t, name) => t.split(name).join(" "), text);
  const deva = (body.match(/[ऀ-ॿ]/g) ?? []).length;
  const latin = (body.match(/[A-Za-z]/g) ?? []).length;
  if (lang === "en") return latin > 0 && deva <= latin * 0.1;
  return deva > 0 && deva >= latin;
}

/**
 * Check a phrased text against the plan it claims to describe.
 *
 * Order matters: dates are consumed first (so 2026-05-20 is not read as three
 * numbers), then clock times (so 16:00 is not read as 16 and 0), then any
 * remaining number.
 */
export function factLock(
  text: string,
  f: BriefingFacts,
  opts: FactLockOptions = {},
): FactLockResult {
  const allowed = allowedValues(f);
  const rejected: string[] = [];
  const seenTimes = new Set<string>();
  const seenNumbers: number[] = [];
  let checked = 0;

  if (opts.lang && !scriptOk(text, opts.lang, f)) {
    rejected.push(
      opts.lang === "en"
        ? "not written in English"
        : "not written in Devanagari script",
    );
  }

  let rest = normaliseDigits(text);

  // 1. Dates: 2026-05-20, 20/05/2026, 20-05-2026, 20.05.2026.
  rest = rest.replace(
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b|\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g,
    (match, y1, m1, d1, d2, m2, y2) => {
      checked++;
      const y = Number(y1 ?? y2);
      const m = Number(m1 ?? m2);
      const d = Number(d1 ?? d2);
      const ok =
        allowed.date !== null &&
        allowed.date.y === y &&
        allowed.date.m === m &&
        allowed.date.d === d;
      if (!ok) rejected.push(`date ${match} is not the plan date ${f.date}`);
      return " ";
    },
  );

  // 2. Clock times: 06:00, 6:00, 16.30, optionally followed by am/pm.
  rest = rest.replace(
    /(^|[^\d.])(\d{1,2})([:.])(\d{2})(?!\d)(\s*(?:a\.?m\.?|p\.?m\.?)(?![a-z]))?/gi,
    (
      match: string,
      lead: string,
      hs: string,
      sep: string,
      ms: string,
      ampm: string | undefined,
    ) => {
      let h = Number(hs);
      const m = Number(ms);
      const isClock = h <= 24 && m < 60;

      if (!isClock) {
        // "38.50" or "37.23" — a decimal, not a time. Leave it for step 3.
        return match;
      }

      checked++;
      const marker = ampm?.trim().toLowerCase().replace(/\./g, "");
      if (marker === "pm" && h < 12) h += 12;
      if (marker === "am" && h === 12) h = 0;
      const t = `${pad2(h)}:${pad2(m)}`;
      const shown = match.slice(lead.length).trim();

      if (allowed.times.has(t)) {
        seenTimes.add(t);
        return `${lead} `;
      }
      // "12.20" is ambiguous: a time written with a dot, or a decimal. It
      // passes if either reading is a plan value.
      if (sep === "." && !ampm && numberAllowed(Number(`${hs}.${ms}`), allowed)) {
        seenNumbers.push(Number(`${hs}.${ms}`));
        return `${lead} `;
      }
      rejected.push(`time ${shown} is not in the plan`);
      return `${lead} `;
    },
  );

  // 3. Everything else that looks like a number.
  for (const match of rest.match(/\d+(?:\.\d+)?/g) ?? []) {
    checked++;
    const value = Number(match);
    if (numberAllowed(value, allowed)) {
      seenNumbers.push(value);
    } else {
      rejected.push(`number ${match} is not in the plan`);
    }
  }

  // 4. Required facts. A briefing that leaves out a work window is not a
  //    shorter briefing, it is a different schedule.
  if (opts.requireWindows) {
    for (const b of f.blocks) {
      if (!seenTimes.has(b.start) || !seenTimes.has(b.end)) {
        rejected.push(`work window ${b.start}–${b.end} is missing`);
      }
    }
  }
  if (opts.requireWater && !seenNumbers.some((n) => Math.abs(n - f.waterLitres) < 1e-6)) {
    rejected.push(`water volume ${f.waterLitres} L per worker is missing`);
  }

  return rejected.length
    ? { passed: false, checked, rejected: [...new Set(rejected)] }
    : { passed: true, checked };
}
