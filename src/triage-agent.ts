import {
	AgenticEnvironment,
	BaseParticipant,
	ModelContext,
	ModelMessageItem,
	UserMessageItem,
	runInference,
	sendMessage,
	type ModelName,
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
			// deepseek-v4-flash routes through the generic OpenAI-compatible
			// endpoint, so OPENAI_BASE_URL can point at Ollama / LM Studio /
			// llama.cpp server — any /v1/chat/completions server works.
			const model = (process.env.LLM_MODEL as ModelName) ?? "deepseek-v4-flash"
			runInference({
				model,
				context: this.context,
				caller: this,
				environment: this.environment,
				// Note: Mozaik 3.14's chat-completions *streaming* path yields raw
				// SSE chunks the runtime drops; non-streaming still runs fully
				// concurrent (fire-and-forget) and returns proper context items.
				streaming: process.env.LLM_STREAMING === "true",
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

	// Relay the model's finished answer back onto the environment so the
	// commander (and the scribe) can react to it — same pattern the human
	// specialist would follow: hear telemetry, think, speak findings aloud.
	async onModelMessage(item: ModelMessageItem): Promise<void> {
		this.context.addContextItem(item)
		const text = item.content.text?.trim()
		if (!text) return
		sendMessage(this.environment, `[triage] ${text}`, this)
	}

	private log(line: string): void {
		console.log(`  [triage] ${line}`)
	}
}
