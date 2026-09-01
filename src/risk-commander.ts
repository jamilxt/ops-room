import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import { TriageAgent } from "./triage-agent"
import { LogSleuth } from "./log-sleuth"
import { parseProposalLine } from "./proposal-protocol"

/** Mozaik doesn't export this type; mirror its shape for admitListener(). */
type ListenerCtor = new (...args: any[]) => import("@mozaik-ai/core").Participant

/**
 * RiskCommander is the interception showcase: it watches recommendations
 * flowing from the specialist agents and — without any orchestrator telling
 * it when to act — challenges the ones that carry blast radius and demands
 * a safer path. Emergent coordination, not a pipeline step.
 *
 * Interception is CONTRACT-based first, heuristic second:
 * 1. Protocol token — triage must prefix mitigation proposals with
 *    "PROPOSAL:"; the commander challenges those deterministically.
 * 2. Safety net — natural-language risk heuristics catch proposals that
 *    missed the contract (LLMs paraphrase under pressure).
 */
export class RiskCommander extends BaseParticipant {
	readonly challenges: string[] = []
	private readonly signaturesSeen: string[] = []
	private latestSignature: string | null = null
	private lastChallenged: string | null = null
	// Consecutive ungrounded PROPOSAL/REVISED PROPOSAL rows — reset when any
	// grounded one lands. Drives the two-strike escalation bound.
	private ungroundedStrikes = 0

	constructor(private readonly environment: AgenticEnvironment) {
		super()
		// Commander only reacts to the specialist agents — UNTIL a newcomer
		// proves relevant. admitListener() expands this AT RUNTIME when a
		// late-joining agent announces proposal-emitting capabilities: the
		// commander adapts to participants instead of hardcoding them.
		this.listens = [TriageAgent, LogSleuth]
	}

	/**
	 * Runtime roster adaptation: route a newly discovered participant's
	 * messages into the commander's interception scope. Called by the
	 * scenario when the DatabaseHealer joins mid-incident.
	 */
	admitListener(listener: ListenerCtor): void {
		if (this.listens.some((l) => l === listener)) return
		this.listens = [...this.listens, listener]
		console.log(`  [commander] listen scope expanded: now also watching ${listener.name}`)
	}

	/** Room goal state — set by the commander's own typed-event absorption. */
	private evidenceFirstGoal = false

	/**
	 * ADAPTABILITY TO SYSTEM GOALS: the commander doesn't just relay the
	 * pivot — it ENFORCES it. Once the preserve-evidence goal lands, the
	 * structured gate rejects any non-readonly state-changing proposal until
	 * the room captures evidence first. Policy, not prose.
	 */
	async onExternalEvent(
		_source: import("@mozaik-ai/core").Participant,
		item: import("@mozaik-ai/core").SemanticEvent<unknown>,
	): Promise<void> {
		if (item.getType() !== "goal-update") return
		const data = item.data as { goal?: string }
		if (data.goal !== "preserve-evidence") return
		this.evidenceFirstGoal = true
		sendMessage(this.environment, "[commander] goal absorbed: evidence-first is now ENFORCED — state-changing proposals without readonly capture lead will be held.", this)
	}

