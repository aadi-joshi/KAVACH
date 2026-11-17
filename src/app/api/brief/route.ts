import { NextResponse } from "next/server";
import { renderBriefing } from "@/lib/briefing";
import { phraseWithFactLock } from "@/lib/nugen";
import { briefingPrompt, isBriefingFacts, parseLanguage } from "@/lib/phrasing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Phrase a finished plan as a spoken supervisor briefing.
 *
 * Body: { facts: BriefingFacts, lang?: "mr" | "hi" | "en" }
 *
 * The deterministic template is rendered first. If a Nugen key is configured
 * the aligned model is asked to phrase the same facts; its text is returned
 * only if it passes the fact-lock (no number outside the plan, every work
 * window present, the water volume present, the right script). Either way the
 * response says which writer produced the text, and why.
 *
 * Response: PhrasingResult (src/lib/phrasing.ts)
 *   { text, lang, source: "nugen" | "template", model?, latencyMs?,
 *     confidence?, factLock: { passed, checked, rejected?, subject },
 *     fallback?: { code, message } }
 */
export async function POST(request: Request) {
  let body: { facts?: unknown; lang?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const lang = parseLanguage(body.lang);
  if (!isBriefingFacts(body.facts)) {
    return NextResponse.json({ error: "Missing or malformed briefing facts" }, { status: 400 });
  }
  const facts = body.facts;

  const result = await phraseWithFactLock({
    messages: briefingPrompt(facts, lang),
    facts,
    lang,
    template: renderBriefing(facts, lang),
    lock: { requireWindows: true, requireWater: true },
    maxTokens: 800,
  });

  return NextResponse.json(result);
}
