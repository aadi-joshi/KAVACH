import "server-only";

import type { BriefingFacts, Language } from "./briefing";
import { factLock, type FactLockOptions } from "./factlock";
import {
  cleanModelText,
  type ChatMessage,
  type FallbackCode,
  type PhrasingResult,
} from "./phrasing";

/**
 * Nugen Intelligence client — aligned-model inference.
 *
 * API (docs.nugen.in, API reference → Inference → Generate chat completions):
 *
 *   POST https://api.nugen.in/api/v3/inference/chat/completions
 *   Authorization: Bearer <NUGEN_API_KEY>
 *   { model, messages: [{ role, content }], max_tokens, temperature, stream }
 *
 *   → { id, object: "chat.completion", model,
 *       choices: [{ index, message: { role, content }, finish_reason }],
 *       usage, confidence_score }
 *
 * `model` is the id of a deployed aligned model (GET /api/v3/models/aligned,
 * deployment_status "DEPLOYED"). `stream` defaults to true on Nugen, so it is
 * sent as false explicitly; the parser still accepts a server-sent-event body
 * in case a deployment streams anyway.
 *
 * Configuration (all server-side, never sent to the browser):
 *   NUGEN_API_KEY    required to enable the model at all
 *   NUGEN_MODEL      aligned model id; if unset, the first DEPLOYED aligned
 *                    model on the account is discovered and used
 *   NUGEN_BASE_URL   defaults to https://api.nugen.in/api/v3/inference
 *   NUGEN_TIMEOUT_MS defaults to 8000
 *
 * Nothing in this module throws to its caller. Every failure becomes a typed
 * result, and the route falls back to the deterministic template.
 */

const DEFAULT_BASE_URL = "https://api.nugen.in/api/v3/inference";
const DEFAULT_TIMEOUT_MS = 8000;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

/** Aligned model found on the account when NUGEN_MODEL is not set. */
let discovered: { model: string; at: number } | null = null;

export interface NugenConfig {
  apiKey: string;
  /** Explicit model id, or null to discover one. */
  model: string | null;
  baseUrl: string;
  timeoutMs: number;
}

export function nugenConfig(): NugenConfig | null {
  const apiKey = process.env.NUGEN_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.NUGEN_MODEL?.trim() || null;
  const baseUrl = (process.env.NUGEN_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const parsed = Number(process.env.NUGEN_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(30_000, Math.max(1_000, parsed))
      : DEFAULT_TIMEOUT_MS;
  return { apiKey, model, baseUrl, timeoutMs };
}

/** What a status endpoint may safely say about the configuration. */
export function nugenPublicStatus(): { configured: boolean; model: string | null } {
  const cfg = nugenConfig();
  return { configured: cfg !== null, model: cfg?.model ?? discovered?.model ?? null };
}

export type NugenChatResult =
  | {
      ok: true;
      text: string;
      model: string;
      confidence: number | null;
      finishReason: string | null;
      latencyMs: number;
    }
  | {
      ok: false;
      code: Exclude<FallbackCode, "fact_lock_rejected">;
      message: string;
      model?: string;
      latencyMs?: number;
    };

function describeError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return `no reply within ${Math.round(timeoutMs / 1000)} s`;
    }
    return error.message.slice(0, 160);
  }
  return "unknown error";
}

/**
 * Find a deployed aligned model on the account, for when NUGEN_MODEL is not
 * set. Only DEPLOYED models serve inference.
 */
async function discoverAlignedModel(cfg: NugenConfig, budgetMs: number): Promise<string | null> {
  if (discovered && Date.now() - discovered.at < DISCOVERY_TTL_MS) return discovered.model;
  try {
    const url = `${new URL(cfg.baseUrl).origin}/api/v3/models/aligned`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(500, budgetMs)),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const list = Array.isArray(json)
      ? json
      : ((json as Record<string, unknown>)?.domain_aligned_models ??
        (json as Record<string, unknown>)?.models ??
        (json as Record<string, unknown>)?.data);
    if (!Array.isArray(list)) return null;
    const deployed = list.find(
      (m): m is { model_id: string } =>
        !!m &&
        typeof (m as { model_id?: unknown }).model_id === "string" &&
        String((m as { deployment_status?: unknown }).deployment_status).toUpperCase() ===
          "DEPLOYED",
    );
    if (!deployed) return null;
    discovered = { model: deployed.model_id, at: Date.now() };
    return deployed.model_id;
  } catch {
    return null;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof (part as { text?: unknown })?.text === "string"
            ? (part as { text: string }).text
            : "",
      )
      .join("");
  }
  return "";
}

interface Parsed {
  text: string;
  model: string | null;
  confidence: number | null;
  finishReason: string | null;
}

/** Non-streaming JSON body. */
function parseJson(body: string): Parsed | null {
  const json = JSON.parse(body) as {
    model?: unknown;
    confidence_score?: unknown;
    choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
  };
  const choice = json.choices?.[0];
  if (!choice) return null;
  return {
    text: contentToText(choice.message?.content),
    model: typeof json.model === "string" ? json.model : null,
    confidence: typeof json.confidence_score === "number" ? json.confidence_score : null,
    finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
  };
}

