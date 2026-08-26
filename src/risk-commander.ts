import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import { TriageAgent } from "./triage-agent"
import { LogSleuth } from "./log-sleuth"

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
		// Commander only reacts to the specialist agents.
		this.listens = [TriageAgent, LogSleuth]
	}

	async onMessage(message: string): Promise<void> {
		// We also receive feed messages; ignore everything except agent advice.
		if (message.startsWith("[sleuth]")) {
			this.latestSignature = message
			const code = message.match(/[A-Z0-9_]{4,}ERROR[A-Z0-9_]*/)?.[0]
			if (code && !this.signaturesSeen.includes(code)) this.signaturesSeen.push(code)
			return
		}
		if (!message.startsWith("[triage]")) return

		// Identical-message dedupe: never challenge the same text twice
		// (protects against renegotiation ping-pong).
		if (message === this.lastChallenged) return

		// Contract tokens: strip the routing prefix, then require the token to
		// open its own statement — start of message, a new line, or a sentence
		// boundary ("...contention. PROPOSAL: ..."). A bare space is NOT a
		// boundary, so "REVISED PROPOSAL:" can never masquerade as a plain
		// proposal. Models under pressure cram everything onto one line;
		// newline-only anchoring let them dodge the gate (observed 2026-09).
		const body = message.replace(/^\[triage\]\s*/, "")
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
		const challenge = `${kind} — that proposal ${reason}. Confirmed evidence so far: ${this.signaturesSeen.join(", ") || "none yet"}. ${guidance}`
		this.challenges.push(source)
		console.log(`  [commander] ⚠ challenging: ${source.slice(0, 60)}…`)
		sendMessage(this.environment, `[commander] ${challenge}`, this)
	}
}
