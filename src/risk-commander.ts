import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import { TriageAgent } from "./triage-agent"
import { LogSleuth } from "./log-sleuth"

/**
 * RiskCommander is the interception showcase: it watches recommendations
 * flowing from the specialist agents and — without any orchestrator telling
 * it when to act — challenges the ones that carry blast radius (restarts,
 * rollbacks, cache wipes) and demands a safer path. Emergent coordination,
 * not a pipeline step.
 */
export class RiskCommander extends BaseParticipant {
	readonly challenges: string[] = []

	constructor(private readonly environment: AgenticEnvironment) {
		super()
		// Commander only reacts to the specialist agents.
		this.listens = [TriageAgent, LogSleuth]
	}

	async onMessage(message: string): Promise<void> {
		// We also receive feed messages; ignore everything except agent advice.
		if (!message.startsWith("[triage]") && !message.startsWith("[sleuth]")) return

		// Risky only when unqualified — "staged/canary rollback" is the SAFE path.
		const risky =
			/restart all|rollback|drop (the )?cache|delete data|migrate all/i.test(message) &&
			!/staged|canary|gradual/i.test(message)
		if (!risky) return

		const challenge = `HOLD — that recommendation has blast radius. Impact vs the ${this.signaturesSeen()} signature we already have: propose the lowest-risk mitigation first`
		this.challenges.push(message)
		console.log(`  [commander] ⚠ challenging: ${message.slice(0, 60)}…`)
		sendMessage(this.environment, `[commander] ${challenge}`, this)
	}

	private signaturesSeen(): string {
		return this.challenges.length > 0 ? "known" : "suspected"
	}
}
