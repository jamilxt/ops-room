import {
	AgenticEnvironment,
	AgenticError,
	BaseParticipant,
	DeveloperMessageItem,
	executeFunctionCall,
	FunctionCallItem,
	FunctionCallOutputItem,
	ModelContext,
	ModelMessageItem,
	McpToolRegistry,
	UserMessageItem,
	runInference,
	sendMessage,
	type ModelName,
	type Tool,
} from "@mozaik-ai/core"
import { defaultModelName } from "./model-default.js"

/**
 * DocsLibrarian — the MCP showcase.
 *
 * The healer proved PARTICIPANTS can appear at runtime. The librarian proves
 * TOOLS can: its entire toolbox is discovered from remote MCP servers at
 * startup via Mozaik's McpToolRegistry (free, keyless, streamable-HTTP):
 *   - docs.x.com/mcp          → search_x, query_docs_filesystem_x
 *   - mcp.deepwiki.com/mcp    → ask_question, read_wiki_* (public wikis)
 * None of these tools exist in this repo's source. If the network is
 * unreachable, the librarian says so on the bus and stays idle — the room
 * never depends on it (same guarantee pattern as every other agent).
 *
 * Role in the incident: when a failure signature points at a third-party
 * surface (e.g. Hikari/timeouts), the librarian pulls the vendor's OWN
 * documentation into the room — ground truth beyond our fixtures.
 */

const MCP_SERVERS = [
	{ url: "https://docs.x.com/mcp", name: "x-docs" },
	{ url: "https://mcp.deepwiki.com/mcp", name: "deepwiki" },
]

export class DocsLibrarian extends BaseParticipant {
	private readonly context = ModelContext.create("librarian")
	private readonly pendingCalls = new Set<string>()
	private tools: Tool[] = []
	/** Set once MCP discovery resolves (or fails) — gates readiness. */
	private ready = false

	constructor(
		private readonly environment: AgenticEnvironment,
		private readonly llm: boolean,
	) {
		super()
		this.context.addContextItem(
			DeveloperMessageItem.create(
				`You are the documentation librarian in a live incident war room. Your tools query vendor documentation and public wikis. When asked to verify a claim about a technology, call the most relevant tool, read the result, then reply with EXACTLY one line:
[librarian] docs: <claim> — <what the docs say, one clause> (source: <tool name>)
If no tool result supports or refutes the claim, say exactly that — never invent documentation.`,
			),
		)
	}

	/** Discover tools from the remote MCP servers. Called by the scenario after join(). */
	async discoverTools(): Promise<number> {
		const registry = new McpToolRegistry(MCP_SERVERS)
		try {
			this.tools = await Promise.race([
				registry.discoverTools(),
				new Promise<Tool[]>((_, rej) => setTimeout(() => rej(new Error("mcp discovery timeout 20s")), 20_000)),
			])
			this.ready = true
			sendMessage(
				this.environment,
				`[librarian] ready — ${this.tools.length} tools discovered via MCP at runtime (${this.tools.map((t) => t.name).slice(0, 5).join(", ")}${this.tools.length > 5 ? ", …" : ""}). None of these exist in our source code.`,
				this,
			)
			return this.tools.length
		} catch (error) {
			this.ready = false
			sendMessage(
				this.environment,
				`[librarian] WARNING: MCP tool discovery failed (${(error as Error).message}) — running without external docs; the room is not blocked.`,
				this,
			)
			return 0
		}
	}

	async onMessage(message: string): Promise<void> {
		if (!this.ready || !this.llm) return
		// The librarian volunteers only when a claim smells like third-party
		// documentation territory (pools, drivers, timeouts, error classes).
		const relevant = /hikari|jdbc|postgres|mysql|redis|kafka|spring|pessimistic|connection pool|driver/i.test(message)
		if (!relevant) return
		if (this.seenClaims.has(message)) return
		this.seenClaims.add(message)

		// Ask the model to verify the room's implicit claim via MCP tools.
		this.context.addContextItem(
			UserMessageItem.create(`The room is discussing: "${message.slice(0, 300)}". Use your tools to pull authoritative documentation relevant to this failure mode, then report one line.`),
		)
		runInference({
			model: defaultModelName() as ModelName,
			context: this.context,
			tools: this.tools,
			caller: this,
			environment: this.environment,
		})
	}

	private readonly seenClaims = new Set<string>()

	async onFunctionCall(item: FunctionCallItem): Promise<void> {
		this.context.addContextItem(item)
		const tool = this.tools.find((t) => t.name === item.name)
		if (!tool) throw new Error(`unknown tool: ${item.name} (model hallucinated a tool name)`)
		this.pendingCalls.add(item.callId)
		executeFunctionCall(this.environment, item, tool, this)
	}

	async onFunctionCallOutput(item: FunctionCallOutputItem): Promise<void> {
		this.context.addContextItem(item)
		this.pendingCalls.delete(item.callId)
		if (this.pendingCalls.size === 0) {
			runInference({
				model: defaultModelName() as ModelName,
				context: this.context,
				tools: this.tools,
				caller: this,
				environment: this.environment,
			})
		}
	}

	async onModelMessage(item: ModelMessageItem): Promise<void> {
		this.context.addContextItem(item)
		const text = item.content.text?.trim()
		if (!text) return
		// Publish only disciplined one-liners; anything verbose is trimmed.
		const line = text.split("\n")[0].slice(0, 400)
		sendMessage(this.environment, line.startsWith("[librarian]") ? line : `[librarian] docs: ${line}`, this)
	}

	onError(error: AgenticError): void {
		sendMessage(this.environment, `[librarian] WARNING: docs librarian hit an error — ${error.message}`, this)
	}

	/** Clean shutdown of MCP connections (framework hygiene). */
	async shutdown(): Promise<void> {
		this.tools = []
		this.ready = false
	}
}
