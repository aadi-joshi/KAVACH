"use client";

import { useEffect, useMemo, useState } from "react";
import type { Plan } from "@/lib/types";
import {
  LANGUAGES,
  briefingFacts,
  renderBriefing,
  type Language,
} from "@/lib/briefing";
import { SUGGESTED_QUESTIONS, answerQuestion } from "@/lib/ask";
import type { PhrasingResult, PhrasingSource } from "@/lib/phrasing";
import { rowId, upsertRow, type DispatchStatus } from "@/lib/compliance";
import { Callout, Explain, Panel, Pill, Segmented } from "./ui";

type Phrasing = "nugen" | "template";

/** What came back from /api/brief for one language, or why nothing did. */
type Remote = PhrasingResult | { offline: true };

interface Turn {
  q: string;
  a: string;
  source: PhrasingSource;
  note: string;
}

/**
 * One line, in plain words, saying who wrote the text on screen and whether
 * the fact-lock let it through. Never claims more than the response says.
 */
function SourceLine({ r, phrasing }: { r: Remote | undefined; phrasing: Phrasing }) {
  if (phrasing === "template") {
    return <>Template phrasing — the deterministic renderer · schedule identical</>;
  }
  if (!r) return <>Asking Nugen to phrase this plan — showing the template meanwhile</>;
  if ("offline" in r) {
    return <>Template phrasing — server unreachable, rendered on this device · schedule identical</>;
  }
  if (r.source === "nugen") {
    const n = r.factLock.checked;
    return (
      <>
        Phrased by Nugen aligned model ·{" "}
        <span className="text-[var(--color-safe)]">
          <Explain term="factLock">fact-lock</Explain> passed
        </span>{" "}
        ({n}/{n} numbers match the plan)
      </>
    );
  }
  const why =
    r.fallback?.code === "no_key"
      ? "no Nugen key configured"
      : r.fallback?.code === "no_model"
        ? "no Nugen aligned model configured"
        : r.fallback?.code === "fact_lock_rejected"
          ? "Nugen’s draft was rejected by the fact-lock"
          : "Nugen did not answer in time";
  return (
    <>
      Template phrasing — {why} · schedule identical
    </>
  );
}

function answerNote(r: PhrasingResult): string {
  if (r.source === "nugen") return `Nugen · fact-lock passed (${r.factLock.checked} numbers checked)`;
  if (r.fallback?.code === "fact_lock_rejected") {
    return `Template answer · Nugen draft rejected: ${r.factLock.rejected?.[0] ?? "unmatched number"}`;
  }
  if (r.fallback?.code === "no_key") return "Template answer · no Nugen key configured";
  return "Template answer · Nugen unavailable";
}

