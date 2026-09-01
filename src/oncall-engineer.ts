import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import { createInterface } from "node:readline"

/**
 * OnCallEngineer — the HUMAN in the room (framework "human participant"
 * pattern). When a revised proposal STILL fails evidence-grounding, the
 * RiskCommander escalates and a person makes the final call:
 *   - interactive → askHuman() pauses the room until a human answers
 *     (stdin in CLI mode, Approve/Reject buttons in web mode)
 *   - default → auto-decision so demos/CI never hang.
 */
export class OnCallEngineer extends BaseParticipant {
	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly interactive: boolean,
		private readonly askHuman: (prompt: string) => Promise<string> = async (prompt) => {
			const rl = createInterface({ input: process.stdin, output: process.stdout })
			return new Promise((resolve) =>
				rl.question(prompt, (answer) => {
					rl.close()
					resolve(answer)
				}),
			)
		},
	) {
		super()
	}

	async onMessage(message: string): Promise<void> {
		// Two escalation flavors share the channel: proposal escalations carry
		// "ESCALATION"; coverage-gap escalations carry "@oncall". Both land
		// here — a dead teammate is at least as decision-worthy as a risky
		// proposal.
		const isEscalation =
			(message.includes("[commander]") && message.includes("ESCALATION")) ||
			message.includes("@oncall")
		if (!isEscalation) return

		if (!this.interactive) {
			// Distinguish: proposal escalation → auto-proceed; coverage gap →
			// human-only ack (there is nothing to auto-approve when a teammate
			// died; the room is acknowledging reduced capacity).
			if (message.includes("@oncall")) {
				sendMessage(this.environment, "[oncall] coverage acknowledged — operating with reduced capacity; flagging in the handover notes", this)
				return
			}
			sendMessage(this.environment, "[oncall] auto-review: proceeding with the revised proposal under extra monitoring", this)
			return
		}

		const answer = await this.askHuman(
			`\n⏸  ON-CALL (you): the room escalated.\n   ${message.slice(0, 160)}\n   Do you APPROVE proceeding? [y/N] `,
		)
		const approved = answer.trim().toLowerCase().startsWith("y")
		sendMessage(
			this.environment,
			`[oncall] human decision: ${approved ? "APPROVED — proceed with monitoring" : "REJECTED — containment measures only"}`,
			this,
		)
	}
}
