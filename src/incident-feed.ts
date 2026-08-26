import { BaseParticipant, AgenticEnvironment, sendMessage } from "@mozaik-ai/core"

export interface FeedEvent {
	delayMs: number
	tag: "alert" | "metric" | "log" | "deploy"
	text: string
}

/**
 * IncidentFeed is a deterministic stand-in for production telemetry.
 * In the real system this would be a webhook/SSE bridge; here it replays a
 * scripted timeline onto the agentic environment exactly like a human typing
 * messages — every participant sees each event the moment it lands.
 */
export class IncidentFeed extends BaseParticipant {
	private timer?: ReturnType<typeof setTimeout>
	private cancelled = false

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly timeline: FeedEvent[],
	) {
		super()
	}

	/** Replays the timeline onto the environment without blocking anyone. */
	replay(): void {
		let elapsed = 0
		for (const event of this.timeline) {
			elapsed += event.delayMs
			const at = elapsed
			setTimeout(() => {
				if (this.cancelled) return
				sendMessage(this.environment, `[${event.tag}] ${event.text}`, this)
			}, at)
		}
		// Let the process know when the script is done.
		elapsed += 1500
		setTimeout(() => {
			if (this.cancelled) return
			sendMessage(this.environment, "[feed] timeline exhausted — incident is yours, team", this)
		}, elapsed)
	}

	stop(): void {
		this.cancelled = true
		if (this.timer) clearTimeout(this.timer)
	}
}
