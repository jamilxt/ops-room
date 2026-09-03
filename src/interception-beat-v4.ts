// Demo interception beat: triage tries a state-changing tool call through
// the REAL interceptor (same code path runLoop uses in LLM mode). Two beats
// in the scenario: before evidence -> BLOCKED; after confirmed signatures
// -> ALLOWED. This is the on-screen moment for the guardrail story.
import { type ExecutableTransition } from "@mozaik-ai/core"

export interface RestartAttempt {
	/** What the interceptor turned the call into: "blocked" | "allowed". */
	outcome: "blocked" | "allowed"
}

/**
 * Fire a synthetic-but-real function_call transition through `interceptor`.
 * Uses the same InterceptionHandler.handle() that gates live LLM tool calls,
 * so deterministic-mode behavior and LLM-mode behavior share one audit path.
 */
export async function attemptRestartThroughInterceptor(
	interceptor: ReturnType<typeof import("./incident-interceptor-v4").createIncidentInterceptor>,
	toolName = "restart_canary_pods",
): Promise<RestartAttempt> {
	const transition = {
		nextStateId: "function_call",
		input: { call: { name: toolName, arguments: { pods: "canary", reason: "latency spike" } } },
	} as unknown as ExecutableTransition
	const out = await interceptor.handle(transition)
	return { outcome: (out as { nextStateId: string }).nextStateId === "context_update" ? "blocked" : "allowed" }
}
