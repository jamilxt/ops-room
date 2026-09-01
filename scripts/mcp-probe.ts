import { McpClient } from "@mozaik-ai/core"

/**
 * Connectivity probe: can this VPS reach free no-auth MCP servers, and do
 * they work through Mozaik's own McpClient? Run: npx tsx scripts/mcp-probe.ts
 */
const CANDIDATES = [
	{ name: "deepwiki", url: "https://mcp.deepwiki.com/mcp" },
	{ name: "gitmcp-mozaik", url: "https://gitmcp.io/jigjoy-ai/mozaik" },
	{ name: "x-docs", url: "https://docs.x.com/mcp" },
]

async function probe(c: { name: string; url: string }): Promise<void> {
	const client = new McpClient({ url: c.url, name: "opsroom-probe" })
	const started = Date.now()
	try {
		await Promise.race([
			client.connect(),
			new Promise((_, rej) => setTimeout(() => rej(new Error("connect timeout 15s")), 15_000)),
		])
		const tools = await client.listTools()
		const names = tools.map((t) => t.name).slice(0, 8)
		console.log(`[OK] ${c.name} (${Date.now() - started}ms) tools[${tools.length}]: ${names.join(", ")}`)
		// If the server exposes a doc/QA tool, fire one real call as proof.
		const qa = tools.find((t) => /ask|question|search|fetch|read/i.test(t.name))
		if (qa) {
			const argGuess = qa.name.includes("deep_wiki") || /question/i.test(qa.name)
				? { repoName: "jigjoy-ai/mozaik", question: "What is an AgenticEnvironment in one sentence?" }
				: qa.inputSchema && "properties" in (qa.inputSchema as object) && "url" in (qa.inputSchema as any).properties
					? { url: "https://github.com/jigjoy-ai/mozaik" }
					: { query: "agentic environment", repoName: "jigjoy-ai/mozaik" }
			try {
				const out = await Promise.race([
					client.callTool(qa.name, argGuess),
					new Promise((_, rej) => setTimeout(() => rej(new Error("call timeout 20s")), 20_000)),
				])
				console.log(`[CALL] ${c.name}.${qa.name} -> ${String(out).slice(0, 220).replace(/\n/g, " ")}`)
			} catch (e) {
				console.log(`[CALL-FAIL] ${c.name}.${qa.name}: ${(e as Error).message}`)
			}
		}
		await client.close().catch(() => {})
	} catch (e) {
		console.log(`[FAIL] ${c.name}: ${(e as Error).message}`)
	}
}

const targets = process.argv[2] ? CANDIDATES.filter((c) => c.name === process.argv[2]) : CANDIDATES
for (const c of targets) await probe(c)
