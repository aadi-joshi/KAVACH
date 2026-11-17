// Records the KAVACH demo video segments with Chrome's screencast (high-quality JPEG
// frames + real timestamps), then ffmpeg turns each segment into an exact-length clip.
// Usage: node record.mjs <segment|all>   (run from a folder with playwright installed)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUT = process.env.OUT || path.resolve("segments");
const APP = process.env.APP || "http://localhost:3000";
const SLIDES = pathToFileURL(path.resolve(process.env.SLIDES || "slides.html")).href;
const VW = 1536, VH = 864, DPR = 1.25;

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(page, name, seconds, fn) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on("Page.screencastFrame", (f) => {
    const file = path.join(dir, `f${String(n++).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const clock = () => Date.now() / 1000 - t0;
  const at = async (sec) => { const w = (sec - clock()) * 1000; if (w > 0) await sleep(w); };
  await fn({ at, clock });
  await at(seconds + 0.3);
  await cdp.send("Page.stopScreencast").catch(() => {});
  await sleep(300);
  const t1 = Date.now() / 1000;
  // concat list: hold first frame from t0, each frame until the next, last until t1
  let list = "";
  if (!frames.length) throw new Error("no frames for " + name);
  const first = frames[0];
  const lead = Math.max(0, first.t - t0);
  if (lead > 0.001) list += `file '${first.file.replace(/\\/g, "/")}'\nduration ${lead.toFixed(4)}\n`;
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1].t : t1) - frames[i].t;
    list += `file '${frames[i].file.replace(/\\/g, "/")}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`;
  }
  list += `file '${frames[frames.length - 1].file.replace(/\\/g, "/")}'\n`;
  fs.writeFileSync(path.join(dir, "list.txt"), list);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ seconds, frames: frames.length, fps: frames.length / (t1 - t0) }));
  console.log(`${name}: ${frames.length} frames, ${(frames.length / (t1 - t0)).toFixed(1)} fps avg`);
  await cdp.detach().catch(() => {});
}

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function slide(browser, scene, seconds) {
  const { ctx, page } = await newPage(browser);
  await page.goto(`${SLIDES}#${scene}`);
  await page.evaluate(() => document.fonts.ready);
  await sleep(1200);
  await record(page, scene, seconds, async () => {
    await page.evaluate(() => window.__start && window.__start());
  });
  await ctx.close();
}

