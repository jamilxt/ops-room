import { SituationSpecification, UserMessageItem, createAgent, type Agent, type SituationContext, type SituationHandler } from "@mozaik-ai/core"
import { sendMessage, runLoop, whenMessageFrom, processorFor, eventProcessorFor } from "./runtime-v4"
import { defaultModelName } from "./model-default.js"

/**
 * CommsAgent v4 — the incident communications lead. Ambient awareness:
 * every room message lands in its memory context; synthesis fires once when
 * the feed is exhausted. The two artifacts come back via the model.answer
 * bus event (v4's replacement for onModelMessage overrides).
 */
export function createCommsAgent(llm: boolean) {
	const draft: string[] = []
	let published = false
	const model = defaultModelName()

	const handlers: SituationHandler[] = [
		{
			specification: whenMessageFrom(() => true),
			processor: processorFor((message, participant) => {
				draft.push(message)
				// Ambient awareness: fold into context, no inference yet.
				;(participant as Agent).getMemory().getContext().addContextItems([UserMessageItem.create(message)])
			}),
		},
		{
			// The agent's own model.answer IS the publishable status update.
			specification: new (class extends SituationSpecification {
				isSatisfiedBy({ event, participant }: SituationContext): boolean {
					return event.type === "model.answer" && event.producerId === participant.getId()
				}
			})(),
			processor: eventProcessorFor((event, participant) => {
				const answer = (event.payload as { answer?: { content?: { text?: string } } })?.answer
				const text = answer?.content?.text?.trim()
				if (!text) return
				published = true
				sendMessage(`[comms] ${text}`, participant.getId())
				console.log(`  [comms] draft ready (${text.length} chars)`)
			}),
		},
	]

	const agent = createAgent({
		name: "CommsAgent",
		capabilities: ["inference"],
		instruction: `You are the incident communications lead in a live war room. You have silently watched the entire incident: telemetry, triage findings, log analysis, risk challenges.
Write two artifacts, nothing else:
STATUS UPDATE (customer-facing): at most 5 sentences. Plain language, no internal jargon, no blame. State what happened, what is affected, what we are doing, current status.
NEXT STEPS (internal): at most 3 bullets, each one concrete action with owner role.
Be factual. Use only facts from the transcript you were given.`,
		tools: [],
		handlers,
	})

	agent.setHandlers(handlers)

	return {
		agent,
		isPublished: () => published,
		finish() {
			if (!llm) {
				published = true
				const sigs = draft.filter((m) => m.startsWith("[sleuth]") && m.includes("error signature")).length
				sendMessage("[comms] STATUS UPDATE (deterministic): We identified degraded checkout performance following a canary deploy to orders-api. Two error signatures were confirmed by automated log analysis. A mitigation review is underway under risk supervision. Services remain partially degraded while we roll out the safest fix first.", agent.getId())
				console.log(`  [comms] deterministic status update published (${sigs} signatures observed)`)
				return
			}
			runLoop(agent.getId(), "The incident timeline is complete. Publish the STATUS UPDATE and NEXT STEPS artifacts now.", {
				model,
				context: agent.getMemory().getContext(),
				streaming: false,
			})
			console.log("  [comms] synthesizing status update from full room transcript…")
		},
	}
}
