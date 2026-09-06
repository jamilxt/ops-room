# OpsRoom demo video script

> **v4 note (spike/v4):** the demo arc grew — the video should now show the
> interception beats and the human-approval pause. Recommended order:
> reflex `restart_canary_pods` → **BLOCKED** strip → evidence lands → same call
> **ALLOWED** → goal pivot → healer/librarian join → sleuth crash →
> **human approval card** → verdict → comms status update → timeline.
> Record `npm run web` (browser) rather than the CLI — the guard strips,
> audit pill, and approval card are the visuals judges remember. Both modes
> work; deterministic is the safe recording path (identical beats every take).

Target: **2:00**. One take per beat, cut together. Recorded on macOS, LLM mode (`OPENAI_API_KEY=sk-... LLM_MODEL=gpt-5.4-mini npm run web`, ~1 cent per run).

## Before you hit record (checklist)

- [ ] `git pull` fresh, then run one LLM-mode run as a **warmup** (verifies the key and quota before recording)
- [ ] Browser at localhost:8788, presenter focus mode ON (hides sidebar), window ~1920×1080, dark theme matching the README aesthetic
- [ ] Screen recorder at 2560×1440 or 1920×1080, mic level tested ("testing, one two")
- [ ] Deterministic fallback ready (`env -u OPENAI_API_KEY npm run web`) in case LLM mode misbehaves mid-take
- [ ] `incident-timeline-v4.md` open in VS Code for the final close-up shot
- [ ] Kill stray apps, notifications off

## Shot list

| # | Time | On screen | Voiceover |
|---|------|-----------|-----------|
| 1 | 0:00–0:12 | Browser on localhost:8788, idle room | "When production breaks, three things happen at once — alerts fire, logs pile up, metrics spike. Human war rooms handle that in parallel. Most 'multi-agent' demos don't — they're pipelines wearing a costume." |
| 2 | 0:12–0:20 | Point at the roster: 12 participants with live activity | "OpsRoom runs twelve participants around one shared message bus — eight autonomous agents, and one of them is a human. There's no orchestrator. Every reaction you'll see emerges from messages crossing this bus." |
| 3 | 0:20–0:26 | Hit ▶ Run, the bus wakes | "Real LLMs negotiating in real time — actual reasoning you can audit." |
| 4 | 0:26–0:50 | Live run: deploy → alert → **BLOCKED strip** fires on the reflex call → sleuth signature while triage infers | "A canary deploy goes bad. Triage's first instinct is restarting pods — and the interceptor blocks it: no confirmed evidence, no state change. Watch the log analyst — it extracts the lock signature *while* triage is still thinking. Two agents working at the same moment." |
| 5 | 0:50–0:58 | Highlight **ALLOWED** strip: same class of call, now grounded | "Evidence lands. The identical action now passes — with its grounding counted. Governance you can watch, not a policy nobody enforces." |
| 6 | 0:58–1:20 | THE MONEY MOMENT: ungrounded PROPOSAL → commander HOLD → REVISED PROPOSAL citing signatures. Slow down here, let lines land. | "Triage proposes a fix that cites no evidence. The risk commander interrupts, uninvited: HOLD — name a confirmed signature. And triage revises — now citing the lock error directly. A safety agent negotiating with a specialist, live, in real inference." |
| 7 | 1:20–1:35 | Goal pivot lands → healer and librarian join; then sleuth crash → **⏸ human approval card**; click Approve | "Mid-incident, the goal shifts — a Postgres specialist joins the running room, uninvited, and leaves when its lane resolves. Then a teammate goes down. The room freezes on one decision — and the human approves. The last word is a person, not a probability." |
| 8 | 1:35–1:48 | Comms STATUS UPDATE scrolling in with numbers and owners | "Meanwhile comms has been silently listening the whole time. At incident end it drafts the customer update: real latencies, real error rates, owners per next step." |
| 9 | 1:48–2:00 | VS Code close-up: `incident-timeline-v4.md`, scroll; end card | "The scribe wrote all of it down, live — timestamps interleaved, never sequential. OpsRoom: nine participants, one bus, zero orchestrators — and the enforcement layer Mozaik's own launch essay calls the missing piece." |

Total ≈ 300 narrated words — comfortable at normal pace. Rehearse beats 6–7 twice before recording; they're the beats judges rewind.

## Contingencies

- **Commander doesn't fire during recording** (rare after fixes): say line 6 slightly later over any revision cycle; OR switch plan B = record deterministic mode where PROPOSAL→HOLD→REVISED always fires identically, and label the clip "deterministic replay" honestly.
- **Run shape varies (LLM nondeterminism)**: keep whichever take shows the grounding-gate HOLD *and* a signature-citing revision. That pair is non-negotiable; everything else is flexible.
- **Approval card mistimed**: the fault fires at T+7s every run in both modes; if the click lands early, trim in edit — the SSE verdict line must stay visible for ~2s.
- **Comms synthesis slow**: beat 8 tolerates up to ~120s wait — trim dead air in edit rather than restarting the take.

## Post-production notes

- Browser clips: speed up idle stretches 4–8×, full speed on the interceptor strips and beats 6–7.
- Lower-third captions for agent names as they first appear ([triage], [sleuth], [commander], [healer], [comms], [oncall]).
- End card mirrors the README: "12 participants · one shared bus · zero orchestrators · one human with the last word".
- Closing line lands the submission thesis: we implemented the enforcement layer Mozaik's launch essays name as the open problem between capability and trust.