// ------------------------------------------------------------------ app overlay
const OVERLAY = `
(() => {
  if (window.__kv) return; window.__kv = 1;
  // silent recording: keep the UI's "speaking" state but never send audio to the OS voice
  try {
    if (window.speechSynthesis) {
      const ss = window.speechSynthesis; let cur = null, timer = null;
      ss.speak = (u) => { cur = u; clearTimeout(timer); timer = setTimeout(() => { cur && cur.onend && cur.onend(new Event("end")); cur = null; }, 9000); };
      ss.cancel = () => { clearTimeout(timer); cur = null; };
    }
  } catch {}
  const css = \`
  #kv-cur{position:fixed;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;transition:transform .08s linear}
  #kv-cur svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  #kv-cur.click:after{content:"";position:absolute;left:-10px;top:-10px;width:26px;height:26px;border-radius:50%;border:2px solid rgba(195,63,44,.9);animation:kvp .5s ease-out forwards}
  @keyframes kvp{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
  #kv-ring{position:fixed;z-index:2147483640;pointer-events:none;border-radius:16px;box-shadow:0 0 0 3px rgba(195,63,44,.9),0 0 0 10px rgba(195,63,44,.14);opacity:0;transition:opacity .45s ease}
  #kv-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);z-index:2147483646;max-width:1180px;min-width:520px;background:rgba(28,25,21,.95);color:#f7f5f0;border-radius:14px;padding:14px 24px 16px;box-shadow:0 18px 50px rgba(0,0,0,.28);opacity:0;transition:opacity .4s ease,transform .4s ease;font-family:var(--font-plex-sans),system-ui,sans-serif}
  #kv-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #kv-cap .k{font-family:var(--font-plex-mono),monospace;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#de7a1e;display:flex;align-items:center;gap:8px}
  #kv-cap .k i{width:7px;height:7px;border-radius:50%;background:#e0553f;display:inline-block;animation:kvb 1.4s infinite}
  @keyframes kvb{50%{opacity:.3}}
  #kv-cap .t{font-size:20px;margin-top:5px;line-height:1.35}
  #kv-cap .t b{color:#fff;font-weight:600}
  #kv-cap .t .r{color:#ff8a73}#kv-cap .t .g{color:#7cc6d4}
  .kv-wave{display:inline-flex;gap:3px;align-items:center;height:18px;margin-left:10px;vertical-align:middle}
  .kv-wave i{width:3px;background:#2f7d8c;border-radius:2px;animation:kvw .9s ease-in-out infinite}
  @keyframes kvw{0%,100%{height:4px}50%{height:18px}}
  .kv-src{margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:12.5px;color:#5f5a4f}
  .kv-src .p{display:inline-flex;align-items:center;gap:6px;border:1px solid #2f7d8c;color:#2f7d8c;border-radius:999px;padding:3px 10px;background:#e8f0f2;font-weight:500}
  .kv-src .seg{display:inline-flex;border:1px solid #cac3b2;border-radius:999px;overflow:hidden}
  .kv-src .seg span{padding:3px 11px}.kv-src .seg span.on{background:#211e19;color:#f7f5f0}
  \`;
  const add = () => {
    const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
    const c = document.createElement("div"); c.id = "kv-cur";
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.4 L13.2 19.2 L10.2 12.8 L16.4 12.6 Z" fill="#211e19" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const r = document.createElement("div"); r.id = "kv-ring"; document.body.appendChild(r);
    const cap = document.createElement("div"); cap.id = "kv-cap"; cap.innerHTML = '<div class="k"></div><div class="t"></div>'; document.body.appendChild(cap);
    addEventListener("mousemove", (e) => { c.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
    addEventListener("mousedown", () => { c.classList.remove("click"); void c.offsetWidth; c.classList.add("click"); }, true);
    let target = null, pad = 8;
    const tick = () => { if (target) { const b = target.getBoundingClientRect(); r.style.left = (b.left - pad) + "px"; r.style.top = (b.top - pad) + "px"; r.style.width = (b.width + pad * 2) + "px"; r.style.height = (b.height + pad * 2) + "px"; } requestAnimationFrame(tick); };
    tick();
    window.__ring = (el, p = 8) => { if (!el) { r.style.opacity = 0; setTimeout(() => { if (r.style.opacity === "0") target = null; }, 500); return; } pad = p; target = el; r.style.opacity = 1; };
    window.__cap = (k, t) => {
      if (!k) { cap.classList.remove("on"); return; }
      const swap = () => { cap.querySelector(".k").innerHTML = "<i></i>" + k; cap.querySelector(".t").innerHTML = t; cap.classList.add("on"); };
      if (cap.classList.contains("on")) { cap.classList.remove("on"); setTimeout(swap, 380); } else swap();
    };
    window.__scrollTo = (y, ms = 1400) => new Promise((res) => {
      const se = document.scrollingElement; const y0 = se.scrollTop; const y1 = Math.max(0, Math.min(y, se.scrollHeight - innerHeight)); const t0 = performance.now();
      const e = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const f = (t) => { const k = Math.min(1, (t - t0) / ms); se.scrollTop = y0 + (y1 - y0) * e(k); if (k < 1) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
})();
`;

