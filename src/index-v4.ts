import { runScenarioV4 } from "./scenario-v4"

/**
 * OpsRoom v4 CLI entrypoint. Identical output contract to the v3 index.ts —
 * runs the deterministic demo (or LLM mode when a key is present) and prints
 * the result counters.
 */
runScenarioV4({ interactive: false, reportPath: "incident-timeline-v4.md" }).then((result) => {
	console.log(`\n=== done — signatures: ${result.signatures}, findings: ${result.findings}, challenges: ${result.challenges} ===`)
	setTimeout(() => process.exit(0), 250)
})
