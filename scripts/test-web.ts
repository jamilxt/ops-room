// UI protocol verifier: connects to /events, counts rows, auto-approves the
// escalation via POST /decision, waits for the summary. Exits 0 only if the
// full loop works — run it, then fire POST /run from the shell.
import { request } from "node:http"

const PORT = Number(process.env.PORT ?? 8791)

function post(path: string, body?: unknown): void {
	const req = request({ host: "localhost", port: PORT, path, method: "POST", headers: { "Content-Type": "application/json" } })
	req.on("error", (e) => console.log("POST fail:", e.message))
	if (body) req.write(JSON.stringify(body))
	req.end()
}

let rows = 0
let escalations = 0
let summary: string | null = null
const req = request({ host: "localhost", port: PORT, path: "/events", method: "GET" })
req.setHeader("Accept", "text/event-stream")
req.end()
let buf = ""
req.on("response", (res) => {
	res.setEncoding("utf8")
	res.on("data", (chunk) => {
		buf += chunk
		let i: number
		while ((i = buf.indexOf("\n\n")) >= 0) {
			const chunk2 = buf.slice(0, i)
			buf = buf.slice(i + 2)
			const m = chunk2.match(/^data: (.*)$/m)
			if (!m) continue
			try {
				const p = JSON.parse(m[1])
				if (p.type === "row") rows++
				else if (p.type === "escalation") {
					escalations++
					console.log(`ESCALATION SEEN at row ${rows} — POSTing approve`)
					post("/decision", { answer: "y" })
				} else if (p.type === "summary") {
					summary = p.line as string
					console.log("SUMMARY:", summary)
					console.log(JSON.stringify({ rows, escalations, ok: escalations >= 1 && rows > 10 && !!summary }))
					process.exit(escalations >= 1 && rows > 10 ? 0 : 1)
				}
			} catch {}
		}
	})
})
req.on("error", (e) => {
	console.log("SSE fail:", e.message)
	process.exit(1)
})
setTimeout(() => {
	console.log(JSON.stringify({ rows, escalations, summary, ok: false, reason: "timeout" }))
	process.exit(1)
}, 55_000)
