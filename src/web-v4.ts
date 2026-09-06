import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { runScenarioV4 } from "./scenario-v4"
import { PAGE } from "./page-v4"
import { setLineSink } from "./line-tap-v4"

/**
 * Web entrypoint, v4 runtime edition — minimal redesign (see page-v4.ts).
 *
 *   GET  /            → war-room page (light/dark, plain-language story view)
 *   GET  /events      → Server-Sent Events stream (rows, escalation, state, summary)
 *   POST /decision    → {answer:"approve"|"reject"} resolves a pending human pause
 *   POST /run         → starts (or restarts) a fresh incident run
 *   GET  /agents      → roster + telemetry sources for the sidebar
 */
const PORT = Number(process.env.OPSROOM_PORT ?? 8788)

// ---- per-run state ---------------------------------------------------------
let events: ServerResponse[] = []
let busy = false
let startedOnce = false
let pendingDecision: ((answer: string) => void) | null = null

type AgentSpec = { id: string; name: string; role: string; group: string }

const AGENT_INFO: AgentSpec[] = [
	{ id: "deploy", name: "Deploy notice", role: "a new version went out", group: "What happened" },
	{ id: "alert", name: "Alerts", role: "automatic warnings", group: "What happened" },
	{ id: "metric", name: "Metrics", role: "health numbers", group: "What happened" },
	{ id: "log", name: "Raw logs", role: "exactly what the app said", group: "What happened" },
	{ id: "triage", name: "Triage", role: "spots the problem, proposes fixes", group: "The AI specialists" },
	{ id: "sleuth", name: "Log analyst", role: "digs through logs for evidence", group: "The AI specialists" },
	{ id: "healer", name: "Database healer", role: "joins later for database trouble", group: "The AI specialists" },
	{ id: "librarian", name: "Docs librarian", role: "checks official documentation", group: "The AI specialists" },
	{ id: "commander", name: "Risk commander", role: "checks every fix is safe", group: "The referee" },
	{ id: "oncall", name: "On-call (human)", role: "makes the final call", group: "People" },
	{ id: "comms", name: "Comms", role: "writes the status update", group: "Support" },
	{ id: "scribe", name: "Scribe", role: "records everything", group: "Support" },
]

function broadcast(payload: unknown): void {
	for (const res of events) res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

async function startRun(): Promise<void> {
	if (busy) {
		broadcast({ type: "row", line: "[system] previous run still finishing — hold on…" })
		return
	}
	busy = true
	broadcast({ type: "state", value: "live" })
	broadcast({ type: "reset" })
	// Line tap: EVERY internal narrator line (triage picks, goal updates,
	// comms progress, scribe, challenge notices) now flows through
	// tapLine() -> here, so the browser log matches the server console.
	// Interceptor audit rows additionally get their dedicated guard event
	// so the page can style them as guardrail strips.
	setLineSink((line: string) => {
		broadcast({ type: "row", line })
		if (line.includes("[interceptor]")) {
			const blocked = line.includes("BLOCKED")
			broadcast({ type: "guard", line, blocked })
		}
	})
	try {
		await runScenarioV4(
			{ interactive: true, killSleuthAt7s: true },
			{
				onLine: (line) => broadcast({ type: "row", line }),
				askHuman: (prompt) =>
					new Promise<string>((resolve) => {
						pendingDecision = (answer) => {
							pendingDecision = null
							resolve(answer)
							broadcast({ type: "state", value: "live" })
						}
						const escText = prompt
							.split("\n")
							.filter(Boolean)
							.slice(1)
							.join("\n")
						broadcast({ type: "escalation", text: escText })
					}),
			},
		).then((result) => {
			broadcast({
				type: "summary",
				line: `sleuth signatures ${result.signatures} · triage findings ${result.findings} · commander challenges ${result.challenges}`,
				sig: result.signatures,
				findings: result.findings,
				challenges: result.challenges,
			})
			broadcast({ type: "state", value: "idle" })
		})
	} finally {
		busy = false
		pendingDecision = null
		startedOnce = true
	}
}

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const url = req.url ?? "/"
	if (url === "/") {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
		try {
			const mod = await import(`./page-v4.js?v=${Date.now()}`)
			res.end(mod.PAGE || PAGE)
		} catch {
			res.end(PAGE)
		}
	} else if (url === "/events") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})
		res.write(": connected\n\n")
		events.push(res)
		const firstTab = !startedOnce && !busy
		broadcast({
			type: "hello",
			mode: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? "LLM mode" : "deterministic demo",
		})
		if (firstTab) void startRun()
		req.on("close", () => {
			events = events.filter((e) => e !== res)
		})
	} else if (url === "/decision" && req.method === "POST") {
		let body = ""
		req.on("data", (c) => (body += c))
		req.on("end", () => {
			let answer = ""
			try {
				answer = String(JSON.parse(body).answer ?? "")
			} catch {}
			if (pendingDecision) {
				const resolveIt = pendingDecision
				resolveIt(answer || "n")
			}
			res.writeHead(204).end()
		})
	} else if (url === "/run" && req.method === "POST") {
		void startRun()
		res.writeHead(202).end()
	} else if (url === "/agents") {
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(AGENT_INFO))
	} else if (url === "/timeline" && (req.method === "GET" || req.method === "HEAD")) {
		const fs = await import("node:fs/promises")
		const path = await import("node:path")
		const timelinePath = path.resolve(process.cwd(), "incident-timeline.md")
		try {
			const content = await fs.readFile(timelinePath, "utf-8")
			res.writeHead(200, {
				"Content-Type": "text/markdown; charset=utf-8",
				"Content-Disposition": 'attachment; filename="incident-timeline.md"',
			})
			res.end(content)
		} catch {
			res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
			res.end("No incident timeline recorded yet.")
		}
	} else {
		res.writeHead(404).end()
	}
}

createServer(handler).listen(PORT, () => {
	console.log(`OpsRoom web console → http://localhost:${PORT}`)
	console.log("(opens straight into a live incident — Restart demo anytime)")
})
