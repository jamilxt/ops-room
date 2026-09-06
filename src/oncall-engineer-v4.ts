import { createAgent, type SituationHandler } from "@mozaik-ai/core"
import { sendMessage, whenMessageFrom, processorFor } from "./runtime-v4"

/**
 * OnCallEngineer v4 — the HUMAN in the room. Proposal escalations carry
 * "ESCALATION"; coverage-gap escalations carry "@oncall". Interactive mode
 * pauses for a real answer; default auto-decides so demos/CI never hang.
 */
export function createOnCallEngineer(
	interactive: boolean,
	askHuman: (prompt: string) => Promise<string>,
) {
	const handlers: SituationHandler[] = [
		{
			specification: whenMessageFrom(
				(message) =>
					(message.includes("[commander]") && message.includes("ESCALATION")) ||
					message.includes("@oncall"),
			),
			processor: processorFor(async (message, participant) => {
				if (!interactive) {
					if (message.includes("@oncall")) {
						sendMessage("[oncall] coverage acknowledged — operating with reduced capacity; flagging in the handover notes", participant.getId())
						return
					}
					sendMessage("[oncall] auto-review: proceeding with the revised proposal under extra monitoring", participant.getId())
					return
				}

				const answer = await askHuman(
					`\n⏸  ON-CALL (you): the room escalated.\n   ${message.slice(0, 160)}\n   Do you APPROVE proceeding? [y/N] `,
				)
				const a = answer.trim().toLowerCase()
				const approved = a.startsWith("y") || a === "approve" || a === "yes"
				sendMessage(
					`[oncall] human decision: ${approved ? "APPROVED — proceed with monitoring" : "REJECTED — containment measures only"}`,
					participant.getId(),
				)
			}),
		},
	]

	// The on-call is a HUMAN-class participant: it produces decisions, not
	// inference. v4 models humans with createHuman + handlers.
	const human = createAgent({
		name: "OnCallEngineer",
		capabilities: [],
		instruction: "You are the on-call engineer. Escalations reach you; you make the final call.",
		tools: [],
		handlers,
	})

	return { agent: human }
}
