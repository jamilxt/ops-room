# OpsRoom Demo Animation Spec

Presentation layer for `src/web.ts` (PAGE template + SSE `broadcast`). No changes to the
agent code, the referee, or the bus. Everything animates from events that already exist.

Principles:

- Animate only real bus activity. Every pulse, line, and flash maps to an actual event.
- No Mozaik site assets, colors copied blind, or markup. Same genre, our own code.
- The HOLD sequence is the signature moment. It gets the only long animation in the room.
- Deterministic mode and LLM mode produce identical animations (both go through onLine).

---

## 1. Event-to-animation mapping (what the SSE already sends)

Existing payloads from `web.ts`:

| SSE payload | Current UI | Animation addition |
|---|---|---|
| `{type:"hello"}` | greeting row | none |
| `{type:"reset"}` | clears feed | clear card states to `idle` |
| `{type:"state",value}` | status chip | idle = grey room, live = subtle room-wide glow |
| `{type:"row",line}` | feed line, e.g. `[sleuth] error signature: ...` | **the core driver** — parse tag, pulse that card, increment counter (see 2) |
| `{type:"escalation",text}` | escalation banner | **HOLD sequence trigger** (see 3) |
| `{type:"summary",...}` | summary row | end-of-run flourish (see 5) |

One new payload is needed for routing animation (optional, see 4): emit the parsed
`from` tag and event kind from the child process line instead of only the raw string,
or parse `[tag]` client-side (recommended: client-side, zero server change).

---

## 2. Agent cards: three states + pulse

Cards (already in the sidebar): deploy/feed, triage, sleuth, commander, comms, scribe,
oncall. Each gets `data-agent="<id>"`.

States (CSS classes):

- `idle` — dimmed 40% opacity, grey left border.
- `active` — full opacity, accent left border. Auto-expires (see pulse).
- `gate` — commander only during a HOLD: red border, slow pulse, locks out `active`.

Pulse rule on `row` events:

```
tag = line.match(/^\[(\w+)\]/)?.[1]
if (tag in cards) {
  cards[tag].classList.add("active")
  counters[tag].textContent = ++counts[tag]
  clearTimeout(timer[tag])
  timer[tag] = setTimeout(() => cards[tag].classList.remove("active"), 1200)
}
```

Effect at demo distance: during T+3.0s you see feed, triage, and sleuth cards lighting
up in quick irregular succession — visibly concurrent, not turn-based. That visual is
the "not a pipeline in disguise" answer before you say a word.

Sort detail: order cards by last-activity (translateY re-order with CSS transition)
so the race is legible. Cap transitions at 300ms so it never gets circus-y.

---

## 3. HOLD sequence (signature moment)

Trigger: `{type:"escalation"}` (commander issued a HOLD).

Timeline (total ~2.5s, only long animation in the demo):

1. t=0    proposing agent's card freezes: class `held` (desaturate + slight shake).
2. t=200ms commander card flips to `gate` state; a red rail animates from commander
   card across the feed toward the held card (single 300ms sweep, one element).
3. t=600ms HOLD panel expands between feed and sidebar: the escalation text plus the
   commander's evidence lines (already in the transcript; pin the last 2-3 `[commander]`
   rows into the panel).
4. Buttons enable only after the panel settles (they already gate the run; keep that).

On decision (`/decision` → run continues): held card un-freezes with a quick release
animation; commander returns to `idle`; panel collapses to a one-line receipt
("HELD → APPROVED by human at T+41s") that stays in the feed. The receipt line is the
judge-takeaway: a human approval with a timestamp, written by the room itself.

---

## 4. Selective-listening routing (optional, evening 2)

On each `row` event, briefly show delivery targets: listening participants get a
2px accent dot for ~800ms; the commander's dot stays dark unless the line starts
with `[triage]` or `[sleuth]` (his actual `listens`). Implement as a static map in
the client — it mirrors the real `listens` values in `risk-commander.ts`; keep them
in sync if the participant set changes. Cheap, honest, and it makes "the referee is
not in the group chat" visible.

Skip if time is tight: cards + HOLD alone carry the demo.

---

## 5. End-of-run flourish

On `{type:"summary"}`: cards fade to `idle` in one wave (staggered 60ms), then the
summary row types out. The scribe's `incident-timeline.md` link (if served) gets the
only persistent highlight. Room "goes quiet" — visually reinforces that the run ended,
nothing is left spinning.

---

## 6. Implementation order (post-kickoff, 2 evenings max)

1. Card states + pulse + counters + activity sort (evening 1, ~1-2h). Highest
   judge-value per line of code: concurrency made visible.
2. HOLD sequence (evening 1 continued or evening 2, ~2h). Signature moment.
3. Routing dots (evening 2, ~1h, optional). Cut first if time is tight.
4. End flourish (15 min).

Constraints honored:

- `web.ts` server changes: none required (client-side only).
- PAGE stays regex-free template-literal code per existing repo rule.
- All timings CSS-transition based; no animation library; no external assets.
