// One-command local-LLM demo: checks the server, ensures the model alias
// exists, wires env, runs the scenario.
//
// Mozaik only accepts 12 registry model names (e.g. "deepseek-v4-flash"), but
// Ollama 404s on unknown names. The fix: create an alias pointing a real local
// model at the registry name — this script does it automatically via
// `ollama cp`.
//
// Usage:
//   npm run demo:local                      # assumes Ollama at 127.0.0.1:11434
//   LLM_BASE_URL=http://127.0.0.1:1234/v1 npm run demo:local   # LM Studio / llama.cpp
//   MODEL_SOURCE=qwen3:8b npm run demo:local  # pick which local model to alias
import { spawn, execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const baseUrl = process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1"
const registryName = "deepseek-v4-flash" // Mozaik registry name that routes through the generic OpenAI-compatible adapter
const modelSource = process.env.MODEL_SOURCE // optional: which local model to alias
let useLlm = true

console.log(`[demo:local] target: ${baseUrl}`)

const run = (cmd, args) =>
	execFileAsync(cmd, args, { timeout: 30_000 })
		.then(({ stdout }) => stdout.trim())
		.catch(() => null)

// 1. Server up + model list (Ollama native API).
let serverType = null
let localModels = []
try {
	const res = await fetch(baseUrl.replace(/\/v1\/?$/, "") + "/api/tags")
	if (res.ok) {
		const data = await res.json()
		localModels = (data.models ?? []).map((m) => m.name).filter((n) => !n.includes("embed"))
		serverType = "ollama"
		console.log(`[demo:local] Ollama up — models: ${localModels.join(", ") || "none"}`)
	}
} catch {
	/* not Ollama or not running */
}

if (serverType !== "ollama") {
	// LM Studio / llama.cpp serve any requested model name, so no alias needed.
	console.log(`[demo:local] no Ollama at ${baseUrl}`)
	console.log(`[demo:local] if using LM Studio/llama.cpp, set LLM_BASE_URL — continuing with registry name as-is`)
}

// 2. Ensure the alias exists (Ollama only). Uses the HTTP /api/copy endpoint
//    so it works even without the `ollama` CLI on PATH.
if (serverType === "ollama" && !localModels.includes(registryName)) {
	// Pick a source model: explicit MODEL_SOURCE > largest chat model heuristically.
	const source = modelSource ?? localModels[0]
	if (!source) {
		console.log(`[demo:local] no local models to alias — pull one:  ollama pull qwen2.5:7b`)
	} else {
		console.log(`[demo:local] creating alias (one-time): ${source} → "${registryName}"`)
		try {
			const res = await fetch(baseUrl.replace(/\/v1\/?$/, "") + "/api/copy", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ source, destination: registryName }),
			})
			if (!res.ok) throw new Error(await res.text())
		} catch (err) {
			console.log(`[demo:local] WARN: alias copy failed (${String(err).slice(0, 120)})`)
			console.log(`[demo:local] try manually:  ollama cp ${source} ${registryName}`)
		}
		// Verify the alias actually landed before promising LLM mode.
		// Note: `ollama cp src deepseek-v4-flash` creates "deepseek-v4-flash:latest"
		// (Ollama auto-appends :latest), so match with or without the tag.
		try {
			const res = await fetch(baseUrl.replace(/\/v1\/?$/, "") + "/api/tags")
			const data = await res.json()
			const names = (data.models ?? []).map((m) => m.name)
			const aliasPresent = names.some((n) => n === registryName || n.startsWith(`${registryName}:`))
			if (!aliasPresent) {
				console.log(`[demo:local] alias not present after copy — falling back to DETERMINISTIC demo`)
				useLlm = false
			} else {
				console.log(`[demo:local] alias ready`)
			}
		} catch {
			useLlm = false
		}
	}
}

// 3. Run the scenario.
const env = {
	...process.env,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "local-demo",
	OPENAI_BASE_URL: baseUrl,
	LLM_MODEL: process.env.LLM_MODEL ?? registryName,
	LLM_STREAMING: "false",
}

if (!useLlm) delete env.OPENAI_API_KEY

const child = spawn("npx", ["tsx", "src/index.ts"], { stdio: "inherit", env })
child.on("exit", (code) => process.exit(code ?? 0))
