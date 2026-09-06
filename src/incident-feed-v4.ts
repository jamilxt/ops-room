import { SemanticEvent, createAgent, createHuman, type SituationHandler } from "@mozaik-ai/core"
import { deliverSemanticEvent, sendMessage, whenMessageFrom, whenParticipantJoins, whenParticipantLeaves, whenExternalEvent, processorFor, eventProcessorFor } from "./runtime-v4"

/**
 * IncidentFeed v4: a deterministic stand-in for production telemetry.
 * In v4 the feed is a Human-class participant (it only produces messages).
 * Handlers are registered after creation via setHandlers / config.
 */
export interface FeedEvent {
	delayMs: number
	tag: "alert" | "metric" | "log" | "deploy"
	text: string
}

export function createIncidentFeed(timeline: FeedEvent[]) {
	let cancelled = false
	const feed = createHuman({
		name: "IncidentFeed",
		capabilities: [],
		handlers: [],
	})
	return {
		participant: feed,
		getId: () => feed.getId(),
		replay() {
			let elapsed = 0
			for (const event of timeline) {
				elapsed += event.delayMs
				setTimeout(() => {
					if (cancelled) return
					sendMessage(`[${event.tag}] ${event.text}`, feed.getId())
				}, elapsed)
			}
			elapsed += 1500
			setTimeout(() => {
				if (cancelled) return
				sendMessage("[feed] timeline exhausted — incident is yours, team", feed.getId())
			}, elapsed)
		},
		stop() {
			cancelled = true
		},
		/** Goal pivot as a TYPED event (adaptability showcase). */
		publishGoalUpdate(goal: string, directive: string) {
			deliverSemanticEvent(feed, SemanticEvent.create("goal-update", feed.getId(), { goal, directive }))
		},
	}
}
