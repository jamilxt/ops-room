import fs from "node:fs"
import path from "node:path"

/**
 * Shared fixture-log grep. Extracted from log-sleuth.ts so late-joining
 * agents (DatabaseHealer) can ground their analyses in the same evidence
 * without importing the sleuth (and vice versa) — zero coupling between
 * specialists.
 */
const FIXTURE_DIR = path.resolve("fixtures")

export function searchFixture(file: string, pattern: string): string {
	const safe = path.basename(file) // flatten any traversal attempt
	const full = path.join(FIXTURE_DIR, safe)
	if (!fs.existsSync(full)) return `no such log file: ${file}`
	const hits = fs
		.readFileSync(full, "utf8")
		.split("\n")
		.filter((l) => l.toLowerCase().includes(pattern.toLowerCase()))
	return hits.length === 0
		? `0 matches for "${pattern}" in ${file}`
		: `${hits.length} match(es) for "${pattern}" in ${file}:\n${hits.join("\n")}`
}
