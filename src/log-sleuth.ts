import { AgenticEnvironment, BaseParticipant, sendMessage } from "@mozaik-ai/core"
import type { IncidentFeed } from "./incident-feed"

/**
 * LogSleuth works IN PARALLEL with triage — it does not wait for anyone.
 * It selectively listens to raw log lines only, extracts an error signature,
 * and publishes a finding. This is the demo's proof that two specialists
 * react to the same event concurrently instead of handing off in sequence.
 */
export class LogSleuth extends BaseParticipant {
	readonly signatures: string[] = []

	constructor(private readonly environment: AgenticEnvironment) {
		super()
	}

	async onMessage(message: string): Promise<void> {
		if (!message.startsWith("[log]")) return

		// Extract a crude error signature: file + error code.
		const match = message.match(/(\S+\.(?:ts|java|go)):[0-9]+ .*?([A-Z0-9_]{4,}ERROR[A-Z0-9_]*)/)
		const file = match?.[1] ?? "unknown"
		const code = match?.[2] ?? "UNKNOWN"

		this.signatures.push(`${file}:${code}`)
		this.log(`signature extracted: ${file} → ${code}`)

		// Publish faster than triage's hypothesis — pure parallel work.
		sendMessage(
			this.environment,
			`[sleuth] error signature: ${code} in ${file} — first seen right after deploy window opened`,
			this,
		)
	}

	private log(line: string): void {
		console.log(`  [sleuth] ${line}`)
	}
}
