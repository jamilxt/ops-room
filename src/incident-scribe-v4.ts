import { createHuman, type SituationHandler } from "@mozaik-ai/core"
import { appendFileSync, writeFileSync } from "node:fs"
import { whenMessageFrom, processorFor } from "./runtime-v4"

/**
 * IncidentScribe v4 — a pure observer. No inference, no messages. It watches
 * every message crossing the runtime and renders a live incident timeline.
 * `onSig` fires per [sleuth] publication so the scenario can count signatures.
 */
export function createIncidentScribe(
	onSig?: () => void,
	say: (line: string) => void = (line) => console.log(line),
) {
	const startedAt = Date.now()
	const lines: string[] = ["# Incident timeline (generated live by IncidentScribe)", ""]

	const handlers: SituationHandler[] = [
		{
			specification: whenMessageFrom(() => true),
			processor: processorFor((message, participant, event) => {
				const who = message.match(/^\[(\w+)\]/)?.[1] ?? "unknown"
				if (who === "sleuth" && message.includes("error signature")) onSig?.()
				const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
				const line = `T+${elapsed}s ${who === "unknown" ? "" : `[${who}] `}${message.replace(/^\[\w+\]\s*/, "")}`
				say(line)
				lines.push(`- \`${line}\``)
			}),
		},
	]

	const scribe = createHuman({
		name: "IncidentScribe",
		capabilities: [],
		handlers,
	})

	return {
		participant: scribe,
		writeReport(path: string) {
			writeFileSync(path, lines.join("\n") + "\n")
			say(`\n[scribe] timeline written to ${path}`)
		},
	}
}
