// Smoke test: human-in-the-loop escalation path. Feed an ESCALATION message
// through a real AgenticEnvironment to a joined interactive OnCallEngineer;
// answer 'y' on stdin; expect an APPROVED [oncall] publication.
import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import { OnCallEngineer } from "../src/oncall-engineer"

class Boss extends BaseParticipant {
	async onMessage(message: string): Promise<void> {
		if (!message.startsWith("[commander]")) console.log(`HEARD ON BUS: ${message}`)
	}
}

const env = new AgenticEnvironment()
const boss = new Boss()
const oncall = new OnCallEngineer(env, true)
boss.join(env)
oncall.join(env)

setTimeout(() => {
	sendMessage(env, "[commander] ESCALATION — that proposal still cites nothing. Human review required.", boss)
}, 100)
