# OpsRoom

Concurrent AI agents that fight a production incident together — built for the [JigJoy × daily.dev × Hyperskill hackathon](https://build.jigjoy.ai/) (Sep 5–6, 2026) on the [Mozaik](https://github.com/jigjoy-ai/mozaik) agentic environment.

## What it is

A live incident ops room where multiple agents run **truly concurrently** — no pipeline, no orchestrator:

- **IncidentFeed** — replays a scripted production incident (deploy → alerts → logs → metrics) onto the shared `AgenticEnvironment`, exactly like real telemetry would
- **TriageAgent** — reacts to alerts/metrics, forms hypotheses (LLM mode: streams real inference)
- **LogSleuth** — works *in parallel* on raw log lines, extracts error signatures; never waits for triage
- **RiskCommander** — watches specialist recommendations and challenges any with blast radius ("restart all pods" gets a HOLD), unprompted — emergent coordination, not a pipeline step
- **IncidentScribe** — pure observer; writes a live `incident-timeline.md` of everything that crossed the environment

## Run it

```bash
npm install
npm start
```

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
  index.ts            # scenario wiring: who joins the environment
  incident-feed.ts    # deterministic telemetry participant
  triage-agent.ts     # alert/metric specialist
  log-sleuth.ts       # log-line specialist (parallel)
  risk-commander.ts   # challenges risky recommendations
  incident-scribe.ts  # observer → live timeline artifact
```