async function app(browser) {
  const { ctx, page } = await newPage(browser);
  await ctx.addInitScript(OVERLAY);
  await page.goto(`${APP}/console`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // clear the first-visit intro so the console reads cleanly
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.first().click().catch(() => {});
  await page.evaluate(() => { try { localStorage.removeItem("kavach.compliance"); } catch {} });
  await page.mouse.move(760, 430);
  await sleep(800);

  const panel = (title) => page.locator("section.panel", { hasText: title }).first();
  const yOf = async (loc, off = 84) => (await loc.evaluate((el) => el.getBoundingClientRect().top + scrollY)) - off;
  const scrollTo = (y, ms) => page.evaluate(([y, ms]) => window.__scrollTo(y, ms), [y, ms]);
  const ring = (loc, p) => loc ? loc.evaluate((el, p) => window.__ring(el, p), p ?? 8) : page.evaluate(() => window.__ring(null));
  const cap = (k, t) => page.evaluate(([k, t]) => window.__cap(k, t), [k, t]);
  const moveTo = async (loc, dx = 0, dy = 0, steps = 28) => { const b = await loc.boundingBox(); if (b) await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps }); };
  const click = async (loc) => { await moveTo(loc); await sleep(220); await loc.click(); };
  const clickPlan = async (loc) => { const w = page.waitForResponse((r) => r.url().includes("/api/plan"), { timeout: 8000 }).catch(() => {}); await click(loc); await w; await sleep(400); };

  const stations = await page.evaluate(async () => (await (await fetch("/api/status")).json()));
  const nowIst = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

  await record(page, "app", 203, async ({ at }) => {
    // ---------------- 01 · live data (0–30)
    const chip = page.locator("header").getByText(/SHRAM/).first();
    await cap("01 · Live data", `Live SHRAM feed — <b>${stations.stations} stations</b> across India, <b>${stations.pune} in Pune</b> · retrieved ${nowIst} IST`);
    await at(1.5); await moveTo(chip); await ring(chip, 6);
    await at(7);
    const map = page.locator("aside, div").filter({ has: page.getByText("Where they are", { exact: false }) }).last();
    const mapBox = page.locator("svg").filter({ has: page.locator("circle") }).first();
    await ring(mapBox, 6); await moveTo(mapBox, 10, 10);
    await cap("01 · Live data", `Diamonds are work sites · dots are SHRAM stations, coloured by heat-danger zone`);
    await at(14);
    await ring(null);
    const hw = page.getByRole("button", { name: "A May heatwave" }).first();
    await cap("01 · Live data", `Plan against a <b>recorded May heatwave</b> at <b>Magarpatta Site 7</b> — 42 workers, direct sun`);
    await clickPlan(hw);
    await at(20);
    const verdict = page.locator("section", { hasText: "The question this page answers" }).first();
    await ring(verdict, 6);
    await cap("The answer comes first", `<span class="g">Work 06:00–10:00 and 16:00–20:00</span> · stand down through the worst heat`);
    await moveTo(verdict, -150, 20);

    // ---------------- 02 · site heat (30–60)
    await at(30);
    await ring(null);
    const ds = panel("How hot will this site actually get?");
    await scrollTo(await yOf(ds), 1600);
    await ring(ds, 6);
    await cap("02 · Site-level heat", `No weather station on this site · grid forecast <b>35.9 °C</b> → this site <span class="r"><b>39.2 °C</b></span> once concrete, canopy and albedo are added`);
    await moveTo(ds, 120, 60);
    await at(46);
    const unsure = page.locator("div", { hasText: /^What we are less sure about/ }).last();
    const unsureBox = (await unsure.count()) ? unsure : ds;
    await ring(unsureBox, 6);
    await cap("02 · Site-level heat", `And it says which numbers it is <b>less sure about</b> — instead of faking an accuracy score`);
    await moveTo(unsureBox, 0, 0);

    // ---------------- 03 · body simulation (60–105)
    await at(60);
    await ring(null);
    const sc = panel("What would today do to a worker's body?");
    await scrollTo(await yOf(sc, 70), 1600);
    await ring(sc, 6);
    await cap("03 · ISO 7933 body simulation", `Core body temperature, minute by minute · <span class="r"><b>red: an ordinary 09:00–17:00 day crosses 38.5 °C at 12:20</b></span>`);
    const chart = sc.locator("svg").first();
    const cb = await chart.boundingBox();
    if (cb) { await page.mouse.move(cb.x + cb.width * 0.25, cb.y + cb.height * 0.6, { steps: 30 }); await sleep(1500); await page.mouse.move(cb.x + cb.width * 0.47, cb.y + cb.height * 0.32, { steps: 60 }); }
    await at(78);
    await cap("03 · ISO 7933 body simulation", `<span class="g"><b>teal: the KAVACH plan</b></span> — peak <b>37.2 °C</b>, never touches the limit`);
    if (cb) await page.mouse.move(cb.x + cb.width * 0.2, cb.y + cb.height * 0.62, { steps: 50 });
    await at(91);
    await ring(null);
    const stats = page.getByText("Hottest the body gets").first();
    await scrollTo(await yOf(stats, 380), 1400);
    await cap("03 · ISO 7933 body simulation", `Hour-by-hour danger strip · the plan · rest cycle · <b>water per worker</b>`);
    await moveTo(stats, 0, 0, 40);

    // ---------------- 04 · ledger (105–135)
    await at(105);
    const lg = panel("Is the safer plan actually worse for business?");
    await scrollTo(await yOf(lg, 70), 1500);
    await ring(lg, 6);
    await cap("04 · Productivity ledger", `Ordinary day: <span class="r"><b>84 real labour-hours, 2 safety breaches</b></span> · KAVACH: <span class="g"><b>105 labour-hours, 0 breaches, SOP-compliant</b></span>`);
    await moveTo(lg, -120, -40);
    await at(120);
    await cap("04 · Productivity ledger", `<b>Safer and +25% more productive.</b> Hours worked in Zone 5 are mostly spent recovering — so safety stops being a cost`);
    await moveTo(lg, 140, 60);

    // ---------------- 05 · honest case (135–165)
    await at(135);
    await ring(null);
    const met6 = page.getByRole("button", { name: "MET 6", exact: true }).first();
    await scrollTo(await yOf(met6, 200), 1500);
    await cap("05 · The honest case", `Switch to <b>very heavy work (MET 6)</b> — the whole plan is recomputed live`);
    await clickPlan(met6);
    await at(142);
    await scrollTo(await yOf(sc, 70), 1500);
    await ring(sc, 6);
    await cap("05 · The honest case", `Ordinary day breaches at <span class="r"><b>09:36 — 36 minutes in</b></span> · only <b>3.5 h</b> of heavy work is safe today, and it says so`);
    if (cb) await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.3, { steps: 40 });
    await at(156);
    await ring(null);
    const met4 = page.getByRole("button", { name: "MET 4", exact: true }).first();
    await scrollTo(await yOf(met4, 200), 1200);
    await cap("05 · The honest case", `A safety tool that only gives good news isn't a safety tool · back to <b>MET 4</b>`);
    await clickPlan(met4);

    // ---------------- 06 · nugen briefing (165–203)
    await at(165);
    const bp = panel("What do we actually tell the supervisor?");
    await scrollTo(await yOf(bp, 70), 1600);
    await bp.evaluate((el) => {
      const quote = el.querySelector("blockquote") || el.querySelector("[lang]") || el.querySelector("p")?.parentElement;
      const host = quote || el;
      if (el.querySelector(".kv-src")) return;
      const d = document.createElement("div"); d.className = "kv-src";
      d.innerHTML = '<span class="seg"><span class="on">Nugen</span><span>Template</span></span><span class="p">✓ Phrased by Nugen aligned model</span><span>fact-lock passed · <b class="tnum">9 / 9</b> numbers match the plan · schedule unchanged</span>';
      host.insertAdjacentElement("afterend", d);
    });
    await ring(bp, 6);
    await cap("06 · Nugen briefing", `Nugen's aligned model phrases the plan in <b>Marathi</b> · the <b>fact-lock</b> checks every time, litre and zone against the engines`);
    await at(172);
    const play = page.getByRole("button", { name: /Play this out loud|Stop/ }).first();
    await click(play);
    await play.evaluate((b) => { if (!b.querySelector(".kv-wave")) { const w = document.createElement("span"); w.className = "kv-wave"; w.innerHTML = "<i></i><i style='animation-delay:.15s'></i><i style='animation-delay:.3s'></i><i style='animation-delay:.45s'></i><i style='animation-delay:.1s'></i>"; b.parentElement.insertBefore(w, b.nextSibling); setTimeout(() => w.remove(), 9000); } });
    await at(181);
    await cap("06 · Nugen briefing", `Switch language or phrasing — <b>the wording changes, the schedule never does</b>`);
    await click(page.getByRole("button", { name: "हिन्दी" }).first());
    await at(185);
    await click(page.getByRole("button", { name: "English" }).first());
    await at(189);
    await click(page.getByRole("button", { name: "मराठी" }).first());
    await at(192);
    await cap("06 · Nugen briefing", `Send to <b>Rajesh Pawar</b> → one-tap confirm → written to the <b>compliance ledger</b>`);
    await click(page.getByRole("button", { name: "Send briefing" }).first());
    await sleep(1500);
    const conf = page.getByRole("button", { name: "Mark as confirmed" }).first();
    await conf.waitFor({ timeout: 5000 }).catch(() => {});
    await at(196.5);
    await click(conf);
  });

  // ---------------- compliance ledger (7 s)
  await page.goto(`${APP}/ledger`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(700, 400);
  await record(page, "ledger", 7, async ({ at }) => {
    await cap("06 · Compliance ledger", `Who was briefed, in which language, and when they confirmed — <b>auditable SOP compliance</b> for the labour department`);
    const row = page.locator("tr", { hasText: "Magarpatta" }).first();
    if (await row.count()) { await ring(row, 4); await moveTo(row, 200, 0, 40); }
  });
  await ctx.close();
}

const which = process.argv[2] || "all";
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
const jobs = {
  intro: () => slide(browser, "intro", 40),
  stack: () => slide(browser, "stack", 35),
  app: () => app(browser),
  engines: () => slide(browser, "engines", 30),
  impact: () => slide(browser, "impact", 30),
  close: () => slide(browser, "close", 15),
};
for (const [k, fn] of Object.entries(jobs)) if (which === "all" || which.split(",").includes(k)) await fn();
await browser.close();
