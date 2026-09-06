// Central line tap for OpsRoom v4.
//
// Every internal "narrator" line (triage picking up events, goal updates,
// challenge received, scribe writing the timeline, ...) goes through
// tapLine(). In CLI mode (index-v4) nothing is registered and lines print to
// the server console as before. The web entrypoint (web-v4) registers a
// sink at startup, so EVERY line the server console shows also lands in the
// browser log — no more invisible activity.
type LineSink = (line: string) => void

const registry = globalThis as { __opsRoomLineSink?: LineSink }

export function setLineSink(sink: LineSink | undefined): void {
	registry.__opsRoomLineSink = sink
}

export function tapLine(line: string): void {
	// Always print to the server console (CLI parity + server-side logs);
	// additionally forward to the browser sink when the web entrypoint
	// has registered one, so the page log shows the same full stream.
	console.log(line)
	registry.__opsRoomLineSink?.(line)
}
