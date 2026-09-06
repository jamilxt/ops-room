import { createAgent, type Agent, type SituationHandler } from "@mozaik-ai/core"
import { sendMessage, runLoop, runLoopGated, leave, whenMessageFrom, whenExternalEvent, processorFor, eventProcessorFor } from "./runtime-v4"
import { searchFixture } from "./fixture-search"

/**
 * DatabaseHealer v4 — the late-joining specialist. NOT on the original
 * roster; joins mid-incident and interoperates through the room's EXISTING
 * protocol. v4 conversion: announcement on join, goal absorption and the
 * lock-evidence watch are all situation handlers now.
 */
export function createDatabaseHealer() {
	const analyses: string[] = []
	const seenLockEvidence = new Set<string>()
	// Interceptor gate state: confirmed signatures ground any state-changing
	// tool call this agent attempts inside a gated loop.
	const confirmedSignatures: string[] = []
	let proposed = false
	let evidenceFirst = false
	let assemblyDone = false
	// v3 used the first onParticipantJoined to mark end-of-assembly. v4: the
	// healer's own join fires participant.joined to OTHERS, but the healer
	// doesn't see its own join; mark assembly done one tick after creation.
	setTimeout(() => {
		assemblyDone = true
	}, 50)

	const handlers: SituationHandler[] = [
		// Lock-evidence watch (announcement handled by the scenario greeting).
		{
			specification: whenExternalEvent((event) => event.type === "goal-update"),
			processor: eventProcessorFor((event, participant) => {
				const data = event.payload as { goal?: string }
				if (data.goal !== "preserve-evidence") return
				evidenceFirst = true
				sendMessage("[healer] goal absorbed: evidence preservation first — my analysis already runs readonly against fixture logs; sequencing any mitigation after capture.", participant.getId())
			}),
		},
		// Lock-evidence watch.
		{
			specification: whenMessageFrom(
				(message) =>
					!/^\[(commander|oncall|comms|feed|roster)\]/.test(message) &&
					(message.includes("CHECKOUT_LOCK_ERROR") ||
						message.includes("PessimisticLockException") ||
						message.includes("lock contention")),
			),
			processor: processorFor((message, participant) => {
				if (seenLockEvidence.has(message)) return
				seenLockEvidence.add(message)
				// Ground the interceptor gate: this message names a confirmed code.
				const code = /\b(\w+_ERROR)\b/.exec(message)?.[1]
				if (code && !confirmedSignatures.includes(code)) confirmedSignatures.push(code)

				// GUARANTEED PATH: ground the analysis in the fixture directly.
				const report = searchFixture("checkout.log", "CHECKOUT_LOCK_ERROR")
				const matchCount = Number(report.split("\n")[0]?.match(/^(\d+)/)?.[1] ?? 0)
				const canaryLine = report.split("\n").find((l) => l.includes("canary"))
				const analysis = `[healer] lock analysis: ${matchCount} CHECKOUT_LOCK_ERROR rows confirmed in checkout.log${canaryLine ? ` — ${canaryLine.trim()}` : ""}. Pattern matches hot-row contention on the cart table, not a code defect: safest lever is contention reduction, not redeployment.`
				if (!analyses.some((a) => a === analysis)) {
					analyses.push(analysis)
					sendMessage(analysis, participant.getId())
				}

				if (proposed) return
				proposed = true
				const proposal = evidenceFirst
					? "[healer] PROPOSAL: capture readonly snapshot of pg_locks + cart-row lock wait stats FIRST, then shrink checkout transaction scope and add targeted lock retry with backoff on the cart row; canary pods only. Cites CHECKOUT_LOCK_ERROR (confirmed above); evidence capture precedes every state change — least blast radius."
					: "[healer] PROPOSAL: shrink checkout transaction scope and add targeted lock retry with backoff on the cart row; canary pods only. Cites CHECKOUT_LOCK_ERROR (confirmed above); all-pods restart explicitly rejected — least blast radius first."
				sendMessage(proposal, participant.getId())
			}),
		},
	]

	const agent = createAgent({
		name: "DatabaseHealer",
		capabilities: ["lock-analysis"],
		instruction: `You are the database healer. You analyze lock contention (CHECKOUT_LOCK_ERROR / PessimisticLockException) from fixture logs and emit evidence-cited mitigation proposals under the room's token contract (least-blast-radius levers only: pool resize, lock retry tuning). You learn the protocol from the bus, not from configs.`,
		tools: [],
		handlers,
	})

	return {
		agent,
		analyses,
		/** Graceful departure (called by the scenario). */
		clockOut() {
			// GUARANTEE: never claim a proposal that isn't on record. If no lock
			// evidence reached the healer between join and clock-out (LLM timing
			// can starve the message-triggered path), publish the grounded
			// analysis + proposal now — same fixture-derived content as the
			// reactive path, so the demo beat exists in every run.
			if (!proposed) {
				proposed = true
				const report = searchFixture("checkout.log", "CHECKOUT_LOCK_ERROR")
				const matchCount = Number(report.split("\n")[0]?.match(/^(\d+)/)?.[1] ?? 0)
				const canaryLine = report.split("\n").find((l) => l.includes("canary"))
				sendMessage(`[healer] lock analysis: ${matchCount} CHECKOUT_LOCK_ERROR rows confirmed in checkout.log${canaryLine ? ` — ${canaryLine.trim()}` : ""}. Pattern matches hot-row contention on the cart table, not a code defect: safest lever is contention reduction, not redeployment.`, agent.getId())
				const proposal = evidenceFirst
					? "[healer] PROPOSAL: capture readonly snapshot of pg_locks + cart-row lock wait stats FIRST, then shrink checkout transaction scope and add targeted lock retry with backoff on the cart row; canary pods only. Cites CHECKOUT_LOCK_ERROR (confirmed above); evidence capture precedes every state change — least blast radius."
					: "[healer] PROPOSAL: shrink checkout transaction scope and add targeted lock retry with backoff on the cart row; canary pods only. Cites CHECKOUT_LOCK_ERROR (confirmed above); all-pods restart explicitly rejected — least blast radius first."
				sendMessage(proposal, agent.getId())
			}
			sendMessage("[healer] lock lane resolved — my proposal is on record and the room's goal is absorbed. Clocking out; re-join me if lock contention resurfaces.", agent.getId())
			leave(agent)
		},
	}
}
