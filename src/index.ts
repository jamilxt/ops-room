import { runScenario } from "./scenario"

/**
 * CLI entrypoint — pure console, same output shape as the original single-file
 * version (rows from the scribe, summary at the end).
 * Exit code 0 always: the report is written before we get here.
 */
runScenario({
	interactive: process.env.OPSROOM_ONCALL === "interactive",
	killSleuthAt7s: process.env.OPSROOM_FAULT === "sleuth",
}).then((result) => {
	console.log(
		`\n[summary] sleuth signatures: ${result.signatures}, triage findings: ${result.findings}, commander challenges: ${result.challenges}`,
	)
	process.exit(0)
})
