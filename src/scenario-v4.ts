import "dotenv/config"
import { SemanticEvent } from "@mozaik-ai/core"
import { initializeRuntime, join, leave, OpsRoomState, sendMessage } from "./runtime-v4"
import { createIncidentFeed, type FeedEvent } from "./incident-feed-v4"
import { createTriageAgent } from "./triage-agent-v4"
import { createLogSleuth } from "./log-sleuth-v4"
import { createRiskCommander } from "./risk-commander-v4"
import { createIncidentScribe } from "./incident-scribe-v4"
import { createCommsAgent } from "./comms-agent-v4"
import { createOnCallEngineer } from "./oncall-engineer-v4"
import { createDatabaseHealer } from "./database-healer-v4"
import { createDocsLibrarian } from "./docs-librarian-v4"

/**
 * Shared scenario engine, v4 runtime edition: builds a FRESH runtime + all
 * participants and replays the incident once. Behavior contract is identical
 * to the v3 scenario (tags, error codes, gates) — only the framework wiring
 * changed: AgenticEnvironment → defineRuntime, handler overrides → situation
 * handlers.
 */
const timeline: FeedEvent[] = [
	{ delayMs: 500, tag: "deploy", text: "deploy: orders-api v2.14.3 rolled out to 3/10 pods (canary) — Spring Boot 3 fat jar, Hikari pool 10 conns/pod" },
	{ delayMs: 2500, tag: "alert", text: "alert: actuator http.server.requests p95 4.2s (baseline 210ms) on POST /api/checkout, firing for 2m" },
	{ delayMs: 2000, tag: "log", text: "log: orders-api CheckoutRepository.java:88 SQLTransientConnectionException TIMEOUT_ERROR acquiring Hikari connection, waited 5000ms (x1,204 in 60s)" },
	{ delayMs: 4000, tag: "metric", text: "metric: orders-api HikariPool-1 active 100% (10/10), threads waiting 312 — micrometer gauge hikaricp.connections.pending=312" },
	{ delayMs: 5000, tag: "log", text: "log: orders-api CheckoutService.java:41 PessimisticLockException CHECKOUT_LOCK_ERROR cart row lock contention, lock held 3.1s (x87)" },
	{ delayMs: 6000, tag: "alert", text: "alert: checkout error rate 7.8% — paging the on-call: recommend whether to restart all pods" },
]

export interface ScenarioHooks {
	onLine?: (line: string) => void
	askHuman?: (prompt: string) => Promise<string>
}

export interface ScenarioOptions {
	interactive?: boolean
	reportPath?: string
	killSleuthAt7s?: boolean
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

export function runScenarioV4(options: ScenarioOptions = {}, hooks: ScenarioHooks = {}): Promise<ScenarioResult> {
	return new Promise((resolve) => {
		const say = hooks.onLine ?? ((line: string) => console.log(line))
		initializeRuntime({ state: new OpsRoomState() })
		const llm = Boolean(process.env.OPENAI_API_KEY ?? process.env.GEMINI_API_KEY)

		const feed = createIncidentFeed(timeline)
		const triage = createTriageAgent(llm)
		const sleuth = createLogSleuth(llm)
		const commander = createRiskCommander()
		const sigCounter = { count: 0 }
		const scribe = createIncidentScribe(
			() => {
				sigCounter.count++
			},
			say,
		)
		const comms = createCommsAgent(llm)
		const oncall = createOnCallEngineer(options.interactive ?? false, hooks.askHuman ?? cliAsk)
		const healer = createDatabaseHealer()
		const librarian = createDocsLibrarian(llm)
		const joinHealerAt = 4

		// Roster: original wave joins first; healer + librarian join mid-incident.
		for (const p of [feed.participant, triage.agent, sleuth.agent, commander.agent, scribe.participant, comms.agent, oncall.agent]) {
			join(p)
		}

		setTimeout(() => {
			join(healer.agent)
			join(librarian.agent)
			void librarian.discoverTools()
			say(`  [roster] DatabaseHealer joined mid-incident — room notified via participant.joined`)
			say(`  [roster] DocsLibrarian joined mid-incident — discovering its tools via MCP…`)
		}, timeline.slice(0, joinHealerAt + 1).reduce((acc, e) => acc + e.delayMs, 0) + 300)

		// GOAL PIVOT: typed SemanticEvent, agents that opt in rewrite objectives.
		setTimeout(() => {
			say(`  [goal] incident commander pivot: PRESERVE EVIDENCE first — mitigation proposals must now be evidence-preserving (snapshot/readonly) before any state change`)
			feed.publishGoalUpdate(
				"preserve-evidence",
				"snapshot/readonly evidence capture FIRST; state-changing mitigation only after capture",
			)
		}, timeline.slice(0, joinHealerAt + 1).reduce((acc, e) => acc + e.delayMs, 0) + 4300)

		// GRACEFUL DEPARTURE: healer clocks out once its proposal is on record.
		setTimeout(() => {
			healer.clockOut()
		}, timeline.slice(0, joinHealerAt + 1).reduce((acc, e) => acc + e.delayMs, 0) + 6500)

		// FAULT INJECTION: v4 has no deliverError/onParticipantError surface;
		// the resilience demo simulates the crash by announcing the loss on
		// the bus and leaving the sleuth (same observable room dynamics).
		if (options.killSleuthAt7s) {
			setTimeout(() => {
				say(`  [sleuth] FAULT INJECTED: log pipeline connection reset`)
				sendMessage("[sleuth] FAULT: log analyst crashed — log pipeline connection reset. No further signatures from me.", sleuth.agent.getId())
				leave(sleuth.agent)
				sendMessage("[commander] teammate down: LogSleuth went inactive. Room lost: log analysis — no new error signatures will be confirmed.", commander.agent.getId())
				sendMessage("[commander] ESCALATION @oncall — with LogSleuth inactive the room cannot confirm new evidence. Human judgment required for any further mitigation.", commander.agent.getId())
			}, 7000)
		}

		say(`=== OpsRoom v4 — concurrent incident response${llm ? " (LLM mode)" : " (deterministic demo)"} ===\n`)
		feed.replay()

		const totalMs = timeline.reduce((acc, e) => acc + e.delayMs, 0) + 8000
		setTimeout(() => {
			comms.finish()
			const deadline = Date.now() + 120_000
			const poll = setInterval(() => {
				if (comms.isPublished() || Date.now() > deadline) {
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