/** Server-sent-event body: chunk deltas plus interleaved confidence events. */
function parseSse(body: string): Parsed {
  let text = "";
  let model: string | null = null;
  let finishReason: string | null = null;
  const scores: number[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as {
        object?: unknown;
        model?: unknown;
        confidence_score?: unknown;
        choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
      };
      if (typeof event.model === "string") model = event.model;
      if (event.object === "confidence" && typeof event.confidence_score === "number") {
        scores.push(event.confidence_score);
        continue;
      }
      const choice = event.choices?.[0];
      text += contentToText(choice?.delta?.content);
      if (typeof choice?.finish_reason === "string") finishReason = choice.finish_reason;
    } catch {
      // A malformed event is skipped, not fatal.
    }
  }
  const confidence = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
  return { text, model, confidence, finishReason };
}

/** One chat-completion call. Never throws. */
export async function nugenChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<NugenChatResult> {
  const cfg = nugenConfig();
  if (!cfg) {
    return { ok: false, code: "no_key", message: "no Nugen key configured" };
  }

  const started = Date.now();
  const deadline = started + cfg.timeoutMs;

  const model = cfg.model ?? (await discoverAlignedModel(cfg, Math.min(3000, cfg.timeoutMs / 2)));
  if (!model) {
    return {
      ok: false,
      code: "no_model",
      message: "Nugen key set, but no NUGEN_MODEL and no deployed aligned model found",
      latencyMs: Date.now() - started,
    };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 700,
        temperature: opts.temperature ?? 0.3,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(500, deadline - Date.now())),
    });

    const body = await res.text();
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const detail = body.replace(/\s+/g, " ").slice(0, 120);
      return {
        ok: false,
        code: "request_failed",
        message: `Nugen responded ${res.status}${detail ? `: ${detail}` : ""}`,
        model,
        latencyMs,
      };
    }

    const isSse =
      (res.headers.get("content-type") ?? "").includes("event-stream") ||
      body.trimStart().startsWith("data:");
    const parsed = isSse ? parseSse(body) : parseJson(body);

    if (!parsed || !parsed.text.trim()) {
      return {
        ok: false,
        code: "request_failed",
        message: "Nugen returned no text",
        model,
        latencyMs,
      };
    }

    return {
      ok: true,
      text: parsed.text,
      model: parsed.model ?? model,
      confidence: parsed.confidence,
      finishReason: parsed.finishReason,
      latencyMs,
    };
  } catch (error) {
    return {
      ok: false,
      code: "request_failed",
      message: describeError(error, cfg.timeoutMs),
      model,
      latencyMs: Date.now() - started,
    };
  }
}

const FALLBACK_LABEL: Record<FallbackCode, string> = {
  no_key: "No Nugen key configured",
  no_model: "No Nugen aligned model configured",
  request_failed: "Nugen unavailable",
  fact_lock_rejected: "Nugen draft rejected by the fact-lock",
};

/**
 * Ask Nugen to phrase something, then hold its text to the plan.
 *
 * The template text is always computed first and is always a valid answer.
 * The model's text replaces it only if every number in it is a plan number
 * (and, for briefings, every work window and the water volume are present).
 */
export async function phraseWithFactLock(args: {
  messages: ChatMessage[];
  facts: BriefingFacts;
  lang: Language;
  template: string;
  lock: FactLockOptions;
  maxTokens?: number;
}): Promise<PhrasingResult> {
  const { facts, lang, template } = args;
  const templateCheck = () => ({
    ...factLock(template, facts, { ...args.lock, lang }),
    subject: "template" as const,
  });

  try {
    const reply = await nugenChat(args.messages, { maxTokens: args.maxTokens });

    if (!reply.ok) {
      if (reply.code !== "no_key") {
        console.warn(`[nugen] falling back to template: ${reply.message}`);
      }
      return {
        text: template,
        lang,
        source: "template",
        model: reply.model,
        factLock: templateCheck(),
        latencyMs: reply.latencyMs,
        fallback: {
          code: reply.code,
          message: reply.code === "no_key" ? FALLBACK_LABEL.no_key : `${FALLBACK_LABEL[reply.code]} — ${reply.message}`,
        },
      };
    }

    const text = cleanModelText(reply.text);
    const verdict = factLock(text, facts, { ...args.lock, lang });
    if (reply.finishReason === "length") {
      verdict.passed = false;
      verdict.rejected = [...(verdict.rejected ?? []), "the model ran out of tokens mid-text"];
    }
    if (!text) {
      verdict.passed = false;
      verdict.rejected = [...(verdict.rejected ?? []), "the model returned no usable text"];
    }

    const meta = {
      model: reply.model,
      latencyMs: reply.latencyMs,
      ...(reply.confidence !== null ? { confidence: Math.round(reply.confidence * 10) / 10 } : {}),
    };

    if (verdict.passed) {
      return {
        text,
        lang,
        source: "nugen",
        ...meta,
        factLock: { ...verdict, subject: "nugen" },
      };
    }

    console.warn(`[nugen] fact-lock rejected draft: ${(verdict.rejected ?? []).join("; ")}`);
    return {
      text: template,
      lang,
      source: "template",
      ...meta,
      factLock: { ...verdict, subject: "nugen" },
      fallback: {
        code: "fact_lock_rejected",
        message: `${FALLBACK_LABEL.fact_lock_rejected} — ${(verdict.rejected ?? [])[0] ?? "unmatched value"}`,
      },
    };
  } catch (error) {
    // Belt and braces: nothing above should throw, but the template must win
    // if anything does.
    return {
      text: template,
      lang,
      source: "template",
      factLock: templateCheck(),
      fallback: {
        code: "request_failed",
        message: `${FALLBACK_LABEL.request_failed} — ${describeError(error, DEFAULT_TIMEOUT_MS)}`,
      },
    };
  }
}
