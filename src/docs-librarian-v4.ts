import { UserMessageItem, McpToolRegistry, createAgent, type Agent, type SituationHandler, type Tool } from "@mozaik-ai/core"
import { sendMessage, runLoop, whenMessageFrom, processorFor } from "./runtime-v4"
import { defaultModelName } from "./model-default.js"

/**
 * DocsLibrarian v4 — the MCP showcase. Its entire toolbox is discovered from
 * remote MCP servers at startup via McpToolRegistry (free, keyless). v4 keeps
 * McpClient/McpToolRegistry as first-class exports; the tool loop is owned by
 * runLoop, so the v3 onFunctionCall/onFunctionCallOutput bookkeeping is gone.
 */
const MCP_SERVERS = [
	{ url: "https://docs.x.com/mcp", name: "x-docs" },
	{ url: "https://mcp.deepwiki.com/mcp", name: "deepwiki" },
]

export function createDocsLibrarian(llm: boolean) {
	const model = defaultModelName()
	let tools: Tool[] = []
	let ready = false
	const seenClaims = new Set<string>()

	const handlers: SituationHandler[] = [
		{
			specification: whenMessageFrom((message) => {
				if (!ready || !llm) return false
				return /hikari|jdbc|postgres|mysql|redis|kafka|spring|pessimistic|connection pool|driver/i.test(message)
			}),
			processor: processorFor((message, participant) => {
				if (seenClaims.has(message)) return
				seenClaims.add(message)
				const agent = participant as Agent
				agent.getMemory().getContext().addContextItems([
					UserMessageItem.create(`The room is discussing: "${message.slice(0, 300)}". Use your tools to pull authoritative documentation relevant to this failure mode, then report one line.`),
				])
				runLoop(agent.getId(), `verify: ${message.slice(0, 200)}`, {
					model,
					context: agent.getMemory().getContext(),
					tools,
				})
			}),
		},
	]

	const agent = createAgent({
		name: "DocsLibrarian",
		capabilities: ["inference", "mcp"],
		instruction: `You are the documentation librarian in a live incident war room. Your tools query vendor documentation and public wikis. When asked to verify a claim about a technology, call the most relevant tool, read the result, then reply with EXACTLY one line:
[librarian] docs: <claim> — <what the docs say, one clause> (source: <tool name>)
If no tool result supports or refutes the claim, say exactly that — never invent documentation.`,
		tools: [],
		handlers,
	})

	return {
		agent,
		/** Discover tools from the remote MCP servers. Called after join(). */
		async discoverTools(): Promise<number> {
			const registry = new McpToolRegistry(MCP_SERVERS)
			try {
				tools = await Promise.race([
					registry.discoverTools(),
					new Promise<Tool[]>((_, rej) => setTimeout(() => rej(new Error("mcp discovery timeout 20s")), 20_000)),
				])
				ready = true
				sendMessage(
					`[librarian] ready — ${tools.length} tools discovered via MCP at runtime (${tools.map((t) => t.name).slice(0, 5).join(", ")}${tools.length > 5 ? ", …" : ""}). None of these exist in our source code.`,
					agent.getId(),
				)
				return tools.length
			} catch (error) {
				ready = false
				sendMessage(
					`[librarian] WARNING: MCP tool discovery failed (${(error as Error).message}) — running without external docs; the room is not blocked.`,
					agent.getId(),
				)
				return 0
			}
		},
		async shutdown() {
			tools = []
			ready = false
		},
	}
}
