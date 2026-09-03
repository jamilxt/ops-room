import { SituationSpecification, createAgent, type SituationContext, type SituationHandler } from "@mozaik-ai/core"
import { sendMessage, whenMessageFrom, eventProcessorFor, processorFor } from "./runtime-v4"
import { parseProposalLine } from "./proposal-protocol"

/**
 * RiskCommander v4 — the interception showcase. Watches recommendations from
 * the specialist agents and challenges the unsafe ones (same gate logic as
 * v3). v4 conversion notes:
 * - "listen scope" (admitListener/releaseListener) collapses naturally:
 *   message routing keys off the [tag] prefix, so admitting a late joiner is
 *   a no-op — its [healer]/[librarian] rows already face the same gate.
 * - onParticipantError has NO v4 equivalent in the published API; the fault
 *   injection demo (killSleuthAt7s) is wired at scenario level instead.
 */
export function createRiskCommander() {
	const challenges: string[] = []
	const signaturesSeen: string[] = []
	let lastChallenged: string | null = null
	let ungroundedStrikes = 0
	let evidenceFirstGoal = false

	function emit(
		participantId: string,
		kind: "HOLD" | "ESCALATION",
		source: string,
		reason: string,
		guidance: string,
	) {
		lastChallenged = source
		const offender = source.match(/^\[(\w+)\]/)?.[1] ?? "agent"
		const challenge = `${kind} @${offender} — that proposal ${reason}. Confirmed evidence so far: ${signaturesSeen.join(", ") || "none yet"}. ${guidance}`
		challenges.push(source)
		console.log(`  [commander] ⚠ challenging: ${source.slice(0, 60)}…`)
		sendMessage(`[commander] ${challenge}`, participantId)
	}

	const handlers: SituationHandler[] = [
		// Roster awareness: graceful departure of a teammate.
		{
			specification: new (class extends SituationSpecification {
				isSatisfiedBy({ event, participant }: SituationContext): boolean {
					if (event.type !== "participant.left") return false
					const who = (event.payload as { name?: string })?.name
					return who !== "IncidentFeed" && who !== "IncidentScribe" && (event.payload as { id?: string })?.id !== participant.getId()
				}
			})(),
			processor: eventProcessorFor((event, participant) => {
				const who = (event.payload as { name?: string })?.name ?? "a teammate"
				sendMessage(`[commander] roster: ${who} left the room — coverage unchanged, its lane was resolved.`, participant.getId())
			}),
		},
		// Goal pivot: ENFORCE evidence-first from now on.
		{
			specification: new (class extends SituationSpecification {
				isSatisfiedBy({ event }: SituationContext): boolean {
					return event.type === "goal-update"
				}
			})(),
			processor: eventProcessorFor((event, participant) => {
				const data = event.payload as { goal?: string }
				if (data.goal !== "preserve-evidence") return
				if (evidenceFirstGoal) return
				evidenceFirstGoal = true
				sendMessage("[commander] goal absorbed: evidence-first is now ENFORCED — state-changing proposals without readonly capture lead will be held.", participant.getId())
			}),
		},
		// Sleuth signature ledger.
		{
			specification: whenMessageFrom((message) => message.startsWith("[sleuth]")),
			processor: processorFor((message) => {
				const code = message.match(/[A-Z0-9_]+_ERROR/)?.[0]
				if (code && !signaturesSeen.includes(code)) signaturesSeen.push(code)
			}),
		},
		// Proposal gate for triage/healer rows.
		{
			specification: whenMessageFrom((message) => /^\[(triage|healer)\]/.test(message)),
			processor: processorFor((message, participant) => {
				if (message === lastChallenged) return

				// STRUCTURED GATE (primary).
				const structured = parseProposalLine(message)
				if (structured) {
					const { proposal } = structured
					const grounded = proposal.cites.some((c) => signaturesSeen.includes(c))
					if (!grounded) {
						ungroundedStrikes++
						const humanTime = proposal.kind === "REVISED PROPOSAL" || ungroundedStrikes >= 2
						emit(
							participant.getId(),
							humanTime ? "ESCALATION" : "HOLD",
							message,
							`cites [${proposal.cites.join(", ") || "no signatures"}] but confirmed evidence is (${signaturesSeen.join(", ") || "none yet"})`,
							humanTime
								? "This has gone past automated review — escalating to the on-call engineer for a human decision."
								: "Re-submit citing at least one confirmed signature.",
						)
						return
					}
					if (proposal.blastRadius === "broad") {
						emit(participant.getId(), "HOLD", message, "declares blastRadius: broad (fleet-wide / data-touching)",
							"Re-submit with a targeted or readonly lever (canary scope, pool resize, lock retry).")
						return
					}
					if (evidenceFirstGoal && !proposal.evidenceFirst && proposal.blastRadius !== "readonly") {
						emit(participant.getId(), "HOLD", message, "proposes a state change while the room's goal is evidence-first",
							"Capture readonly evidence first (snapshot) and set evidenceFirst: true, then re-propose.")
						return
					}
					ungroundedStrikes = 0
					return
				}

				// PROSE NET (v1 contract lines that bypassed the schema).
				const body = message.replace(/^\[(triage|healer)\]\s*/, "")
				const OPEN = "(^|\\n|[.!?]\\s)"
				const isRevision = new RegExp(`${OPEN}REVISED PROPOSAL:`).test(body)
				const isProposal = !isRevision && new RegExp(`${OPEN}PROPOSAL:`).test(body)

				if (isProposal || isRevision) {
					const grounded = signaturesSeen.some((sig) => message.includes(sig))
					if (!grounded) {
						ungroundedStrikes++
						const humanTime = isRevision || ungroundedStrikes >= 2
						const kind = humanTime ? "ESCALATION" : "HOLD"
						const guidance = humanTime
							? "This has gone past automated review — escalating to the on-call engineer for a human decision."
							: "Revise it against the confirmed signatures — PROPOSAL must cite at least one (REVISED PROPOSAL:)."
						emit(participant.getId(), kind, message,
							`does not reference any confirmed signature (${signaturesSeen.join(", ") || "none yet"})`,
							guidance)
						return
					}
					ungroundedStrikes = 0
					return
				}

				// Blast-radius heuristics for un-tokenized phrasing.
				const impliesRestart = /restart|reboot/i.test(message)
				const touchesInfra = /\b(pod|instance|service|node)s?\b/i.test(message)
				const blanketRisk = /restart all|roll\s?back|drop (the )?cache|delete data|migrate all/i.test(message)
				const safePath = /staged|canary|gradual/i.test(message)
				if (!safePath && ((impliesRestart && touchesInfra) || blanketRisk)) {
					emit(participant.getId(), "HOLD", message, "blast-radius action without prior sign-off",
						"Revise it against the confirmed signatures — PROPOSAL must cite at least one (REVISED PROPOSAL:).")
				}
			}),
		},
	]

	const agent = createAgent({
		name: "RiskCommander",
		capabilities: [],
		instruction:
			"You are the incident commander. You watch mitigation proposals from specialist agents and hold any that lack confirmed evidence or carry excessive blast radius. You never propose yourself.",
		tools: [],
		handlers,
	})

	return { agent, challenges }
}
