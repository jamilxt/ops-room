# OpsRoom on Mozaik v4 (spike: `spike/v4` branch)

OpsRoom was ported to **Mozaik v4** (`@mozaik-ai/core` 4.0.0, the `defineRuntime`
API). This branch runs **side by side** with the v3 submission build: same
scenario, same participants, same evidence gates — only the framework wiring
changed. Nothing in `development` was touched.

## Try it locally

```bash
git clone https://github.com/jamilxt/ops-room.git
cd ops-room
git checkout spike/v4
npm install
```

### 1. Deterministic demo (no keys, always works)

```bash
npx tsx src/index-v4.ts        # CLI, prints the war-room transcript
```

Ends with `=== done — signatures: 2, findings: 3 ===` and writes
`incident-timeline-v4.md`.

### 2. Web console (the demo UI)

```bash
npx tsx src/web-v4.ts          # port 8788 (v3's stays on 8787)
# → http://localhost:8788
```

Same war-room UI as v3: roster with live activity, chat-bubble bus rows,
HOLD/ESCALATION annotations, Approve/Reject cards, **▶ Run again** re-runs in
place (fixed: v4 throws `Runtime already initialized` on re-init; this branch
handles it).

v4-only UI features: **interceptor guard strips** (red shield = a state-changing
tool call BLOCKED for lack of evidence; amber eye = ALLOWED, grounded), a live
audit pill next to the roster, the escalation card actually wired end-to-end
(`POST /decision` resolves the pause, the room resumes with the verdict), and
**full activity logging in the browser** — every internal line (triage picks,
goal updates, comms progress) streams to the page via `line-tap-v4.ts`, so the
web log matches the server console exactly.

### 3. Real LLM (OpenAI cloud, verified)

```bash
cat > .env <<'EOF'
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-5.4-mini
EOF
npx tsx src/index-v4.ts        # or src/web-v4.ts
```

Costs about one cent per run. Structured output (the typed PROPOSAL schema)
is enforced on `gpt-*` models and auto-gated off for DeepSeek-class models
(see "v4 differences" below).

### 4. Local LLM (free, offline)

```bash
ollama serve & ollama pull qwen2.5:7b
npm run demo:local                                   # ENTRY=src/index-v4.ts for v4
ENTRY=src/index-v4.ts npm run demo:local
LLM_BASE_URL=http://127.0.0.1:1234/v1 ENTRY=src/index-v4.ts npm run demo:local
```

### 5. Optional: Mozaik Cloud live view

Sign in at https://app.jigjoy.ai, copy the `MOZAIK_API_KEY` (`pk_...`) into
`.env`. Every run then prints a `watching live` session URL showing each
agent's loop (inference/tool calls/answers) in JigJoy's cloud UI.
`MOZAIK_PROJECT_ID` is not read by the SDK — ignore it. No key = disabled
no-op, fully offline.

## What changed from v3

| v3 (`development`) | v4 (`spike/v4`) |
|---|---|
| `AgenticEnvironment` + `join(env)` | `defineRuntime<State>()` + module-scoped `join` |
| `BaseParticipant` subclass, `onMessage` overrides | `createAgent`/`createHuman` config + situation handlers |
| `runInference({...})` free function | `runLoop(agentId, message, input)` state machine |
| Manual tool loop (`onFunctionCall` bookkeeping) | loop owns tool execution (`tools` on the input) |
| `sendMessage(env, msg, caller)` | `sendMessage(msg, senderId)`; delivers to **everyone incl. the sender** — specs filter `producerId` |
| `addContextItem()` | `addContextItems()` (plural only) |
| `onParticipantError` fault pipeline | **no equivalent** — fault injection is simulated at scenario level |
| structured output accepted everywhere | validated against model spec first; `deepseek-*` fails pre-flight (`supportsStructuredOutput: false`) |

File map (`*-v4.ts` mirrors each v3 file; `runtime-v4.ts` holds the shared
runtime + spec/processor factories). The v3 files are untouched for reference.
v4 adds three files with no v3 counterpart:

- `incident-interceptor-v4.ts` — the evidence gate for state-changing tool
  calls (unsafe verbs: restart, rollback, migrate, delete, scale, kill…).
  Blocked calls are rewritten to readonly evidence capture; grounded calls
  pass with the grounding count. Exposes `stats` for the UI audit pill.
- `line-tap-v4.ts` — central log tap; every internal line prints to the
  server console AND streams to the browser (web registers a sink).
- `docs-librarian-v4.ts` — the MCP showcase (v3 had no librarian):
  tool discovery from remote MCP servers via `McpToolRegistry`.

## The v4 room at a glance

9 participants: Triage, LogSleuth, RiskCommander, Comms, Scribe,
OnCallEngineer (human), DatabaseHealer and DocsLibrarian (both join
mid-incident), plus the IncidentFeed. Two safety layers: the commander's
proposal gate (PROPOSAL/HOLD/REVISED protocol) AND tool-call interception
(`InterceptionHandler` as the 4th argument of `runLoop` — wired via
`runLoopGated` in `runtime-v4.ts`; the deterministic demo beats go through
the same handler, so demo path and LLM path share one audit trail).
A mid-run goal pivot flips the room to preserve-evidence via a typed
`goal-update` SemanticEvent, and the fault injection (sleuth crash) ends in
a real human-approval pause resolved over `POST /decision`.

Both modes verified end-to-end: deterministic (identical beats every run)
and real LLM (`gpt-5.4-mini` — blocked beat, allowed beat, structured
proposals, escalation, and on-call verdict all confirmed in captured runs).

## Known gaps

- `onParticipantError` / `deliverError` have no v4 equivalent; the
  kill-the-sleuth resilience demo announces the loss on the bus instead of
  routing a real `AgenticError` through the framework.
- v4's cloud client is constructed per agent loop, so a single run prints
  several cloud session URLs (one per agent turn) instead of one.
- v4 requires the structured-output gate above; passing a schema to a
  DeepSeek-registry model crashes the loop at request validation.

## Conscious trade-offs (documented decisions, not gaps)

- **`ModelContextRepository` not used** — the shared bus plus the
  `confirmedSignatures` array already provide room-wide common knowledge;
  agents read evidence from the transcript, not a private memory store.
- **Token streaming not used** — single-shot inference keeps run timing
  deterministic (the demo beats land on schedule in both modes).
- **Cloud observability is per-loop-session in v4** (one session URL per
  agent turn). Rather than monkey-patching the framework, the :8788
  console surfaces the equivalent live view locally.
