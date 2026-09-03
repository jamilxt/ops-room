# OpsRoom demo video script

> **v4 note (spike/v4):** the demo arc grew — the video should now show the
> interception beats and the human-approval pause. Recommended order:
> reflex `restart_canary_pods` → **BLOCKED** strip → evidence lands → same call
> **ALLOWED** → goal pivot → healer/librarian join → sleuth crash →
> **human approval card** → verdict → comms status update → timeline.
> Record `npm run web:v4` (browser) rather than the CLI — the guard strips,
> audit pill, and approval card are the visuals judges remember. Both modes
> work; deterministic is the safe recording path (identical beats every take).

Target: **2:00**. One take per beat, cut together. Recorded on macOS, LLM mode (`OPENAI_API_KEY=sk-... LLM_MODEL=gpt-5.4-mini npm start`, ~1 cent per run).

## Before you hit record (checklist)

- [ ] `git pull` fresh, then run one LLM-mode run as a **warmup** (verifies the key and quota before recording)
- [ ] Terminal: font ≥ 16pt, window cropped to ~120×34 lines, dark theme matching the README/diagram aesthetic
- [ ] Screen recorder at 2560×1440 or 1920×1080, mic level tested ("testing, one two")
- [ ] Deterministic fallback ready (`env -u OPENAI_API_KEY npm start`) in case LLM mode misbehaves mid-take — run 2 of Aug 26 is the reference shape for a good take
- [ ] `incident-timeline.md` open in VS Code for the final close-up shot
- [ ] Kill stray apps, notifications off

## Shot list

| # | Time | On screen | Voiceover |
|---|------|-----------|-----------|
| 1 | 0:00–0:12 | Terminal, prompt visible | "When production breaks, three things happen at once — alerts fire, logs pile up, metrics spike. Human war rooms handle that in parallel. Most 'multi-agent' demos don't — they're pipelines wearing a costume." |
| 2 | 0:12–0:24 | Cut to `docs/architecture.html` in browser, slowly scroll over the bus | "OpsRoom runs six agents around one shared message bus. There's no orchestrator. No one waits their turn. Every reaction you'll see emerges from messages crossing this bus." |
| 3 | 0:24–0:30 | Back to terminal, type `npm start`, hit enter | "Real LLMs negotiating in real time — six agents, one shared bus, actual reasoning you can audit." |
| 4 | 0:30–0:55 | Live run: deploy → alert → sleuth signature while triage infers | "A canary deploy goes bad. Checkout latency spikes. Watch the log analyst — it extracts the TIMEOUT_ERROR signature *while* triage is still thinking. Two agents working at the same moment." |
| 5 | 0:55–1:05 | Point/highlight `evidence received` lines | "And triage isn't guessing alone — the sleuth's signatures land straight into its context. That's shared state, not shared middleware." |
| 6 | 1:05–1:30 | THE MONEY MOMENT: first ungrounded PROPOSAL → commander HOLD → REVISED PROPOSAL citing signatures. Slow down here, let lines land. Zoom if possible. | "Triage proposes scaling read replicas — reasonable, but it cites no evidence. The risk commander interrupts, uninvited: HOLD — name a confirmed signature. And triage revises — now citing TIMEOUT_ERROR directly. A safety agent negotiating with a specialist, live, in real inference." |
| 7 | 1:30–1:45 | Comms STATUS UPDATE scrolling in with numbers and owners | "Meanwhile comms has been silently listening the whole time — zero LLM calls until now. At incident end it drafts the customer update: real latencies, real error rates, owners per next step." |
| 8 | 1:45–1:55 | VS Code close-up: `incident-timeline.md`, scroll through | "The scribe wrote all of it down, live — every message, every interception. This file is our concurrency proof: timestamps interleaved, never sequential." |
| 9 | 1:55–2:00 | Outro card / terminal header | "OpsRoom. Six agents, one bus, zero orchestrators. Runs offline on a laptop." |

Total ≈ 290 narrated words — comfortable at normal pace. Rehearse beat 6 twice before recording; it's the beat judges rewind.

## Contingencies

- **Commander doesn't fire during recording** (rare after fixes): say line 6 slightly later over any revision cycle; OR switch plan B = record deterministic mode where PROPOSAL→HOLD→REVISED always fires identically, and label the clip "deterministic replay" honestly.
- **Run shape varies (LLM nondeterminism)**: keep whichever take shows grounding-gate HOLD *and* a signature-citing revision. That pair is non-negotiable; everything else is flexible.
- **Comms synthesis slow**: beat 7 tolerates up to ~60s wait — trim dead air in edit rather than restarting the take.

## Post-production notes

- Terminal clips: speed up idle stretches 4–8×, full speed on typed commands and beats 5–6.
- Lower-third captions for agent names as they first appear ([triage], [sleuth], [commander], [comms], [scribe]).
- End card mirrors diagram headline: "six participants · one shared bus · zero orchestrators".