export function BriefingPanel({ plan }: { plan: Plan }) {
  const [lang, setLang] = useState<Language>("mr");
  const [phrasing, setPhrasing] = useState<Phrasing>("nugen");
  const [remote, setRemote] = useState<Partial<Record<Language, Remote>>>({});
  const [speaking, setSpeaking] = useState(false);
  const [dispatch, setDispatch] = useState<DispatchStatus | "idle">("idle");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);

  const facts = useMemo(() => briefingFacts(plan), [plan]);
  // The template renders instantly and offline. It is the first thing on
  // screen, and stays there if the model is unavailable or rejected.
  const local = useMemo(() => renderBriefing(facts, lang), [facts, lang]);
  const fetched = remote[lang];
  const haveFetched = fetched !== undefined;

  useEffect(() => {
    if (phrasing !== "nugen" || haveFetched) return;
    // `cancelled` means the panel moved on (unmounted, or another language
    // was picked); a plain timeout is a real failure and falls back.
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    fetch("/api/brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facts, lang }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as PhrasingResult;
        if (!cancelled) setRemote((prev) => ({ ...prev, [lang]: json }));
      })
      .catch(() => {
        if (!cancelled) setRemote((prev) => ({ ...prev, [lang]: { offline: true } }));
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [facts, lang, phrasing, haveFetched]);

  const text =
    phrasing === "nugen" && fetched && !("offline" in fetched) ? fetched.text : local;
  const rejected =
    phrasing === "nugen" && fetched && !("offline" in fetched) && !fetched.factLock.passed
      ? (fetched.factLock.rejected ?? [])
      : [];
  const nugenMeta =
    phrasing === "nugen" && fetched && !("offline" in fetched) && fetched.model
      ? [
          fetched.model,
          fetched.latencyMs !== undefined ? `${(fetched.latencyMs / 1000).toFixed(1)} s` : null,
          fetched.confidence !== undefined ? `confidence ${fetched.confidence}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  const schedule = [
    facts.blocks.length
      ? `Work ${facts.blocks.map((b) => `${b.start}–${b.end}`).join(" + ")}`
      : "No outdoor work",
    facts.rest ? `stand down ${facts.rest.start}–${facts.rest.end}` : null,
    `Zone ${facts.zone}`,
    `${facts.waterLitres} L water per worker`,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const stopSpeaking = () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      stopSpeaking();
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? "en-IN";
    u.rate = 0.92;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };

  // Switching language or writer changes the text, so whatever is being read
  // out would no longer match the screen.
  const chooseLang = (next: Language) => {
    if (speaking) stopSpeaking();
    setLang(next);
  };
  const choosePhrasing = (next: Phrasing) => {
    if (speaking) stopSpeaking();
    // Switching back to Nugen retries anything that fell back last time
    // (a timeout, an unreachable server, a rejected draft). Accepted model
    // text is kept, so the wording does not reshuffle on every toggle.
    if (next === "nugen") {
      setRemote((prev) => {
        const kept: Partial<Record<Language, Remote>> = {};
        for (const [k, v] of Object.entries(prev) as [Language, Remote][]) {
          if (!("offline" in v) && v.source === "nugen") kept[k] = v;
        }
        return kept;
      });
    }
    setPhrasing(next);
  };

  const send = () => {
    if (dispatch === "queued") return;
    setDispatch("queued");
    window.setTimeout(() => {
      upsertRow({
        id: rowId(plan.site.id, plan.date),
        siteId: plan.site.id,
        siteName: plan.site.name,
        locality: plan.site.locality,
        supervisor: plan.site.supervisor,
        phone: plan.site.phone,
        date: plan.date,
        windows: facts.blocks.map((b) => `${b.start}–${b.end}`).join(", ") || "stand down",
        zone: facts.zone,
        status: "delivered",
        sentAt: new Date().toISOString(),
        confirmedAt: null,
        lang,
      });
      setDispatch("delivered");
    }, 900);
  };

  const confirm = () => {
    upsertRow({
      id: rowId(plan.site.id, plan.date),
      siteId: plan.site.id,
      siteName: plan.site.name,
      locality: plan.site.locality,
      supervisor: plan.site.supervisor,
      phone: plan.site.phone,
      date: plan.date,
      windows: facts.blocks.map((b) => `${b.start}–${b.end}`).join(", ") || "stand down",
      zone: facts.zone,
      status: "confirmed",
      sentAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      lang,
    });
    setDispatch("confirmed");
  };

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || thinking) return;
    setQuestion("");
    setThinking(true);

    // The rule-based answer is always available, and is what is shown if the
    // model is switched off, unreachable, or fails the fact-lock.
    let turn: Turn = {
      q: trimmed,
      a: answerQuestion(trimmed, facts, lang),
      source: "template",
      note: phrasing === "template" ? "Template answer" : "Template answer · server unreachable",
    };

    if (phrasing === "nugen") {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15_000);
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ facts, lang, question: trimmed }),
          signal: controller.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as PhrasingResult & { answer: string };
          turn = { q: trimmed, a: json.answer, source: json.source, note: answerNote(json) };
        }
      } catch {
        // Keep the rule-based answer.
      } finally {
        window.clearTimeout(timer);
      }
    } else {
      await new Promise((r) => window.setTimeout(r, 200));
    }

    setChat((prev) => [...prev, turn]);
    setThinking(false);
  };

  return (
    <Panel
      step={5}
      title="What do we actually tell the supervisor?"
      subtitle={
        <>
          The plan, spoken in the language they use. Play it, send it to{" "}
          <Explain term="briefing">{plan.site.supervisor}</Explain>, then confirm receipt.
        </>
      }
      aside={
        <span className="tnum text-[11.5px] text-[var(--color-ink-muted)]">
          {plan.site.phone}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[var(--color-rule)] px-3.5 py-3">
        <Segmented
          label="Language"
          value={lang}
          onChange={chooseLang}
          options={LANGUAGES.map((l) => ({
            value: l.code,
            label: l.native,
            title: l.label,
          }))}
        />
        <Segmented
          label="Phrasing"
          value={phrasing}
          onChange={choosePhrasing}
          options={[
            { value: "nugen", label: "Nugen", title: "Nugen aligned model, held to the plan by the fact-lock" },
            { value: "template", label: "Template", title: "Deterministic renderer, no language model" },
          ]}
        />
        {dispatch !== "idle" && (
          <Pill tone={dispatch === "confirmed" ? "ok" : dispatch === "delivered" ? "neutral" : "warn"}>
            {dispatch === "queued"
              ? `Calling ${plan.site.phone}…`
              : dispatch === "delivered"
                ? "Delivered · waiting for confirmation"
                : "Supervisor confirmed"}
          </Pill>
        )}
      </div>

      <div className="px-3.5 py-3.5">
        <blockquote
          lang={LANGUAGES.find((l) => l.code === lang)?.bcp47}
          className="m-0 whitespace-pre-line border-l-2 border-[var(--color-ink)] bg-[var(--color-paper-sunk)] px-4 py-3.5 text-[13.5px] leading-[1.75]"
        >
          {text}
        </blockquote>

        <div className="mt-2.5 space-y-1" aria-live="polite">
          <p className="text-[11.5px] leading-snug text-[var(--color-ink-muted)]">
            <SourceLine r={fetched} phrasing={phrasing} />
          </p>
          {nugenMeta && (
            <p className="tnum text-[10.5px] leading-snug text-[var(--color-ink-faint)]">
              {nugenMeta}
            </p>
          )}
          {rejected.length > 0 && (
            <details className="text-[11.5px] leading-snug text-[var(--color-ink-muted)]">
              <summary className="cursor-pointer text-[var(--color-ink-faint)]">
                Why the model&rsquo;s draft was rejected
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {rejected.map((r) => (
                  <li key={r} className="list-disc">
                    {r}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="tnum text-[10.5px] leading-snug text-[var(--color-ink-faint)]">
            Schedule, whichever writer: {schedule}
          </p>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={speak}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-2 text-[12.5px] font-medium text-[var(--color-paper)] transition-opacity hover:opacity-85"
          >
            {speaking ? "Stop" : "Play this out loud"}
          </button>

          {dispatch === "idle" || dispatch === "queued" ? (
            <button
              type="button"
              onClick={send}
              disabled={dispatch === "queued"}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-rule-strong)] px-4 py-2 text-[12.5px] font-medium text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-paper-sunk)] disabled:opacity-50"
            >
              {dispatch === "queued" ? "Sending…" : "Send briefing"}
            </button>
          ) : dispatch === "delivered" ? (
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-safe)] px-4 py-2 text-[12.5px] font-medium text-[var(--color-safe)] transition-colors hover:bg-[var(--color-safe-tint)]"
            >
              Mark as confirmed
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDispatch("idle")}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-safe)] px-4 py-2 text-[12.5px] font-medium text-[var(--color-safe)]"
            >
              Confirmed · {plan.site.supervisor}
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-[var(--color-rule)] pt-4">
          <div className="label mb-1.5">Ask about this plan</div>
          <p className="mb-2.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            Answers use this site&rsquo;s times, water volumes and zone — nothing else. A
            model answer with any number not in the plan is replaced by the rule-based one.
          </p>

          {chat.length > 0 && (
            <ul className="mb-3 space-y-2.5">
              {chat.map((turn, i) => (
                <li key={i} className="text-[13px] leading-relaxed">
                  <div className="text-[11.5px] text-[var(--color-ink-faint)]">{turn.q}</div>
                  <div className="mt-0.5">{turn.a}</div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--color-ink-faint)]">
                    {turn.note}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                lang === "mr"
                  ? "उदा. दुपारी काम करू का?"
                  : lang === "hi"
                    ? "जैसे: दोपहर में काम करें?"
                    : "e.g. Can we work after lunch?"
              }
              className="min-w-[220px] flex-1 rounded-full border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3.5 py-2 text-[13px] outline-none focus:border-[var(--color-ink)]"
            />
            <button
              type="submit"
              disabled={thinking}
              className="rounded-full border border-[var(--color-ink)] px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
            >
              {thinking ? "…" : "Ask"}
            </button>
          </form>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS[lang].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void ask(q)}
                className="rounded-full border border-[var(--color-rule)] px-2.5 py-1 text-[11.5px] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-paper-sunk)]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Callout tone="safe" title="The briefing cannot change the schedule">
            Times, temperatures and water volumes are calculated first. The Nugen model
            only phrases them, and its text is shown only if every number in it matches the
            plan. Switch the phrasing above: the words change, the schedule line does not.
            Confirming a briefing writes it to the compliance ledger.
          </Callout>
        </div>
      </div>
    </Panel>
  );
}
