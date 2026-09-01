import "dotenv/config"
import { AgenticEnvironment } from "@mozaik-ai/core"
import { IncidentFeed, type FeedEvent } from "./incident-feed"
import { TriageAgent } from "./triage-agent"
import { LogSleuth } from "./log-sleuth"
import { RiskCommander } from "./risk-commander"
import { IncidentScribe } from "./incident-scribe"
import { CommsAgent } from "./comms-agent"
import { OnCallEngineer } from "./oncall-engineer"
import { DatabaseHealer } from "./database-healer"
import { TriageAgent as TriageAgentClass } from "./triage-agent"
import type { Participant } from "@mozaik-ai/core"

/**
 * Shared scenario engine: builds a FRESH environment + all seven participants
 * and replays the incident once. Both entrypoints ride on this:
 *   - src/index.ts → pure console (identical behavior to the original CLI)
 *   - src/web.ts   → every row streamed to the browser, human decision via UI
 *
 * TELEMETRY FLAVOR: events are written for a Java/Spring Boot audience —
 * Hikari pool saturation, Micrometer/Actuator metrics, JPA pessimistic locks,
 * .java stack frames. The machine-readable CONTRACT is unchanged: tags
 * ([deploy]/[alert]/[log]/[metric]) and error codes (TIMEOUT_ERROR,
 * CHECKOUT_LOCK_ERROR) so all gates/rules behave identically to before.
 */
const timeline: FeedEvent[] = [
	{
		delayMs: 500,
		tag: "deploy",
		text: "deploy: orders-api v2.14.3 rolled out to 3/10 pods (canary) — Spring Boot 3 fat jar, Hikari pool 10 conns/pod",
	},
	{
		delayMs: 2500,
		tag: "alert",
		text: "alert: actuator http.server.requests p95 4.2s (baseline 210ms) on POST /api/checkout, firing for 2m",
	},
	{
		delayMs: 2000,
		tag: "log",
		text: "log: orders-api CheckoutRepository.java:88 SQLTransientConnectionException TIMEOUT_ERROR acquiring Hikari connection, waited 5000ms (x1,204 in 60s)",
	},
	{
		delayMs: 4000,
		tag: "metric",
		text: "metric: orders-api HikariPool-1 active 100% (10/10), threads waiting 312 — micrometer gauge hikaricp.connections.pending=312",
	},
	{
		delayMs: 5000,
		tag: "log",
		text: "log: orders-api CheckoutService.java:41 PessimisticLockException CHECKOUT_LOCK_ERROR cart row lock contention, lock held 3.1s (x87)",
	},
	{
		delayMs: 6000,
		tag: "alert",
		text: "alert: checkout error rate 7.8% — paging the on-call: recommend whether to restart all pods",
	},
]

export interface ScenarioHooks {
	/** Every rendered row, exactly as the CLI would print it. */
	onLine?: (line: string) => void
	/** Human decision bridge; resolves with the raw answer ("y"/"n"/…). */
	askHuman?: (prompt: string) => Promise<string>
}

export interface ScenarioOptions {
	interactive?: boolean
	reportPath?: string
}

export interface ScenarioResult {
	signatures: number
	findings: number
	challenges: number
}

function cliAsk(prompt: string): Promise<string> {
	const { createInterface } = require("node:readline") as typeof import("node:readline")
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	return new Promise((resolve) =>
		rl.question(prompt, (answer) => {
			rl.close()
			resolve(answer)
		}),
	)
}

export function runScenario(options: ScenarioOptions = {}, hooks: ScenarioHooks = {}): Promise<ScenarioResult> {
	return new Promise((resolve) => {
		const say = hooks.onLine ?? ((line: string) => console.log(line))
		const environment = new AgenticEnvironment()
		// LLM mode engages when a real model credential is present. Gemini is
		// the exception: Mozaik's Gemini endpoint reads GEMINI_API_KEY, not
		// OPENAI_API_KEY, so either variable qualifies.
		const llm = Boolean(process.env.OPENAI_API_KEY ?? process.env.GEMINI_API_KEY)

		const feed = new IncidentFeed(environment, timeline)
		const triage = new TriageAgent(environment, llm)
		const sleuth = new LogSleuth(environment, llm)
		// Signatures tracked by counting bus rows tagged [sleuth] (works for
		// both engines since every publication carries the tag).
		const sigCounter = { count: 0 }
		const commander = new RiskCommander(environment)
		const scribe = new IncidentScribe(
			() => {
				sigCounter.count++
			},
			say,
		)
		const comms = new CommsAgent(environment, llm)
		// Human participant: escalations pause for a REAL answer only when
		// interactive (stdin in CLI mode, Approve/Reject buttons in web mode);
		// otherwise auto-decide so demos/CI never hang.
		const oncall = new OnCallEngineer(
			environment,
			options.interactive ?? false,
			hooks.askHuman ?? cliAsk,
		)
		// The late joiner: NOT on the original roster. Joins mid-scenario,
		// right after the lock-contention log lands — see joinHealerAt.
		const healer = new DatabaseHealer(environment)
		// Lock-contention log row index (0-based): the [log] CHECKOUT_LOCK_ERROR
		// timeline entry. The healer joins after this row publishes.
		const joinHealerAt = 4

		feed.join(environment)
		triage.join(environment)
		sleuth.join(environment)
		commander.join(environment)
		scribe.join(environment)
		comms.join(environment)
		oncall.join(environment)

		// Runtime participant discovery: every agent greets the stranger when
		// it appears (onParticipantJoined), the healer announces capabilities
		// (onJoined) — and the commander expands its listen scope so it can
		// intercept even the newcomer's proposals. Pure bus dynamics: no
		// coordinator, no restart, no changes to any original agent's wiring.
		setTimeout(() => {
			healer.join(environment)
			commander.admitListener(DatabaseHealer)
			say(`  [roster] DatabaseHealer joined mid-incident — room notified via onParticipantJoined`)
		}, timeline.slice(0, joinHealerAt + 1).reduce((acc, e) => acc + e.delayMs, 0) + 300)

		say(`=== OpsRoom — concurrent incident response${llm ? " (LLM mode)" : " (deterministic demo)"} ===\n`)
		feed.replay()

		// Scenario length: sum of delays + tail; then comms synthesis → report.
		const totalMs = timeline.reduce((acc, e) => acc + e.delayMs, 0) + 8000
		setTimeout(() => {
			comms.finish()
			// Real-hardware data point: an 8B behind several queued inferences
			// on one Ollama endpoint needed >60s to synthesize. 120s keeps the
			// summary correct on slow machines; fast ones never hit the cap.
			const deadline = Date.now() + 120_000
			const poll = setInterval(() => {
				if (comms.published || Date.now() > deadline) {
					clearInterval(poll)
					scribe.writeReport(options.reportPath ?? "incident-timeline.md")
					const result: ScenarioResult = {
						signatures: sigCounter.count,
						findings: triage.findings.length,
						challenges: commander.challenges.length,
					}
					resolve(result)
				}
			}, 500)
		}, totalMs)
	})
}
