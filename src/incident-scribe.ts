import { BaseParticipant, Participant } from "@mozaik-ai/core"
import { appendFileSync, writeFileSync } from "node:fs"

/**
 * IncidentScribe is a pure observer: no inference, no messages. It watches
 * every event crossing the environment and renders a live incident timeline
 * (console + markdown artifact for the submission repo).
 */
export class IncidentScribe extends BaseParticipant {
	private startedAt = Date.now()
	private lines: string[] = ["# Incident timeline (generated live by IncidentScribe)", ""]

	constructor() {
		super()
	}

	async onMessage(message: string, source?: Participant): Promise<void> {
		const who = source?.constructor?.name ?? "unknown"
		const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1)
		const line = `T+${elapsed}s [${who}] ${message}`
		console.log(line)
		this.lines.push(`- \`${line}\``)
	}

	writeReport(path: string): void {
		writeFileSync(path, this.lines.join("\n") + "\n")
		console.log(`\n[scribe] timeline written to ${path}`)
	}
}
