// Fake Ollama for integration-testing demo-local.mjs — reproduces the user's
// exact 404 behavior: /api/tags lists models, /v1/chat/completions rejects
// any model NOT in the list. Usage: node scripts/fake-ollama.mjs [port]
import http from "node:http"

const port = Number(process.argv[2] ?? 11434)
const models = [{ name: "qwen2.5:7b" }, { name: "qwen3:8b" }, { name: "nomic-embed-text:latest" }]

const server = http.createServer((req, res) => {
	const json = (code, body) => {
		res.writeHead(code, { "content-type": "application/json" })
		res.end(JSON.stringify(body))
	}

	if (req.url?.endsWith("/api/tags")) {
		return json(200, { models })
	}

	if (req.url?.endsWith("/api/copy") && req.method === "POST") {
		let body = ""
		req.on("data", (c) => (body += c))
		req.on("end", () => {
			const { source, destination } = JSON.parse(body)
			const src = models.find((m) => m.name === source)
			if (!src) return json(404, { error: `model '${source}' not found` })
			models.push({ name: destination })
			console.log(`[fake-ollama] copied ${source} → ${destination}`)
			return json(200, { status: "success" })
		})
		return
	}

	if (req.url?.includes("/chat/completions")) {
		let body = ""
		req.on("data", (c) => (body += c))
		req.on("end", () => {
			const parsed = JSON.parse(body)
			console.log(`[fake-ollama] request model="${parsed.model}"`)
			const exists = models.some((m) => m.name === parsed.model)
			if (!exists) {
				return json(404, {
					error: { message: `model '${parsed.model}' not found`, type: "not_found_error", param: null, code: null },
				})
			}
			return json(200, {
				id: "1",
				object: "chat.completion",
				choices: [{ index: 0, message: { role: "assistant", content: `FakeOllama(${parsed.model}): canary rollback first, pool exhaustion confirmed` }, finish_reason: "stop" }],
				usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
			})
		})
		return
	}

	res.writeHead(404).end()
})

server.listen(port, () => console.log(`[fake-ollama] on http://127.0.0.1:${port}`))
