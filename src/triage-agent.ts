import {
	AgenticEnvironment,
	BaseParticipant,
	ModelContext,
	UserMessageItem,
	runInference,
	sendMessage,
} from "@mozaik-ai/core"
import type { IncidentFeed } from "./incident-feed"

/**
 * TriageAgent reacts to alerts and metrics from the feed.
 * When an LLM key is configured it streams real inference; in deterministic
 * demo mode it derives a rapid hypothesis locally. Either way it never blocks
 * the environment — everything it does is fire-and-forget onto the bus.
 */
export class TriageAgent extends BaseParticipant {
	private readonly context = ModelContext.create("triage")
	readonly findings: string[] = []

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly llm: boolean,
	) {
		super()
		// Only react to telemetry, not to other agents' chatter (that's the
		// commander's job).
		this.listens = []
	}

	async onMessage(message: string): Promise<void> {
		if (!message.startsWith("[alert]") && !message.startsWith("[metric]")) return

		this.log(`picked up: ${message.slice(0, 70)}…`)
		this.findings.push(message)

		if (this.llm) {
			this.context.addContextItem(UserMessageItem.create(message))
			runInference({
				model: "gpt-5.4",
				context: this.context,
				caller: this,
				environment: this.environment,
				streaming: true,
			})
			return
		}

		// Deterministic demo hypothesis — arrives slightly "late" to show that
		// the sleuth is working in parallel, not waiting for triage.
		setTimeout(() => {
			const risky = message.includes("recommend whether to restart all pods")
			const hypothesis = risky
				? "recommendation: restart ALL orders-api pods immediately to clear the stuck connection pool"
				: message.includes("checkout")
					? "hypothesis: checkout latency correlates with the deploy; suspect connection-pool exhaustion in orders-api"
					: "hypothesis: partial degradation, likely a bad instance behind the load balancer"
			sendMessage(this.environment, `[triage] ${hypothesis}`, this)
			this.log(`${risky ? "recommendation" : "hypothesis"} emitted`)
		}, 900)
	}

	private log(line: string): void {
		console.log(`  [triage] ${line}`)
	}
}
