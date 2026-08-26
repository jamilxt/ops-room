import fs from "node:fs"
import path from "node:path"
import { AgenticEnvironment, BaseParticipant, DeveloperMessageItem, executeFunctionCall, FunctionCallItem, FunctionCallOutputItem, ModelContext, ModelMessageItem, UserMessageItem, runInference, sendMessage, type ModelName, type Tool } from "@mozaik-ai/core"

/**
 * LogSleuth — the log analyst.
 *
 * Unlike its teammates, the sleuth doesn't guess: it earns every claim by
 * calling the search_logs TOOL against real fixture log files through
 * Mozaik's function-calling loop (the framework's tool-use surface — see
 * docs.jigjoy.ai "Tools"). Same agent, two engines:
 *   - LLM mode: the model decides to call search_logs, reads the output,
 *     then publishes "error signature: ..." on the bus.
 *   - Deterministic mode (no OPENAI_BASE_URL/key): greps fixtures itself.
 */

// Demo fixtures live here; only files inside are searchable.
const FIXTURE_DIR = path.resolve("fixtures")
const registryName = "deepseek-v4-flash"

/** Shared grep over fixtures/. Returns a match-count report. */
function searchFixture(file: string, pattern: string): string {
	const safe = path.basename(file) // flatten any traversal attempt
	const full = path.join(FIXTURE_DIR, safe)
	if (!fs.existsSync(full)) return `no such log file: ${file}`
	const hits = fs
		.readFileSync(full, "utf8")
		.split("\n")
		.filter((l) => l.toLowerCase().includes(pattern.toLowerCase()))
	return hits.length === 0
		? `0 matches for "${pattern}" in ${file}`
		: `${hits.length} match(es) for "${pattern}" in ${file}:\n${hits.join("\n")}`
}

export const sleuthTools: Tool[] = [
	{
		type: "function",
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

const DEVELOPER_PROMPT = `You are the log analyst in a live incident war room. You NEVER guess: before claiming anything you MUST call search_logs against the service log files (orders-api.log, checkout.log) to confirm which errors actually appear, using likely error-class keywords. After reading results, reply with EXACTLY one line in this format and nothing else:
error signature: <path/from/log/line> <ERROR_CODE> — <one-clause observation>`

export class LogSleuth extends BaseParticipant {
	private readonly context = ModelContext.create("sleuth")
	private readonly pendingCalls = new Set<string>()
	private readonly seenEvents = new Set<string>()
	private readonly published = new Set<string>()

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly llm: boolean,
	) {
		super()
		this.context.addContextItem(DeveloperMessageItem.create(DEVELOPER_PROMPT))
	}

	async onMessage(message: string): Promise<void> {
		// React to live telemetry (alerts + raw logs), never twice to the same row.
		const reacts = message.startsWith("[alert]") || message.startsWith("[log]")
		if (!reacts || this.seenEvents.has(message)) return
		this.seenEvents.add(message)

		if (!this.llm) {
			// Deterministic demo: same grep the tool runs, published directly —
			// once per distinct signature, not once per triggering event.
			for (const file of ["orders-api.log", "checkout.log"]) {
				const out = searchFixture(file, "_ERROR")
				const first = out.split("\n")[1]
				if (!first) continue
				const code = /\b(\w+_ERROR)\b/.exec(first)?.[1]
				const key = `${file}:${code}`
				if (!code || this.published.has(key)) continue
				this.published.add(key)
				sendMessage(this.environment, `[sleuth] error signature: ${first.trim()}`, this)
			}
			return
		}

		this.context.addContextItem(UserMessageItem.create(message))
		runInference({
			model: registryName as ModelName,
			context: this.context,
			tools: sleuthTools,
			environment: this.environment,
			caller: this,
		})
	}

	async onFunctionCall(item: FunctionCallItem): Promise<void> {
		// The model asked for evidence — serve it and remember the debt.
		this.pendingCalls.add(item.callId)
		this.context.addContextItem(item)
		const tool = sleuthTools.find((t) => t.name === item.name)
		if (!tool) throw new Error(`unknown tool: ${item.name}`)
		executeFunctionCall(this.environment, item, tool, this)
	}

	async onFunctionCallOutput(item: FunctionCallOutputItem): Promise<void> {
		// Evidence delivered — once every call is served, send the model back
		// in to write the grounded signature line.
		this.context.addContextItem(item)
		this.pendingCalls.delete(item.callId)
		if (this.pendingCalls.size === 0) {
			runInference({
				model: registryName as ModelName,
				context: this.context,
				tools: sleuthTools,
				environment: this.environment,
				caller: this,
			})
		}
	}

	async onModelMessage(item: ModelMessageItem): Promise<void> {
		const text = item.content.text?.trim()
		if (!text || !text.startsWith("error signature")) return
		sendMessage(this.environment, `[sleuth] ${text}`, this)
	}
}
