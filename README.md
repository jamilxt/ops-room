# OpsRoom

Concurrent AI agents that fight a production incident together — built for the [JigJoy × daily.dev × Hyperskill hackathon](https://build.jigjoy.ai/) (Sep 5–6, 2026) on the [Mozaik](https://github.com/jigjoy-ai/mozaik) agentic environment.

**[Architecture diagram →](docs/architecture.html)** — six participants around one shared message bus; open in any browser.

**[Animated walkthrough →](docs/walkthrough.html)** — replay of a real run as a movie: six swimlanes, live message chips, the HOLD moment, comms' status update, with plain-English captions per phase.

**[Demo video script →](docs/demo-video-script.md)** — shot-by-shot 2-minute recording plan.

## What it is

A live incident ops room where multiple agents run **truly concurrently** — no pipeline, no orchestrator:

- **IncidentFeed** — replays a scripted production incident onto the shared `AgenticEnvironment`, exactly like real telemetry would. Scenario is written for a **Java / Spring Boot shop**: a canary rollout of a Boot fat jar, an Actuator p95 alert on `POST /api/checkout`, Hikari pool saturation (`hikaricp.connections.pending=312`), JPA `PessimisticLockException` on cart rows
- **TriageAgent** — reacts to alerts/metrics, forms hypotheses; **consumes the sleuth's evidence** before re-inferring; obeys commander HOLDs with a `REVISED PROPOSAL`
- **LogSleuth** — works *in parallel* on raw log lines, extracts error signatures; never waits for triage. The only agent that **uses a real Mozaik tool**: its `search_logs` function tool greps actual fixture logs (`CheckoutRepository.java`, `CheckoutService.java` stack frames) via the framework's function-calling loop, so every signature it publishes is earned from files, not guessed
- **RiskCommander** — intercepts mitigation proposals mid-room and challenges them with an evidence-citing HOLD, unprompted — emergent coordination, not a pipeline step
- **CommsAgent** — silently watches the whole room, then at incident end drafts the customer-facing status update (LLM mode: real synthesis from the full transcript)
- **IncidentScribe** — pure observer; writes a live `incident-timeline.md` of everything that crossed the environment

## Inter-agent protocol

Natural language is unreliable for safety interception — LLMs paraphrase the same
mitigation a dozen ways ("restart all pods" / "restarting affected pods" / "rolling
restart"). So mitigations travel as contract tokens:

```
[triage]    PROPOSAL: restart ALL orders-api pods immediately...
[commander] HOLD — weigh it against the room's evidence ([sleuth] ... CHECKOUT_LOCK_ERROR ...)
[triage]    REVISED PROPOSAL: roll back the 3 canary instances only...
```

- `PROPOSAL:` → intercepted deterministically (a prose heuristic stays as a safety net)
- `REVISED PROPOSAL:` → resolves the negotiation, no ping-pong loops
- HOLD messages cite actual shared evidence from the room

## Run it

```bash
npm install
npm start
```

### Web console (recommended for the demo)

```bash
npm run web
# → http://localhost:8787  (custom port: OPSROOM_PORT=9000 npm run web)
```

Slack-style `#incident-war-room` rendering the live run in your browser: agent roster with live activity, every bus row as a chat bubble, HOLD/ESCALATION rows annotated with a "why this matters" line, and the escalation surfaces as a **⏸ Human decision required** card with **Approve / Reject** buttons wired to the real pause. `▶ Run again` restarts a fresh incident without leaving the page.

CLI stays fully functional (same engine, same behavior):

No API key needed — the demo runs fully deterministic. For real LLM inference, **any OpenAI-compatible endpoint works** (the `deepseek-v4-flash` registry entry routes through the generic `/v1/chat/completions` adapter): OpenAI, DeepSeek, OpenRouter, **Ollama, LM Studio, llama.cpp server** — local or remote.

### Option A — local LLM (no cloud key, free)

```bash
# 1. Start any OpenAI-compatible local server on your Mac.
#    Ollama:
ollama serve & ollama pull qwen2.5:7b
#    LM Studio: start the server (Developer tab → Start Server), load a model
#    llama.cpp: llama-server -m model.gguf --port 1234

# 2. Run the one-command demo (checks the server, wires env, runs scenario):
npm run demo:local
#    For LM Studio / llama.cpp on a custom port:
LLM_BASE_URL=http://127.0.0.1:1234/v1 npm run demo:local
```

> The model name sent to the server is `deepseek-v4-flash` (one of Mozaik's 12 registry names). Most local servers ignore unknown model names and serve their loaded model; if yours is strict (LM Studio with a specific model loaded), alias the name in the server, or set `LLM_MODEL` to a registry name and map it server-side. For LM Studio, simplest: load `qwen2.5-coder-7b-instruct` and it will serve it for any requested model.

### Option B — cloud provider

```bash
export OPENAI_API_KEY=sk-...            # real OpenAI
# or DeepSeek:
export OPENAI_API_KEY=sk-...            # your DeepSeek key
export OPENAI_BASE_URL=https://api.deepseek.com/v1
npm start
```

## Requirements

- Node.js ≥ 20
- TypeScript 5.x (installed with devDependencies; `npm start` runs via tsx, no build step)

## Repo layout

```
src/
  index.ts            # CLI entrypoint (console mode)
  web.ts              # web entrypoint: zero-dep SSE server + war-room UI
  scenario.ts         # shared engine: timeline + who joins the environment
  incident-feed.ts    # deterministic telemetry participant
  triage-agent.ts     # alert/metric specialist (PROPOSAL/REVISED PROPOSAL)
  log-sleuth.ts       # log analyst — the tool user (search_logs via Mozaik function-calling)
  risk-commander.ts   # evidence-citing interception agent (HOLD → ESCALATION)
  comms-agent.ts      # status-update synthesizer (end of incident)
  oncall-engineer.ts  # HUMAN participant: approves/rejects escalations
  incident-scribe.ts  # observer → live timeline artifact
fixtures/
  orders-api.log      # what search_logs actually greps (Spring/Hikari stack frames)
  checkout.log
scripts/
  test-oncall.ts      # escalation smoke test (both decision branches)
  test-commander-gate.ts  # regression: gate loopholes, two-strike, exemptions (8 checks)
```

## Design notes

- **Streaming is off by default.** Not an omission: Mozaik 3.14's SSE delivery drops semantic events end-to-end (reproduced and documented). OpsRoom uses single-shot inference; nothing in the demo needs token streaming.
- **Interception is a contract, not vibes.** Agents speak `PROPOSAL:` / `REVISED PROPOSAL:` tokens so the commander's grounding gate fires deterministically even when the LLM paraphrases. Tokens must open their own statement; revisions are gated like fresh proposals; two consecutive ungrounded rows escalate to the human instead of looping.
- **A human has the last word.** When a revised proposal still cites no evidence, the commander ESCALATES and the on-call engineer decides — at the keyboard (`OPSROOM_ONCALL=interactive npm start`) or with buttons in the web console.
- **One engine, two frontends.** `scenario.ts` drives both the CLI and the web console — same bus, same participants, same evidence gates; only the output sink differs. The scenario speaks Java/Spring (Hikari, Actuator, JPA locks) while keeping machine tags and error codes stable, so the negotiating agents don't care and Java-fluent humans do.
