import fs from "node:fs"
import path from "node:path"
import { AgenticEnvironment, AgenticError, BaseParticipant, DeveloperMessageItem, executeFunctionCall, FunctionCallItem, FunctionCallOutputItem, ModelContext, ModelMessageItem, UserMessageItem, runInference, sendMessage, type ModelName, type Tool } from "@mozaik-ai/core"

/**
 * LogSleuth — the log analyst.
 *
 * Evidence beats are GUARANTEED; tool use is BONUS DEPTH:
 *   1. On every triggering telemetry row the sleuth greps the fixture logs
 *      itself and publishes the signature immediately — same code the tool
 *      runs. The room never waits on a model for ground truth.
 *   2. In LLM mode it ALSO plays the Mozaik function-calling game: qwen3:8b
 *      decides to call search_logs, reads the output, and publishes its own
 *      grounded conclusion. Two independent confirmations of the same fact,
 *      exactly like a human analyst re-checking an alert by hand.
 *   - Deterministic mode (no OPENAI_API_KEY): path 1 only.
 */

// Demo fixtures live here; only files inside are searchable.
const FIXTURE_DIR = path.resolve("fixtures")
const registryName = process.env.LLM_MODEL ?? "deepseek-v4-flash"

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
	private readonly publishedSignatures = new Set<string>()

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly llm: boolean,
	) {
		super()
		this.context.addContextItem(DeveloperMessageItem.create(DEVELOPER_PROMPT))
	}

	// A thrown handler would mark this participant INACTIVE (framework rule:
	// docs/error-handling) — the sleuth would silently stop receiving events
	// while the room continues. Announce failures on the bus instead, so a
	// dead analyst is a loud fact, never a silent gap.
	onError(error: AgenticError): void {
		sendMessage(this.environment, `[sleuth] WARNING: log analyst hit an error and went silent — ${error.message}`, this)
	}

	async onMessage(message: string): Promise<void> {
		// React to live telemetry (alerts + raw logs), never twice to the same row.
		const reacts = message.startsWith("[alert]") || message.startsWith("[log]")
		if (!reacts || this.seenEvents.has(message)) return
		this.seenEvents.add(message)

		// GUARANTEED PATH: grep fixtures directly — instant, offline, no model.
		// A missing/empty fixture is announced on the bus, never silent:
		// .gitignore (*.log) once swallowed these files and every clone's
		// sleuth starved invisibly — real-Mac lesson from the Sept 5 prep.
		for (const file of ["orders-api.log", "checkout.log"]) {
			const out = searchFixture(file, "_ERROR")
			const first = out.split("\n")[1]
			if (!first) {
				const key = `missing:${file}`
				if (!this.publishedSignatures.has(key)) {
					this.publishedSignatures.add(key)
					sendMessage(this.environment, `[sleuth] WARNING: no evidence available in ${file} (fixture missing or empty)`, this)
				}
				continue
			}
			const key = /\b(\w+_ERROR)\b/.exec(first)?.[1]
			if (!key || this.publishedSignatures.has(key)) continue
			this.publishedSignatures.add(key)
			sendMessage(this.environment, `[sleuth] error signature: ${first.trim()}`, this)
		}

		// BONUS PATH (LLM mode): let the model earn its own confirmation via
		// the function-calling loop. Nice-to-have depth, never a dependency.
		if (!this.llm) return
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
		if (!tool) throw new Error(`unknown tool: ${item.name} (model hallucinated a tool name)`)
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
		// Keep strict-format publications only; relax if the model prefixes.
		const raw = item.content.text?.trim()
		if (!raw) return
		const text = /^error signature:/m.test(raw) ? raw : (raw.match(/error signature:[^\n]*/)?.[0] ?? null)
		if (!text) return
		const body = text.split("\n")[0].replace(/^\[sleuth\]\s*/, "")
		const key = /\b(\w+_ERROR)\b/.exec(body)?.[1]
		if (!key || this.publishedSignatures.has(key)) return
		this.publishedSignatures.add(key)
		sendMessage(this.environment, `[sleuth] ${body}`, this)
	}
}
