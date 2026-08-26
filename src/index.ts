import "dotenv/config"
import { AgenticEnvironment } from "@mozaik-ai/core"
import { IncidentFeed, type FeedEvent } from "./incident-feed"
import { TriageAgent } from "./triage-agent"
import { LogSleuth } from "./log-sleuth"
import { RiskCommander } from "./risk-commander"
import { IncidentScribe } from "./incident-scribe"
import { CommsAgent } from "./comms-agent"
import { OnCallEngineer } from "./oncall-engineer"

const llm = Boolean(process.env.OPENAI_API_KEY)

const timeline: FeedEvent[] = [
	{
		delayMs: 500,
		tag: "deploy",
		text: "deploy: orders-api v2.14.3 rolled out to 3/10 instances (canary)",
	},
	{
		delayMs: 2500,
		tag: "alert",
		text: "alert: checkout p95 latency 4.2s (baseline 210ms), firing for 2m",
	},
	{
		delayMs: 2000,
		tag: "log",
		text: "log: orders-api/src/main/ts/pool.ts:88 PoolTimeoutError TIMEOUT_ERROR acquiring connection (x1,204 in 60s)",
	},
	{
		delayMs: 4000,
		tag: "metric",
		text: "metric: orders-api db connection pool utilization 100%, queue depth 312",
	},
	{
		delayMs: 5000,
		tag: "log",
		text: "log: orders-api/src/main/ts/handler.ts:41 CHECKOUT_LOCK_ERROR lock contention on cart rows (x87)",
	},
	{
		delayMs: 6000,
		tag: "alert",
		text: "alert: checkout error rate 7.8% — page the on-call, recommend whether to restart all pods",
	},
]

const environment = new AgenticEnvironment()

const feed = new IncidentFeed(environment, timeline)
const triage = new TriageAgent(environment, llm)
const sleuth = new LogSleuth(environment, llm)
// Signatures tracked by counting bus rows tagged [sleuth] (works for both
// engines since every publication carries the tag).
const sigCounter = { count: 0 }
const commander = new RiskCommander(environment)
const scribe = new IncidentScribe(() => {
	sigCounter.count++
})
const comms = new CommsAgent(environment, llm)
// Human participant: escalations pause for a real y/N answer only when
// OPSROOM_ONCALL=interactive; every other mode auto-decides (CI-safe).
const oncall = new OnCallEngineer(environment, process.env.OPSROOM_ONCALL === "interactive")

feed.join(environment)
triage.join(environment)
sleuth.join(environment)
commander.join(environment)
scribe.join(environment)
comms.join(environment)
oncall.join(environment)

console.log(`=== OpsRoom — concurrent incident response${llm ? " (LLM mode)" : " (deterministic demo)"} ===\n`)

feed.replay()

// Scenario length: sum of delays + tail; then comms synthesis → report → exit.
const totalMs = timeline.reduce((acc, e) => acc + e.delayMs, 0) + 8000
setTimeout(() => {
	// Comms runs before the report: its status update belongs on the bus and
	// in the timeline artifact the scribe writes. Local LLMs can take >12s to
	// synthesize, so poll for publication instead of a blind sleep.
	comms.finish()
	const deadline = Date.now() + 60_000
	const poll = setInterval(() => {
		if (comms.published || Date.now() > deadline) {
			clearInterval(poll)
			scribe.writeReport("incident-timeline.md")
			console.log(
				`\n[summary] sleuth signatures: ${sigCounter.count}, triage findings: ${triage.findings.length}, commander challenges: ${commander.challenges.length}`,
			)
			process.exit(0)
		}
	}, 500)
}, totalMs)