	async onMessage(message: string): Promise<void> {
		// We also receive feed messages; ignore everything except agent advice.
		// Listen scope covers BOTH specialists and any admitted late joiner
		// (e.g. DatabaseHealer): their proposals face the same evidence gate.
		const source = message.match(/^\[(\w+)\]/)?.[1]
		if (source === "sleuth") {
			this.latestSignature = message
			const code = message.match(/[A-Z0-9_]+_ERROR/)?.[0]
			if (code && !this.signaturesSeen.includes(code)) this.signaturesSeen.push(code)
			return
		}
		if (source !== "triage" && source !== "healer") return

		// Identical-message dedupe: never challenge the same text twice
		// (protects against renegotiation ping-pong).
		if (message === this.lastChallenged) return

		// STRUCTURED v2 GATE (primary): canonical proposal lines carry typed
		// fields — gate on those. A proposal is blocked when:
		//   - it cites NO confirmed signature (grounding), or
		//   - blastRadius is "broad" (fleet-wide / data-touching), or
		//   - the room's goal is evidence-first and the proposal is NOT
		//     readonly-capture-first while proposing a state change.
		const structured = parseProposalLine(message)
		if (structured) {
			const { proposal } = structured
			const grounded = proposal.cites.some((c) => this.signaturesSeen.includes(c))
			if (!grounded) {
				this.ungroundedStrikes++
				const humanTime = proposal.kind === "REVISED PROPOSAL" || this.ungroundedStrikes >= 2
				this.emit(
					humanTime ? "ESCALATION" : "HOLD",
					message,
					`cites [${proposal.cites.join(", ") || "no signatures"}] but confirmed evidence is (${this.signaturesSeen.join(", ") || "none yet"})`,
					humanTime
						? "This has gone past automated review — escalating to the on-call engineer for a human decision."
						: "Re-submit citing at least one confirmed signature.",
				)
				return
			}
			if (proposal.blastRadius === "broad") {
				this.emit("HOLD", message, "declares blastRadius: broad (fleet-wide / data-touching)",
					"Re-submit with a targeted or readonly lever (canary scope, pool resize, lock retry).")
				return
			}
			if (this.evidenceFirstGoal && !proposal.evidenceFirst && proposal.blastRadius !== "readonly") {
				this.emit("HOLD", message, "proposes a state change while the room's goal is evidence-first",
					"Capture readonly evidence first (snapshot) and set evidenceFirst: true, then re-propose.")
				return
			}
			// Structured + grounded + scoped: accepted, room back in sync.
			this.ungroundedStrikes = 0
			return
		}

		// V1 PROSE NET (safety net): free-text "PROPOSAL:" lines from any
		// source that did not go through the typed contract (healer v1 lines,
		// structured-path fallback when a provider ignores the schema).
		const body = message.replace(/^\[(triage|healer)\]\s*/, "")
		const OPEN = "(^|\\n|[.!?]\\s)"
		const isRevision = new RegExp(`${OPEN}REVISED PROPOSAL:`).test(body)
		const isProposal = !isRevision && new RegExp(`${OPEN}PROPOSAL:`).test(body)

		if (isProposal || isRevision) {
			// Evidence-grounding gate — applies to BOTH forms. Before this,
			// an uncited "REVISED PROPOSAL:" skipped scrutiny entirely.
			const grounded = this.signaturesSeen.some((sig) => message.includes(sig))
			if (!grounded) {
				this.ungroundedStrikes++
				// Two-strike bound: a revision fails straight to human; two
				// consecutive uncited fresh proposals mean the model is ignoring
				// instructions — stop looping, a person decides (observed: three
				// HOLD rounds of reworded proposals in one run).
				const humanTime = isRevision || this.ungroundedStrikes >= 2
				const kind = humanTime ? "ESCALATION" : "HOLD"
				const guidance = humanTime
					? "This has gone past automated review — escalating to the on-call engineer for a human decision."
					: "Revise it against the confirmed signatures — PROPOSAL must cite at least one (REVISED PROPOSAL:)."
				this.emit(kind, message,
					`does not reference any confirmed signature (${this.signaturesSeen.join(", ") || "none yet"})`,
					guidance)
				return
			}
			// Grounded proposal/revision accepted: room is back in sync.
			this.ungroundedStrikes = 0
			return
		}

		// Safety net: prose heuristics for un-tokenized phrasings (blast radius).
		let risky = false
		let reason = ""
		const impliesRestart = /restart|reboot/i.test(message)
		const touchesInfra = /\b(pod|instance|service|node)s?\b/i.test(message)
		const blanketRisk =
			/restart all|roll\s?back|drop (the )?cache|delete data|migrate all/i.test(message)
		const safePath = /staged|canary|gradual/i.test(message)
		risky = !safePath && ((impliesRestart && touchesInfra) || blanketRisk)
		if (risky) this.emit("HOLD", message, "blast-radius action without prior sign-off",
			"Revise it against the confirmed signatures — PROPOSAL must cite at least one (REVISED PROPOSAL:).")
	}

	private emit(kind: "HOLD" | "ESCALATION", source: string, reason: string, guidance: string) {
		this.lastChallenged = source
		// Address the offender by its routing tag: the room is concurrent —
		// without a named target, OTHER agents mistake the challenge for one
		// aimed at them and re-revise their own (already accepted) proposals.
		const offender = source.match(/^\[(\w+)\]/)?.[1] ?? "agent"
		const challenge = `${kind} @${offender} — that proposal ${reason}. Confirmed evidence so far: ${this.signaturesSeen.join(", ") || "none yet"}. ${guidance}`
		this.challenges.push(source)
		console.log(`  [commander] ⚠ challenging: ${source.slice(0, 60)}…`)
		sendMessage(this.environment, `[commander] ${challenge}`, this)
	}
}
