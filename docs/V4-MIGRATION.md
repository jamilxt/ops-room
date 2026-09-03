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

## Known gaps

- `onParticipantError` / `deliverError` have no v4 equivalent; the
  kill-the-sleuth resilience demo announces the loss on the bus instead of
  routing a real `AgenticError` through the framework.
- v4's cloud client is constructed per agent loop, so a single run prints
  several cloud session URLs (one per agent turn) instead of one.
- v4 requires the structured-output gate above; passing a schema to a
  DeepSeek-registry model crashes the loop at request validation.
