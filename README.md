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

No API key needed — the demo runs fully deterministic. To enable real LLM inference for the TriageAgent:

```bash
cp .env.example .env   # add OPENAI_API_KEY=sk-...
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
