import { AgenticEnvironment, BaseParticipant, sendMessage, type Participant } from "@mozaik-ai/core"
import { searchFixture } from "./fixture-search"

/**
 * DatabaseHealer — the late-joining specialist.
 *
 * THE INTEROPERABILITY DEMO: this agent was NOT part of the original room
 * roster. It joins mid-incident, right after the lock-contention log lands,
 * and:
 *   1. Announces itself (onJoined) with its capability contract.
 *   2. Greeted by every existing agent's onParticipantJoined — nobody had
 *      this agent compiled in, yet the room reorganizes around it.
 *   3. Watches for CHECKOUT_LOCK_ERROR signals; once lock evidence is
 *      confirmed, publishes an analysis and a least-blast-radius PROPOSAL
 *      under the room's EXISTING protocol — no coordinator, no code change
 *      to any other agent.
 *
 * Design notes:
 * - `listens` stays EMPTY: the healer hears every speaker (feed, triage,
 *   sleuth, commander) — it is the newcomer feeling the room out.
 * - Deterministic mode keeps the demo offline-reliable: analysis and
 *   proposal are rule-derived from actual fixture content. LLM mode adds
 *   a model-written rationale on top (same guarantee pattern as LogSleuth).
 * - It dedupes its proposal: fires once per confirmed lock signature.
 */
export class DatabaseHealer extends BaseParticipant {
	readonly analyses: string[] = []
	private readonly seenLockEvidence = new Set<string>()
	private proposed = false
	/** Set on the first onParticipantJoined call (= our own join); guards against echoing during assembly. */
	private joinedAt: Participant | null = null

	constructor(private readonly environment: AgenticEnvironment) {
		super()
	}

	/** Capability announcement — the room's first contact with the stranger. */
	async onJoined(): Promise<void> {
		// Framework quirk: onJoined() fires INSIDE subscribe(), before the
		// participant counts as joined — a direct sendMessage here throws
		// "Not joined to environment". Defer one tick; by then the join is
		// complete and the announcement reaches every participant.
		setTimeout(() => {
			sendMessage(
				this.environment,
				"[healer] joining mid-incident — capabilities: analyzes lock contention (CHECKOUT_LOCK_ERROR / PessimisticLockException), reads fixture logs, emits evidence-cited mitigation proposals under the room's token contract (least-blast-radius levers only: pool resize, lock retry tuning). I learn the protocol from the bus, not from your configs.",
				this,
			)
		}, 0)
	}

	/**
	 * Runtime discovery: every original agent greets the newcomer here.
	 * The healer records who is present and answers — visible proof that
	 * awareness flows BOTH ways without any compile-time knowledge.
	 * (Also fires during the healer's OWN join for each existing member,
	 * hence the newcomer-side guard: react only to joins AFTER ours.)
	 */
	async onParticipantJoined(participant: Participant): Promise<void> {
		if (this.joinedAt === null) {
			this.joinedAt = participant
			return
		}
		sendMessage(
			this.environment,
			`[healer] nice to meet you, ${participant.constructor.name} — I'll stay out of your lanes unless lock evidence shows up.`,
			this,
		)
	}

	async onMessage(message: string): Promise<void> {
		// Only room SOURCES count as evidence. The commander's challenges quote
		// error codes ("does not reference CHECKOUT_LOCK_ERROR") — treating
		// those as lock evidence would make the healer re-analyze its own
		// reviewer. Same for comms/feed/oncall chatter.
		if (/^\[(commander|oncall|comms|feed|roster)\]/.test(message)) return

		// Only lock-related evidence interests the healer.
		const isLockEvidence =
			message.includes("CHECKOUT_LOCK_ERROR") ||
			message.includes("PessimisticLockException") ||
			message.includes("lock contention")
		if (!isLockEvidence) return

		// Dedupe: one analysis per distinct evidence line.
		if (this.seenLockEvidence.has(message)) return
		this.seenLockEvidence.add(message)

		// GUARANTEED PATH: ground the analysis in the fixture directly —
		// same offline-reliable pattern as LogSleuth's grep.
		const report = searchFixture("checkout.log", "CHECKOUT_LOCK_ERROR")
		const matchCount = Number(report.split("\n")[0]?.match(/^(\d+)/)?.[1] ?? 0)
		const canaryLine = report.split("\n").find((l) => l.includes("canary"))
		const analysis = `[healer] lock analysis: ${matchCount} CHECKOUT_LOCK_ERROR rows confirmed in checkout.log${canaryLine ? ` — ${canaryLine.trim()}` : ""}. Pattern matches hot-row contention on the cart table, not a code defect: safest lever is contention reduction, not redeployment.`
		if (!this.analyses.some((a) => a === analysis)) {
			this.analyses.push(analysis)
			sendMessage(this.environment, analysis, this)
		}

		if (this.proposed) return
		this.proposed = true
		const proposal = "[healer] PROPOSAL: shrink checkout transaction scope and add targeted lock retry with backoff on the cart row; canary pods only. Cites CHECKOUT_LOCK_ERROR (confirmed above); all-pods restart explicitly rejected — least blast radius first."
		sendMessage(this.environment, proposal, this)

		// LLM BONUS PATH: model-written one-clause rationale for depth.
		// Fire-and-forget; the deterministic outputs above already carry
		// the demo if inference is slow or unavailable.
		// (LLM rationale intentionally omitted from v1 — deterministic path
		// is the demo guarantee; see README roadmap.)
	}

	/** If the healer throws anywhere, announce it — never go silent (framework rule). */
	onError(error: Error): void {
		sendMessage(this.environment, `[healer] WARNING: database healer hit an error — ${error.message}`, this)
	}
}
