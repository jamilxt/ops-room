// Regression harness for the commander gate: replays the exact lines that
// escaped or mis-fired in the 2026-09-06 Mac runs plus safe/grounded forms.
import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import { RiskCommander } from "../src/risk-commander"
import { TriageAgent } from "../src/triage-agent"
import { LogSleuth } from "../src/log-sleuth"

class Room extends BaseParticipant {
	readonly heard: string[] = []
	async onMessage(m: string): Promise<void> {
		if (m.startsWith("[commander]")) this.heard.push(m)
	}
}
const env = new AgenticEnvironment()
const room = new Room()
room.join(env)
// Senders must satisfy `source instanceof listener` where the commander
// listens to [TriageAgent, LogSleuth]: use quiet subclasses of the REAL
// classes (identity preserved, reaction side-effects muted).
class QuietSleuth extends LogSleuth {
	async onMessage(): Promise<void> {}
}
class QuietTriage extends TriageAgent {
	async onMessage(): Promise<void> {}
}
const fakeSleuth = new QuietSleuth(env, false)
const fakeTriage = new QuietTriage(env, false)
fakeSleuth.join(env)
fakeTriage.join(env)
const cmd = new RiskCommander(env)
cmd.join(env)

// seed two confirmed signatures like the sleuth would
await sendMessage(env, "[sleuth] error signature: pool.ts TIMEOUT_ERROR acquiring connection", fakeSleuth)
await sendMessage(env, "[sleuth] error signature: handler.ts CHECKOUT_LOCK_ERROR lock contention", fakeSleuth)

async function feed(msg: string): Promise<void> {
	await sendMessage(env, msg, fakeTriage)
}

const results: Array<[string, boolean]> = []
function check(name: string, cond: boolean) {
	results.push([name, cond])
}

// 1. mid-line proposal (escaped the old gate on the Mac)
await feed(`[triage] Checkout service p95 latency spikes due to database contention. PROPOSAL: resize the checkout database connection pool to 50% over current size. ACTION: verify saturation.`)
check("mid-line uncited PROPOSAL gets challenged", cmd.challenges.length === 1)

// 2. multiline classic (must still work)
await feed(`[triage] ROOT CAUSE: pool exhaustion\nPROPOSAL: resize pool to 500\nACTION: adjust size.`)
check("multiline uncited PROPOSAL gets challenged", cmd.challenges.length === 2)

// 3. uncited REVISED PROPOSAL (skipped scrutiny before)
await feed(`[triage] REVISED PROPOSAL: resize the database connection pool further.\nACTION: monitor.`)
check("uncited REVISED PROPOSAL escalates", /ESCALATION/.test(room.heard[room.heard.length - 1]))

// 4. grounded revision accepted silently
let before = cmd.challenges.length
await feed(`[triage] REVISED PROPOSAL: Resize pool to alleviate TIMEOUT_ERROR and reduce queue depth.\nACTION: monitor utilization.`)
check("grounded REVISED PROPOSAL passes in silence", cmd.challenges.length === before)

// 5. restart-all-pods prose without tokens (safety net)
before = cmd.challenges.length
await feed(`[triage] We should restart all pods immediately to clear the state.`)
check("prose restart-all-pods caught by safety net", cmd.challenges.length === before + 1)

// 6. canary rollback exempt — cited, staged wording stays untouched
before = cmd.challenges.length
await feed(`[triage] TIMEOUT_ERROR continues past rollout.\nPROPOSAL: Canary rollback checkout service to previous stable version.\nACTION: monitor error rate.`)
check("cited canary rollback exempt from challenge", cmd.challenges.length === before)

// 7. two-strike bound — consecutive ungrounded FRESH proposals
await feed(`[triage] ROOT CAUSE: gateway latency\nPROPOSAL: restart payment pods to clear connections\nACTION: verify.`)
check("first ungrounded fresh proposal gets HOLD", /HOLD/.test(room.heard[room.heard.length - 1]))
await feed(`[triage] ROOT CAUSE: gateway latency still climbing\nPROPOSAL: restart payment pods once more\nACTION: verify.`)
check("second consecutive ungrounded proposal ESCALATES", /ESCALATION/.test(room.heard[room.heard.length - 1]))

let pass = 0
for (const [name, ok] of results) {
	console.log(`${ok ? "PASS" : "FAIL"} — ${name}`)
	if (ok) pass++
}
console.log(`\n${pass}/${results.length} checks passed`)
process.exit(pass === results.length ? 0 : 1)
