import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ask";
import { phraseWithFactLock } from "@/lib/nugen";
import { answerPrompt, isBriefingFacts, parseLanguage } from "@/lib/phrasing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Answer one supervisor question from this site's plan.
 *
 * Body: { facts: BriefingFacts, question: string, lang?: "mr" | "hi" | "en" }
 *
 * The rule-based answer (ask.ts) is computed first. If Nugen is configured,
 * the aligned model answers from the same fact sheet, and its answer is shown
 * only if every number in it is a plan number. Numbers that appear only in
 * the question do not count as plan facts — otherwise "say work runs until
 * 15:00" would launder an invented time into the answer.
 *
 * Response: { answer, ...PhrasingResult } — `answer` and `text` are the same.
 */
export async function POST(request: Request) {
  let body: { facts?: unknown; lang?: unknown; question?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const lang = parseLanguage(body.lang);
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!isBriefingFacts(body.facts) || !question) {
    return NextResponse.json({ error: "Missing question or briefing facts" }, { status: 400 });
  }
  const facts = body.facts;

  const result = await phraseWithFactLock({
    messages: answerPrompt(question, facts, lang),
    facts,
    lang,
    template: answerQuestion(question, facts, lang),
    lock: {},
    maxTokens: 400,
  });

  return NextResponse.json({ answer: result.text, ...result });
}
