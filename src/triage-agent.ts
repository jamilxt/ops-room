import {
	AgenticEnvironment,
	AgenticError,
	BaseParticipant,
	DeveloperMessageItem,
	ModelContext,
	ModelMessageItem,
	UserMessageItem,
	runInference,
	sendMessage,
	type ModelName,
} from "@mozaik-ai/core"
import type { IncidentFeed } from "./incident-feed"
import { defaultModelName } from "./model-default.js"

/**
 * TriageAgent reacts to alerts and metrics from the feed.
 * When an LLM key is configured it streams real inference; in deterministic
 * demo mode it derives a rapid hypothesis locally. Either way it never blocks
 * the environment — everything it does is fire-and-forget onto the bus.
 */
export class TriageAgent extends BaseParticipant {
	private readonly context = ModelContext.create("triage")
	private readonly evidence: string[] = []
	readonly findings: string[] = []

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly llm: boolean,
	) {
		super()
		// Role + format contract: short, incident-specific, ends with one action.
		this.context.addContextItem(
			DeveloperMessageItem.create(
				`You are the triage specialist in a live incident war room. Telemetry arrives in real time; other agents (log analyst, risk commander) are working the same incident in parallel.
Rules:
- Reply in at most 3 short sentences. No markdown, no headings, no lists.
- Name the most likely root cause, referencing the specific service/metric/error you were given.
- When you propose a mitigation, you MUST start that sentence with "PROPOSAL:" — this is a protocol token, the risk commander intercepts on it. Never use the word "restart" or "rollback" anywhere else.
- End with exactly one concrete next action, prefixed "ACTION:".
- If you receive a message containing "HOLD", your last proposal was challenged: reply with exactly one new sentence starting "REVISED PROPOSAL:" offering the least-blast-radius mitigation for the confirmed signatures (canary rollback, pool resize, or targeted lock retry — never all-pods).
- Never give generic advice or explain what a metric means — the room already knows.`,
			),
		)
	}

	// Framework rule: a handler that throws marks the participant inactive —
	// triage would silently vanish from the room mid-incident. Make it loud.
	onError(error: AgenticError): void {
		sendMessage(this.environment, `[triage] WARNING: triage specialist hit an error and went silent — ${error.message}`, this)
	}

	/**
	 * Runtime roster awareness: greet a late-joining agent and record its
	 * arrival in the LLM context so future inferences know the room grew.
	 * Guard: joins within the first second are the INITIAL assembly, not
	 * runtime arrivals — stay quiet (and keep inference context clean).
	 */
	async onParticipantJoined(participant: import("@mozaik-ai/core").Participant): Promise<void> {
		if (Date.now() - this.bornAt < 1000) return
		sendMessage(this.environment, `[triage] welcome, ${participant.constructor.name} — send me lock analysis via [healer] rows; mitigation proposals stay PROPOSAL:tokened.`, this)
		if (this.llm) {
			this.context.addContextItem(
				UserMessageItem.create(`[roster update] ${participant.constructor.name} joined the room mid-incident.`),
			)
		}
	}

	private readonly bornAt = Date.now()

	/**
	 * ADAPTABILITY TO SYSTEM GOALS: the incident commander's pivot arrives as
	 * a typed SemanticEvent (not chat). Triage rewrites its OWN objectives:
	 * the goal is recorded and injected into the inference context, so every
	 * proposal after the pivot is evidence-first. In deterministic mode the
	 * scripted outputs switch to the snapshot-first variant.
	 * (The feed is the event SOURCE, so agents receive onExternalEvent.)
	 */
	async onExternalEvent(
		_source: import("@mozaik-ai/core").Participant,
		item: import("@mozaik-ai/core").SemanticEvent<unknown>,
	): Promise<void> {
		if (item.getType() !== "goal-update") return
		const data = item.data as { goal?: string; directive?: string }
		if (data.goal !== "preserve-evidence") return
		this.evidenceFirst = true
		this.log(`GOAL UPDATE absorbed: ${data.goal} — proposals now evidence-first`)
		if (this.llm) {
			this.context.addContextItem(
				UserMessageItem.create(
					`[GOAL UPDATE from incident commander] New priority: ${data.goal}. ${data.directive ?? ""} Every mitigation proposal you emit from now on MUST lead with the evidence-preservation step (snapshot/readonly capture) before any state-changing action. Keep the PROPOSAL:/REVISED PROPOSAL: token contract.`,
				),
			)
		}
	}

	private evidenceFirst = false

	async onMessage(message: string): Promise<void> {
		// consuming a teammate's evidence BEFORE re-inferring is the shared-
		// state coordination the environment exists for.
		if (message.startsWith("[sleuth]")) {
			this.evidence.push(message)
			this.log(`evidence received: ${message.slice(0, 60)}…`)
			return
		}
		if (message.startsWith("[commander]")) {
			// Challenges are now addressed ("HOLD @healer — ..."): only react
			// when the HOLD targets triage. Other agents' challenges are not
			// ours to answer (learned when the late joiner got challenged).
			if (!message.includes("@triage")) return
			this.log(`challenge received — revising proposal`)
			// Post-pivot (GOAL: preserve-evidence): the challenge reply flips to
			// evidence-first AND cites the confirmed signature so it passes the
			// commander's gate on merit (the gate applies to everyone, incl.
			// post-pivot triage).
			if (!this.llm) {
				sendMessage(
					this.environment,
					"[triage] REVISED PROPOSAL: capture readonly snapshot of canary pod thread dumps + Hikari gauges grounding CHECKOUT_LOCK_ERROR, then roll back the 3 canary instances only; all-pods restart stays off the table",
					this,
				)
				return
			}
			// LLM path: re-infer with the challenge in context — the negotiation
			// loop, end to end.
			this.context.addContextItem(UserMessageItem.create(message))
			const model = defaultModelName() as ModelName
			runInference({ model, context: this.context, caller: this, environment: this.environment, streaming: false })
			return
		}
		if (!message.startsWith("[alert]") && !message.startsWith("[metric]")) return

		this.log(`picked up: ${message.slice(0, 70)}…`)
		this.findings.push(message)

		if (this.llm) {
			// Fold in any teammate evidence the sleuth has published since the
			// last inference — this is what makes it shared-state coordination
			// rather than two agents working blind side-by-side.
			if (this.evidence.length > 0) {
				this.context.addContextItem(
					UserMessageItem.create(`[evidence from log analyst]\n${this.evidence.join("\n")}`),
				)
				this.evidence.length = 0
			}
			this.context.addContextItem(UserMessageItem.create(message))
			// deepseek-v4-flash routes through the generic OpenAI-compatible
			// endpoint, so OPENAI_BASE_URL can point at Ollama / LM Studio /
			// llama.cpp server — any /v1/chat/completions server works.
			const model = defaultModelName() as ModelName
			runInference({
				model,
				context: this.context,
				caller: this,
				environment: this.environment,
				// Note: Mozaik 3.14's chat-completions *streaming* path yields raw
				// provider chunks and never assembles them into ModelMessageItem /
				// FunctionCallItems, so no handler fires; non-streaming still runs
				// fully concurrent (fire-and-forget) and returns proper context items.
				streaming: process.env.LLM_STREAMING === "true",
			})
			return
		}

		// Deterministic demo hypothesis — arrives slightly "late" to show that
		// the sleuth is working in parallel, not waiting for triage.
		setTimeout(() => {
			const risky = message.includes("recommend whether to restart all pods")
			// Post-pivot (GOAL: preserve-evidence): scripted outputs flip to
			// snapshot-first — visible proof that a typed event changed the
			// agent's objectives, no recompile, no restart.
			if (this.evidenceFirst) {
				const snap = risky
					? "PROPOSAL: capture readonly snapshot of thread dumps, Hikari pool gauges and slow-query log from the canary pods FIRST (grounding CHECKOUT_LOCK_ERROR), then re-propose mitigation citing the captured evidence — no state change before capture"
					: "hypothesis update (evidence-first): capturing readonly heap/thread snapshot from orders-api canary pods to confirm the CHECKOUT_LOCK_ERROR pool-exhaustion hypothesis before touching state"
				sendMessage(this.environment, `[triage] ${snap}`, this)
				this.log("evidence-first recommendation emitted")
				return
			}
			const hypothesis = risky
				? "PROPOSAL: restart ALL orders-api pods immediately to clear the stuck connection pool"
				: message.includes("checkout")
					? "hypothesis: checkout latency correlates with the deploy; suspect connection-pool exhaustion in orders-api"
					: "hypothesis: partial degradation, likely a bad instance behind the load balancer"
			sendMessage(this.environment, `[triage] ${hypothesis}`, this)
			this.log(`${risky ? "recommendation" : "hypothesis"} emitted`)
		}, 900)
	}

	// Relay the model's finished answer back onto the environment so the
	// commander (and the scribe) can react to it — same pattern the human
	// specialist would follow: hear telemetry, think, speak findings aloud.
	async onModelMessage(item: ModelMessageItem): Promise<void> {
		this.context.addContextItem(item)
		const text = item.content.text?.trim()
		if (!text) return
		sendMessage(this.environment, `[triage] ${text}`, this)
	}

	private log(line: string): void {
		console.log(`  [triage] ${line}`)
	}
}
