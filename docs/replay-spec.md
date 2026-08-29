# OpsRoom Replay Feature Spec

Record a real run's event stream, then replay it slowly with playback controls, so the
incident story can be shown step by step without re-running agents live. This is the
demo-safety net AND a presentation tool: live run once, replay everywhere after.

Design rule: **replay is a projection of recorded bus output, not a second runtime.**
No Mozaik involvement at replay time — no LLM, no flakiness, identical pixels every time.

---

## 1. Recording (write side)

Record the exact SSE payloads `web.ts` already broadcasts — no new event semantics.

- In `broadcast()` (web.ts, one-line addition): append
  `{ t: Date.now() - runStart, ...payload }` to an in-memory array.
- On `{type:"summary"}` (run end): write `runs/<ISO timestamp>-<mode>.json`:

```json
{
  "meta": {
    "recordedAt": "2026-09-05T14:02:11Z",
    "mode": "llm | deterministic",
    "model": "deepseek-v4-flash | null",
    "durationMs": 28400,
    "opsoomVersion": "git describe --dirty"
  },
  "events": [
    { "t": 0,     "type": "state", "value": "live" },
    { "t": 5,     "type": "reset" },
    { "t": 3010,  "type": "row", "line": "[feed] timeline exhausted — incident is yours, team" },
    { "t": 3050,  "type": "escalation", "text": "..." },
    { "t": 28400, "type": "summary", "sleuthSignatures": 2, "triageFindings": 3 }
  ]
}
```

- Failures also record: on catch, write what exists with `"status": "error"` plus the
  error line as the last row. Partial replays of failures are useful for the post-mortem
  story.
- Keep the last 20 recordings, prune oldest (recordings are small: a full run is
  a few hundred rows, < 200 KB).
- gitignore `runs/` — recorded runs are data, not source.

## 2. Playback (read side)

Two transports, same player:

- **File playback:** `GET /replay/<file>` serves the recording; `/replay/<file>?speed=0.25`.
- **Re-list:** `GET /replays` returns a JSON list (name, mode, duration, findings) for a
  small "past incidents" picker in the UI sidebar.

### Player mechanics

- On playback start: emit `reset`, `state:"live"`, then schedule each event with
  `t * speedFactor`. `speed` values: `1`, `0.5`, `0.25`, `step`.
- Client does NOT know it is a replay (same handler path as live). One UI surface,
  no forked rendering code — everything (cards, HOLD panel, counters from the
  animation spec) works unchanged and identically.
- Banner: the only replay tell is a persistent chip: `REPLAY · 0.5× · recorded Sep 5 14:02`.

### Playback controls (new endpoints, all trivial on top of the scheduler)

| Control | Endpoint | Behavior |
|---|---|---|
| speed | `POST /replay/control {speed}` | rescale remaining schedule from now |
| pause / resume | `POST /replay/control {pause}` / `{resume}` | freeze/resume the clock |
| step | `POST /replay/control {step}` | emit next event only (pause first) |
| scrub | `POST /replay/control {seekMs}` | emit `reset`, then fast-forward all events ≤ seekMs instantly (no animation), continue from there |
| abort | `POST /replay/control {abort}` | emit `state:"idle"`, stop |

The scheduler is ~40 lines: an index + timer, pause = clear timer, resume = re-arm
remaining, seek = re-emit from 0.

## 3. Human decision during replay

Recordings contain the escalation + the final decision outcome as plain rows. During
replay the decision buttons are disabled: the human already decided once; replay shows
what happened, including the receipt line ("HELD → APPROVED by human at T+41s").
The `askHuman` gate never fires at replay time because no run is executing.

## 4. Deterministic-mode synergy (why this feature is cheap here)

Deterministic mode is already a fixed script with relative timings (T+3.0s signatures
etc.). That means: record ONCE on the VPS/Mac in deterministic mode, and you have a
flawless, repeatable "live demo" for the video submission — zero LLM dependence, zero
retry risk, identical every play. Recommended workflow for the Sep 6 deadline:

1. Record a clean deterministic run (this is the submission video's source).
2. Record one LLM-mode run as a bonus artifact in the repo ("real model run").
3. Submission video = screen capture of the 0.25× replay of (1), with narration
   pointing at the HOLD sequence — the step-by-step story Jamil asked for.

## 5. Edge cases (decided, not open questions)

- Two browsers during replay: both get the same broadcast (existing `events` set) —
  replay behaves exactly like live for all connected clients. Fine.
- Starting a live run during replay: `/run` rejects while the scheduler is active
  (same `busy` flag; replay sets it).
- Clock drift: schedule from the recorded `t` deltas, never `setTimeout` chains that
  accumulate error; recompute next deadline after each emission.
- Empty/partial recording (crash before summary): replay what exists, end with
  `state:"idle"` and a `[system] recording ended early` row.

## 6. Implementation order (post-kickoff, ~half a day total)

1. Recorder in `broadcast()` + file write (30 min, server-side only).
2. Replay endpoint + scheduler + speed control (2 h).
3. REPLAY chip + past-incidents picker (1 h, client).
4. Pause/step/seek (1 h, optional polish — speed + pause carry the demo alone).

Constraints honored: server changes are additive endpoints on the existing
`createServer(handler)`; PAGE stays template-literal, no regex, no external libs;
`runs/` gitignored; no interference with the animation spec (both consume `broadcast`).
