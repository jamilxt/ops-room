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
	private latestSignature: string | null = null

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

		// Risky only when unqualified — "staged/canary rollback" is the SAFE path.
		// Stem-matched so verb forms ("restarting", "rebooted") also trigger;
		// the pod/instance/service/node noun must appear somewhere nearby-ish
		// to tie the action to infra. LLM phrasings vary wildly every run.
		const impliesRestart = /restart|reboot/i.test(message)
		const touchesInfra = /\b(pod|instance|service|node)s?\b/i.test(message)
		const blanketRisk =
			/restart all|roll\s?back|drop (the )?cache|delete data|migrate all/i.test(message)
		const safePath = /staged|canary|gradual/i.test(message)
		const risky = !safePath && ((impliesRestart && touchesInfra) || blanketRisk)
		if (!risky) return

		const challenge = `HOLD — that recommendation has blast radius. Weigh it against the room's evidence (${this.latestSignature ?? "no signature yet"}) and propose the lowest-risk mitigation first`
		this.challenges.push(message)
		console.log(`  [commander] ⚠ challenging: ${message.slice(0, 60)}…`)
		sendMessage(this.environment, `[commander] ${challenge}`, this)
	}
}
