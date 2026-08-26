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
			return
		}
		if (!message.startsWith("[triage]")) return

		// Identical-message dedupe: never challenge the same text twice
		// (protects against renegotiation ping-pong).
		if (message === this.lastChallenged) return

		// 1. Contract path: anchored tokens. A first proposal ("PROPOSAL:") is
		//    intercepted once; a "REVISED PROPOSAL:" resolves the negotiation.
		const isProposal = message.startsWith("[triage] PROPOSAL:")
		const isRevision = message.startsWith("[triage] REVISED PROPOSAL:")
		let risky = isProposal

		// 2. Safety net: prose heuristics for un-tokenized phrasings.
		if (!risky && !isRevision) {
			// Stem-matched so verb forms ("restarting", "rebooted") also trigger;
			// the pod/instance/service/node noun ties the action to infra.
			const impliesRestart = /restart|reboot/i.test(message)
			const touchesInfra = /\b(pod|instance|service|node)s?\b/i.test(message)
			const blanketRisk =
				/restart all|roll\s?back|drop (the )?cache|delete data|migrate all/i.test(message)
			const safePath = /staged|canary|gradual/i.test(message)
			risky = !safePath && ((impliesRestart && touchesInfra) || blanketRisk)
		}
		if (!risky) return

		this.lastChallenged = message

		const challenge = `HOLD — that recommendation has blast radius. Weigh it against the room's evidence (${this.latestSignature ?? "no signature yet"}) and propose the lowest-risk mitigation first`
		this.challenges.push(message)
		console.log(`  [commander] ⚠ challenging: ${message.slice(0, 60)}…`)
		sendMessage(this.environment, `[commander] ${challenge}`, this)
	}
}
