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

		// Contract tokens: strip the routing prefix first, then match at string
		// start or after a newline — covers both single-line replies and
		// multi-part answers like "ROOT CAUSE: ...\nPROPOSAL: ...".
		const body = message.replace(/^\[triage\]\s*/, "")
		const isRevision = /(^|\n)REVISED PROPOSAL:/.test(body)
		const isProposal = !isRevision && /(^|\n)PROPOSAL:/.test(body)

		let risky = false
		let reason = ""
		if (isProposal) {
			// Evidence-grounding gate: a mitigation proposal must reference at
			// least one confirmed signature. Safe-sounding but ungrounded plans
			// get challenged too — grounding is what makes them trustworthy.
			const grounded = this.signaturesSeen.some((sig) => message.includes(sig))
			if (!grounded) {
				risky = true
				reason = `does not reference any confirmed signature (${this.signaturesSeen.join(", ") || "none yet"})`
			}
		}
		if (!risky && !isRevision) {
			// Safety net: prose heuristics for un-tokenized phrasings.
			const impliesRestart = /restart|reboot/i.test(message)
			const touchesInfra = /\b(pod|instance|service|node)s?\b/i.test(message)
			const blanketRisk =
				/restart all|roll\s?back|drop (the )?cache|delete data|migrate all/i.test(message)
			const safePath = /staged|canary|gradual/i.test(message)
			risky = !safePath && ((impliesRestart && touchesInfra) || blanketRisk)
			if (risky) reason = "blast-radius action without prior sign-off"
		}
		if (!risky) return

		this.lastChallenged = message

		const challenge = `HOLD — that proposal ${reason}. Confirmed evidence so far: ${this.signaturesSeen.join(", ") || "none yet"}. ${isRevision ? "Escalate to the risk review queue instead." : "Revise it against the confirmed signatures — PROPOSAL must cite at least one (REVISED PROPOSAL:)."}`
		this.challenges.push(message)
		console.log(`  [commander] ⚠ challenging: ${message.slice(0, 60)}…`)
		sendMessage(this.environment, `[commander] ${challenge}`, this)
	}
}
