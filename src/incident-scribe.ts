import { BaseParticipant, Participant } from "@mozaik-ai/core"
import { appendFileSync, writeFileSync } from "node:fs"

/**
 * IncidentScribe is a pure observer: no inference, no messages. It watches
 * every event crossing the environment and renders a live incident timeline
 * (console + markdown artifact for the submission repo).
 * `onSig` fires per [sleuth] publication so index.ts can count signatures.
 */
export class IncidentScribe extends BaseParticipant {
	private startedAt = Date.now()
	private lines: string[] = ["# Incident timeline (generated live by IncidentScribe)", ""]

	constructor(
		private readonly onSig?: () => void,
		/** Output sink; defaults to console so the CLI behaves as before. */
		private readonly say: (line: string) => void = (line) => console.log(line),
	) {
		super()
	}

	async onMessage(message: string, source?: Participant): Promise<void> {
		// Every bus message carries its own identity tag ([triage], [sleuth],
		// [commander], ...) — prefer it over reflective class names.
		const who = message.match(/^\[(\w+)\]/)?.[1] ?? source?.constructor?.name ?? "unknown"
		if (who === "sleuth" && message.includes("error signature")) this.onSig?.()
		const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1)
		const line = `T+${elapsed}s ${who === "unknown" ? "" : `[${who}] `}${message.replace(/^\[\w+\]\s*/, "")}`
		this.say(line)
		this.lines.push(`- \`${line}\``)
	}

	writeReport(path: string): void {
		writeFileSync(path, this.lines.join("\n") + "\n")
		this.say(`\n[scribe] timeline written to ${path}`)
	}
}
