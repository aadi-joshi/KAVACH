import { FALLBACK_STATIONS } from "../src/lib/fallback";
import { buildPlan } from "../src/lib/plan";
import { SITES } from "../src/lib/sites";
import { briefingFacts, renderBriefing, type Language } from "../src/lib/briefing";
import { SUGGESTED_QUESTIONS, answerQuestion } from "../src/lib/ask";
import { factLock } from "../src/lib/factlock";
import { cleanModelText } from "../src/lib/phrasing";
import type { MetLevel } from "../src/lib/types";

/**
 * Fact-lock self-test.
 *
 *  1. Every deterministic template — every site, every work intensity, every
 *     language, briefing and Q&A — must pass the fact-lock. If the template
 *     fails, the check is too strict to be trusted with a model's output.
 *  2. Tampered versions of a real briefing must be rejected: a shifted work
 *     window, an invented number, a dropped window, the wrong script.
 *
 * Runs offline against the bundled station snapshot (the heatwave grid is
 * fetched from Open-Meteo when reachable, synthesised when not).
 */

const LANGS: Language[] = ["mr", "hi", "en"];
let failures = 0;

function expect(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  console.log("\n1. Templates pass their own fact-lock");
  let templates = 0;
  let numbers = 0;
  for (const site of SITES) {
    for (const met of [3, 4, 5, 6] as MetLevel[]) {
      for (const scenario of ["heatwave", "live"] as const) {
        const { plan } = await buildPlan({ site, stations: FALLBACK_STATIONS, scenario, metLevel: met });
        const f = briefingFacts(plan);
        for (const lang of LANGS) {
          const brief = renderBriefing(f, lang);
          const v = factLock(brief, f, { requireWindows: true, requireWater: true, lang });
          templates++;
          numbers += v.checked;
          if (!v.passed) expect(`${site.id} MET ${met} ${scenario} ${lang} briefing`, false, v.rejected?.join("; "));
          for (const q of [...SUGGESTED_QUESTIONS[lang], "what is the core temperature?", "which zone?", "how many workers?", "shade?"]) {
            const a = answerQuestion(q, f, lang);
            const va = factLock(a, f, { lang });
            templates++;
            numbers += va.checked;
            if (!va.passed) expect(`${site.id} MET ${met} ${lang} answer "${q}"`, false, va.rejected?.join("; "));
          }
        }
      }
    }
  }
  expect(`${templates} template texts, ${numbers} numbers checked`, failures === 0);

  console.log("\n2. Tampered briefings are rejected");
  const { plan } = await buildPlan({
    site: SITES[0], stations: FALLBACK_STATIONS, scenario: "heatwave", metLevel: 4,
  });
  const f = briefingFacts(plan);
  const lock = { requireWindows: true, requireWater: true } as const;
  const en = renderBriefing(f, "en");
  const mr = renderBriefing(f, "mr");
  const first = f.blocks[0];
  console.log(`   plan: ${f.blocks.map((b) => `${b.start}–${b.end}`).join(", ")}, water ${f.waterLitres} L, zone ${f.zone}`);

  const shifted = en.replace(first.end, "13:00");
  const v1 = factLock(shifted, f, { ...lock, lang: "en" });
  expect("work window end moved to 13:00", !v1.passed, v1.rejected?.join("; "));

  const invented = en.replace("Reply YES", "Take a 25 minute break at noon. Reply YES");
  const v2 = factLock(invented, f, { ...lock, lang: "en" });
  expect("invented '25 minute' break", !v2.passed, v2.rejected?.join("; "));

  // 20 is the hour of a real window end (20:00) and the day of the date —
  // still not a licence to write "20 minutes".
  const lookalike = en.replace("Reply YES", "Rest 20 minutes every hour. Reply YES");
  const v2b = factLock(lookalike, f, { ...lock, lang: "en" });
  expect("bare '20' that only looks like a plan hour", !v2b.passed, v2b.rejected?.join("; "));

  const v2c = factLock(en.replace(f.date, "20 May 2026"), f, { ...lock, lang: "en" });
  expect("date rewritten in another format", !v2c.passed, v2c.rejected?.join("; "));

  const dropped = en.replace(`, ${f.blocks[1]?.start}–${f.blocks[1]?.end}`, "");
  const v3 = factLock(dropped, f, { ...lock, lang: "en" });
  expect("second work window dropped", !v3.passed || f.blocks.length < 2, v3.rejected?.join("; "));

  const water = en.replace(`${f.waterLitres} litres`, `${(f.waterLitres + 1).toFixed(1)} litres`);
  const v4 = factLock(water, f, { ...lock, lang: "en" });
  expect("water volume changed", !v4.passed, v4.rejected?.join("; "));

  const v5 = factLock(en, f, { ...lock, lang: "mr" });
  expect("English text offered as Marathi", !v5.passed, v5.rejected?.join("; "));

  console.log("\n3. Equivalent forms are accepted");
  const deva = mr.replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)]);
  const v6 = factLock(deva, f, { ...lock, lang: "mr" });
  expect("Marathi briefing with all-Devanagari digits", v6.passed, v6.rejected?.join("; ") ?? `${v6.checked} numbers`);

  const twelve = en.replace(/\b16:00\b/g, "4:00 PM").replace(/\b20:00\b/g, "8:00 pm");
  const v7 = factLock(twelve, f, { ...lock, lang: "en" });
  expect("12-hour clock with am/pm", v7.passed, v7.rejected?.join("; ") ?? `${v7.checked} numbers`);

  const thought = cleanModelText(`<think>The window is 06:00 to 10:00, maybe 11:30?</think>\n**${en}**`);
  const v8 = factLock(thought, f, { ...lock, lang: "en" });
  expect("reasoning trace stripped before checking", v8.passed && !thought.includes("think"), v8.rejected?.join("; "));

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll fact-lock checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
