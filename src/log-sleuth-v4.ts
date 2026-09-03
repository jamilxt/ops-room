import { SituationSpecification, createAgent, type Agent, type SituationContext, type SituationHandler } from "@mozaik-ai/core"
import { sendMessage, runLoop, whenMessageFrom, processorFor, eventProcessorFor } from "./runtime-v4"
import { defaultModelName } from "./model-default.js"
import { searchFixture } from "./fixture-search"

/**
 * LogSleuth v4 — the log analyst.
 *
 * Evidence beats are GUARANTEED; tool use is BONUS DEPTH (same contract as
 * the v3 agent). v4 notes:
 * - The whole agent is config: createAgent + situation handlers.
 * - The v3 tool loop relied on onFunctionCall / onFunctionCallOutput handler
 *   overrides. v4's runLoop executes the tool loop internally via the
 *   runtime's FunctionCallRunner (tools are passed on InferenceInput), so
 *   the pending-call bookkeeping disappears — the loop publishes
 *   function_call.* and model.answer events on the bus instead.
 */
export function createLogSleuth(llm: boolean) {
	const seenEvents = new Set<string>()
	const publishedSignatures = new Set<string>()
	const model = defaultModelName()

	const handlers: SituationHandler[] = [
		{
			specification: whenMessageFrom((message) => message.startsWith("[alert]") || message.startsWith("[log]")),
			processor: processorFor((message, participant) => {
				if (seenEvents.has(message)) return
				seenEvents.add(message)

				// GUARANTEED PATH: grep fixtures directly — instant, offline, no model.
				for (const file of ["orders-api.log", "checkout.log"]) {
					const out = searchFixture(file, "_ERROR")
					const first = out.split("\n")[1]
					if (!first) {
						const key = `missing:${file}`
						if (!publishedSignatures.has(key)) {
							publishedSignatures.add(key)
							sendMessage(`[sleuth] WARNING: no evidence available in ${file} (fixture missing or empty)`, participant.getId())
						}
						continue
					}
					const key = /\b(\w+_ERROR)\b/.exec(first)?.[1]
					if (!key || publishedSignatures.has(key)) continue
					publishedSignatures.add(key)
					sendMessage(`[sleuth] error signature: ${first.trim()}`, participant.getId())
				}

				// BONUS PATH (LLM mode): runLoop owns the function-calling loop;
				// model.answer lands as a bus event handled below.
				if (!llm) return
				runLoop((participant as Agent).getId(), message, {
					model,
					context: (participant as Agent).getMemory().getContext(),
					tools: sleuthTools,
				})
			}),
		},
		{
			// Publish the model's grounded signature line (its own answer:
			// producerId === our id on the model.answer event).
			specification: new (class extends SituationSpecification {
				isSatisfiedBy({ event, participant }: SituationContext): boolean {
					return event.type === "model.answer" && event.producerId === participant.getId()
				}
			})(),
			processor: eventProcessorFor((event, participant) => {
				const answer = (event.payload as { answer?: { content?: { text?: string } } })?.answer
				const raw = answer?.content?.text?.trim()
				if (!raw) return
				const text = /^error signature:/m.test(raw) ? raw : (raw.match(/error signature:[^\n]*/)?.[0] ?? null)
				if (!text) return
				const body = text.split("\n")[0].replace(/^\[sleuth\]\s*/, "")
				const key = /\b(\w+_ERROR)\b/.exec(body)?.[1]
				if (!key || publishedSignatures.has(key)) return
				publishedSignatures.add(key)
				sendMessage(`[sleuth] ${body}`, participant.getId())
			}),
		},
	]

	const agent = createAgent({
		name: "LogSleuth",
		capabilities: ["inference"],
		instruction: `You are the log analyst in a live incident war room. You NEVER guess: before claiming anything you MUST call search_logs against the service log files (orders-api.log, checkout.log) to confirm which errors actually appear, using likely error-class keywords. After reading results, reply with EXACTLY one line in this format and nothing else:
error signature: <path/from/log/line> <ERROR_CODE> — <one-clause observation>`,
		tools: sleuthTools,
		handlers,
	})

	return { agent }
}

export const sleuthTools = [
	{
		type: "function" as const,
		name: "search_logs",
		description:
			"Search a service log file for lines containing a keyword (an error class like TIMEOUT_ERROR or CHECKOUT_LOCK_ERROR). Returns matching lines with counts.",
		parameters: {
			type: "object",
			properties: {
				file: { type: "string", description: "Log file name, e.g. orders-api.log" },
				pattern: { type: "string", description: "Keyword to search for, e.g. TIMEOUT_ERROR" },
			},
			required: ["file", "pattern"],
		},
		strict: true,
		invoke: async (args: { file: string; pattern: string }) => searchFixture(args.file, args.pattern),
	},
]
