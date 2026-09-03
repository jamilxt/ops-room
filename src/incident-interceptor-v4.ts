// IncidentInterceptor v4 — the first *real* framework-level enforcement in
// OpsRoom. Every triage/healer runLoop passes through this InterceptionHandler.
// When the model attempts a function_call (a tool invocation) whose name looks
// state-changing (restart/rollback/migrate/...), the handler audits it against
// the evidence the ROOM has confirmed:
//   - grounded (>=1 confirmed signature): the call passes, noted as ALLOWED
//   - not grounded: the call is BLOCKED and the transition is REWRITTEN into a
//     context_update that redirects the agent to capture readonly evidence
//     first. The dangerous tool call never executes.
// Everything else passes untouched. Emits [interceptor] rows for the demo.
import { type InterceptionHandler, type ExecutableTransition } from "@mozaik-ai/core"

const UNSAFE_VERBS = ["restart", "rollback", "roll_back", "migrate", "delete", "drop", "scale", "flush", "kill"]

export interface InterceptionStats {
	blocked: string[]
	passed: number
}

/**
 * One interceptor per agent loop; `signaturesSeen` is the SHARED confirmed-
 * evidence array (sleuth pushes into it), so the gate reflects room knowledge,
 * not per-agent memory.
 */
export function createIncidentInterceptor(
	agentName: string,
	signaturesSeen: string[],
	onBlocked?: (toolName: string) => void,
): InterceptionHandler & { stats: InterceptionStats } {
	const stats: InterceptionStats = { blocked: [], passed: 0 }

	return {
		stats,
		isSatisfiedBy(transition: ExecutableTransition): boolean {
			// Audit only real actions; context updates and plain inference pass.
			return transition.nextStateId === "function_call"
		},
		async handle(transition: ExecutableTransition): Promise<ExecutableTransition> {
			if (transition.nextStateId !== "function_call") return transition
			const params = transition.input as { call?: { name?: string } }
			const name = params?.call?.name ?? "unknown"
			const lowered = name.toLowerCase()
			const unsafe = UNSAFE_VERBS.some((v) => lowered.includes(v))
			if (!unsafe) {
				stats.passed++
				console.log(`  [interceptor] PASSED  ${agentName} -> ${name}`)
				return transition
			}
			if (signaturesSeen.length > 0) {
				stats.passed++
				console.log(`  [interceptor] ALLOWED ${agentName} -> ${name} (grounded on ${signaturesSeen.length} confirmed signatures)`)
				return transition
			}
			// UNSAFE and ungrounded: rewrite the transition. The function_call
			// never runs; the agent instead receives a redirect instruction.
			stats.blocked.push(name)
			console.log(`  [interceptor] ⚠ BLOCKED ${agentName} -> ${name} — no confirmed evidence; redirecting to readonly capture`)
			onBlocked?.(name)
			return {
				nextStateId: "context_update",
				input: {
					content: `[interceptor] ${name} was blocked: no confirmed error signatures ground it yet. Capture readonly evidence first (logs, metrics, lock stats) and re-propose.`,
					input: (transition.input as { inferenceInput?: unknown }).inferenceInput,
				},
			} as unknown as ExecutableTransition
		},
	}
}
