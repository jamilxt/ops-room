// Minimal mock OpenAI-compatible server to prove Mozaik can be pointed at any
// /v1/chat/completions endpoint (Ollama, LM Studio, llama.cpp server, etc.).
// Usage: node scripts/mock-openai.mjs [port]
import http from "node:http"

const port = Number(process.argv[2] ?? 8787)

const server = http.createServer((req, res) => {
	if (!req.url?.includes("/chat/completions")) {
		res.writeHead(404).end()
		return
	}
	let body = ""
	req.on("data", (c) => (body += c))
	req.on("end", () => {
		const parsed = JSON.parse(body)
		console.log(`[mock] model="${parsed.model}" stream=${parsed.stream} messages=${parsed.messages?.length}`)

		if (parsed.stream) {
			res.writeHead(200, { "content-type": "text/event-stream" })
			const text = `MockLLM analysis of your incident: correlation confirmed between deploy window and pool exhaustion. Recommending staged canary rollback first.`
			const chunks = text.match(/.{1,12}/g) ?? []
			for (const c of chunks) {
				res.write(`data: ${JSON.stringify({ id: "1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: c } }] })}\n\n`)
			}
			res.write("data: [DONE]\n\n")
			res.end()
		} else {
			res.writeHead(200, { "content-type": "application/json" })
			res.end(
				JSON.stringify({
					id: "1",
					object: "chat.completion",
					choices: [{ index: 0, message: { role: "assistant", content: "MockLLM says: staged rollback first." }, finish_reason: "stop" }],
					usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
				}),
			)
		}
	})
})

server.listen(port, () => console.log(`[mock] OpenAI-compatible server on http://127.0.0.1:${port}/v1`))
