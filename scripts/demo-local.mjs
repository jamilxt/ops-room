// One-command local-LLM demo: checks the server, wires env, runs the scenario.
// Usage:
//   npm run demo:local                      # assumes Ollama at 127.0.0.1:11434
//   LLM_BASE_URL=http://127.0.0.1:1234/v1 npm run demo:local   # LM Studio / llama.cpp
import { spawn } from "node:child_process"

const baseUrl = process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1"
const modelsUrl = baseUrl.replace(/\/v1\/?$/, "") + "/api/tags" // Ollama model list

console.log(`[demo:local] target: ${baseUrl}`)

// Preflight 1: is the server up?
try {
	const res = await fetch(baseUrl.replace(/\/v1\/?$/, "") + "/api/tags")
	if (res.ok) {
		const data = await res.json()
		const names = (data.models ?? []).map((m) => m.name)
		console.log(`[demo:local] server up — models: ${names.join(", ") || "none loaded!"}`)
		if (names.length === 0) {
			console.log(`[demo:local] no models — pull one first:  ollama pull qwen2.5:7b`)
			process.exit(1)
		}
	} else {
		console.log(`[demo:local] server responded ${res.status} at /api/tags — continuing anyway`)
	}
} catch {
	console.log(`[demo:local] could not reach Ollama at ${baseUrl}`)
	console.log(`[demo:local] start it:  ollama serve   (or set LLM_BASE_URL for LM Studio/llama.cpp)`)
	console.log(`[demo:local] falling back to DETERMINISTIC demo (no LLM)`)
}

const env = {
	...process.env,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "local-demo",
	OPENAI_BASE_URL: baseUrl,
	LLM_MODEL: process.env.LLM_MODEL ?? "deepseek-v4-flash",
	LLM_STREAMING: "false",
}

const child = spawn("npx", ["tsx", "src/index.ts"], { stdio: "inherit", env })
child.on("exit", (code) => process.exit(code ?? 0))
