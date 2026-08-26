import { AgenticEnvironment, BaseParticipant, DeveloperMessageItem, ModelContext, ModelMessageItem, UserMessageItem, runInference, sendMessage, type ModelName } from "@mozaik-ai/core"

/**
 * CommsAgent is the incident communications lead. It listens to the whole
 * room — telemetry, specialist findings, commander challenges — and at the
 * end of the scenario drafts the customer-facing status-page update plus an
 * internal next-steps brief.
 *
 * Design point: this agent does NO real-time reaction and NO interception.
 * It exists to show a third coordination pattern (ambient awareness →
 * synthesis) and to produce a human-readable artifact for the demo.
 */
export class CommsAgent extends BaseParticipant {
	readonly draft: string[] = []
	private readonly context = ModelContext.create("comms")

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly llm: boolean,
	) {
		super()
		this.context.addContextItem(
			DeveloperMessageItem.create(
				`You are the incident communications lead in a live war room. You have silently watched the entire incident: telemetry, triage findings, log analysis, risk challenges.
Write two artifacts, nothing else:
STATUS UPDATE (customer-facing): at most 5 sentences. Plain language, no internal jargon, no blame. State what happened, what is affected, what we are doing, current status.
NEXT STEPS (internal): at most 3 bullets, each one concrete action with owner role.
Be factual. Use only facts from the transcript you were given.`,
			),
		)
	}

	async onMessage(message: string): Promise<void> {
		this.draft.push(message)
		// Ambient awareness: every room message lands in context (no inference
		// yet — that's exactly what makes this cheap while staying informed).
		this.context.addContextItem(UserMessageItem.create(message))
	}

	/**
	 * Called once when the feed is exhausted. Synthesizes the full room
	 * transcript into the two artifacts.
	 */
	finish(): void {
		if (!this.llm) {
			const sigs = this.draft.filter((m) => m.startsWith("[sleuth]")).length
			sendMessage(this.environment, "[comms] STATUS UPDATE (deterministic): We identified degraded checkout performance following a canary deploy to orders-api. Two error signatures were confirmed by automated log analysis. A mitigation review is underway under risk supervision. Services remain partially degraded while we roll out the safest fix first.", this)
			console.log(`  [comms] deterministic status update published (${sigs} signatures observed)`)
			return
		}
		const model = (process.env.LLM_MODEL as ModelName) ?? "deepseek-v4-flash"
		runInference({
			model,
			context: this.context,
			caller: this,
			environment: this.environment,
			streaming: false,
		})
		console.log("  [comms] synthesizing status update from full room transcript…")
	}

	async onModelMessage(item: ModelMessageItem): Promise<void> {
		const text = item.content.text?.trim()
		if (!text) return
		sendMessage(this.environment, `[comms] ${text}`, this)
		console.log(`  [comms] draft ready (${text.length} chars)`)
	}
}
