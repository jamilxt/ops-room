import { SituationSpecification, UserMessageItem, createAgent, type Agent, type SituationContext, type SituationHandler } from "@mozaik-ai/core"
import { sendMessage, runLoop, runLoopGated, whenMessageFrom, whenParticipantJoins, whenExternalEvent, processorFor, eventProcessorFor } from "./runtime-v4"
import { defaultModelName } from "./model-default.js"
import { PROPOSAL_SCHEMA, normalizeProposal, renderProposalLine } from "./proposal-protocol"

/**
 * TriageAgent v4. Reacts to alerts and metrics from the feed. In LLM mode it
 * starts real inference loops via runLoop; in deterministic mode it derives a
 * rapid hypothesis locally. Every v3 handler override became a situation
 * handler (spec + processor).
 */
export function createTriageAgent(llm: boolean) {
	const evidence: string[] = []
	// Shared with the interceptor: confirmed error signatures the ROOM has
	// seen. The sleuth's [sleuth] rows land here via the scribe counter, so
	// the interceptor's evidence gate reflects room knowledge, not triage's
	// private memory.
	const confirmedSignatures: string[] = []
	const findings: string[] = []
	let evidenceFirst = false

	const model = defaultModelName()
	// v4 validates features against the model specification BEFORE the API
	// call; deepseek-registry models fail structured-output validation
	// (supportsStructuredOutput: false), so gate the schema on the model.
	const supportsStructured = !model.startsWith("deepseek")

	const handlers: SituationHandler[] = [
		// Late-joiner greeting (roster awareness).
		{
			specification: whenParticipantJoins({ quietForMs: 1000 }),
			processor: eventProcessorFor((_event, participant) => {
				const who = (_event.payload as { name?: string })?.name ?? "stranger"
				sendMessage(`[triage] welcome, ${who} — send me lock analysis via [healer] rows; mitigation proposals stay PROPOSAL:tokened.`, participant.getId())
			}),
		},
		// GOAL UPDATE absorption (typed event).
		{
			specification: whenExternalEvent((event) => event.type === "goal-update"),
			processor: eventProcessorFor((event, participant) => {
				const data = event.payload as { goal?: string; directive?: string }
				if (data.goal !== "preserve-evidence") return
				evidenceFirst = true
				console.log(`  [triage] GOAL UPDATE absorbed: ${data.goal} — proposals now evidence-first`)
				if (llm) {
					;(participant as Agent).getMemory().getContext().addContextItems([
						UserMessageItem.create(`[GOAL UPDATE from incident commander] New priority: ${data.goal}. ${data.directive ?? ""} Every mitigation proposal you emit from now on MUST lead with the evidence-preservation step (snapshot/readonly capture) before any state-changing action. Keep the PROPOSAL:/REVISED PROPOSAL: token contract.`),
					])
				}
			}),
		},
		// The agent's OWN inference output: parse the structured proposal and
		// republish the canonical line onto the bus (v3 onModelMessage).
		{
			specification: new (class extends SituationSpecification {
				isSatisfiedBy({ event, participant }: SituationContext): boolean {
					return event.type === "model.answer" && event.producerId === participant.getId()
				}
			})(),
			processor: eventProcessorFor((event, participant) => {
				const answer = (event.payload as { answer?: { content?: { text?: string } } })?.answer
				const raw = answer?.content?.text?.trim()
				if (!raw) return
				// Structured path: the model replied with the proposal JSON.
				try {
					const parsed = normalizeProposal(JSON.parse(raw))
					if (parsed) {
						sendMessage(renderProposalLine("triage", parsed), participant.getId())
						return
					}
				} catch {
					// not JSON — prose fallback below
				}
				// Prose fallback: relay the model message as-is.
				sendMessage(`[triage] ${raw.split("\n")[0].slice(0, 400)}`, participant.getId())
			}),
		},
		// Room messages: evidence / challenges / telemetry.
		{
			specification: whenMessageFrom(() => true),
			processor: processorFor((message, participant) => {
				const agent = participant as Agent
				const ctx = agent.getMemory().getContext()

				if (message.startsWith("[sleuth]")) {
					evidence.push(message)
					// Feed the interceptor's evidence gate: the /\b(\w+_ERROR)\b/
					// code in the signature line is what makes tool calls grounded.
					const code = /\b(\w+_ERROR)\b/.exec(message)?.[1]
					if (code && !confirmedSignatures.includes(code)) confirmedSignatures.push(code)
					console.log(`  [triage] evidence received: ${message.slice(0, 60)}…`)
					return
				}

				if (message.startsWith("[commander]")) {
					if (!message.includes("@triage")) return
					console.log(`  [triage] challenge received — revising proposal`)
					if (!llm) {
						sendMessage(`[triage] REVISED PROPOSAL: capture readonly snapshot of canary pod thread dumps + Hikari gauges grounding CHECKOUT_LOCK_ERROR, then roll back the 3 canary instances only; all-pods restart stays off the table`, participant.getId())
						return
					}
					ctx.addContextItems([UserMessageItem.create(message)])
					runLoopGated(agent.getId(), message, {
						model,
						context: ctx,
						...(supportsStructured ? { structuredOutput: PROPOSAL_SCHEMA } : {}),
						streaming: false,
					}, confirmedSignatures)
					return
				}

				if (!message.startsWith("[alert]") && !message.startsWith("[metric]")) return
				console.log(`  [triage] picked up: ${message.slice(0, 70)}…`)
				findings.push(message)

				if (llm) {
					if (evidence.length > 0) {
						ctx.addContextItems([UserMessageItem.create(`[evidence from log analyst]\n${evidence.join("\n")}`)])
						evidence.length = 0
					}
					ctx.addContextItems([UserMessageItem.create(message)])
					runLoopGated(agent.getId(), message, {
						model,
						context: ctx,
						...(supportsStructured ? { structuredOutput: PROPOSAL_SCHEMA } : {}),
						streaming: false,
					}, confirmedSignatures)
					return
				}

				// Deterministic demo mode: evidence-first after pivot.
				if (evidenceFirst) {
					sendMessage(`[triage] capturing readonly snapshot of canary pod thread dumps + Hikari connection gauges — evidence FIRST`, participant.getId())
					sendMessage(`[triage] PROPOSAL: capture readonly snapshot of canary pod thread dumps + Hikari gauges grounding CHECKOUT_LOCK_ERROR, then roll back the 3 canary instances only; all-pods restart stays off the table`, participant.getId())
					return
				}
				const hypothesis = "HYPOTHESIS: checkout latency spike correlated with canary rollout of orders-api — likely connection-pool exhaustion"
				sendMessage(`[triage] ${hypothesis}`, participant.getId())
			}),
		},
	]

	const agent = createAgent({
		name: "TriageAgent",
		capabilities: ["inference"],
		instruction: `You are the triage specialist in a live incident war room. Telemetry arrives in real time; other agents (log analyst, database healer, risk commander) are working the same incident in parallel.
Output contract: ALWAYS reply with the proposal JSON object (schema provided). Field rules:
- kind: "HYPOTHESIS" when you only report an observation; "PROPOSAL" for a new mitigation; "REVISED PROPOSAL" when answering a HOLD.
- rootCause: one clause, naming the specific service/metric/error.
- action: exactly one concrete sentence. Never generic advice.
- blastRadius: "readonly" (captures evidence, changes nothing), "targeted" (specific pods/rows/paths), or "broad" (fleet-wide restarts, migrations — these WILL be challenged).
- cites: error-code signatures grounding the mitigation (e.g. ["CHECKOUT_LOCK_ERROR"]). Empty ONLY for HYPOTHESIS; mitigation proposals without cites are held by the risk commander.
- evidenceFirst: true when the action captures readonly evidence before any state change.
- If your last proposal was challenged (HOLD), offer the least-blast-radius mitigation against the confirmed signatures.
- Never use the word "restart" or "rollback" outside a proposal's action field.`,
		tools: [],
		handlers,
	})

	return { agent, findings }
}
